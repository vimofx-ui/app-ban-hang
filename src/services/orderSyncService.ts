// =============================================================================
// ORDER SYNC SERVICE - Syncs offline orders to Supabase
// =============================================================================

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { OfflineOrder } from '@/hooks/useOfflineOrders';
import { useBranchStore } from '@/stores/branchStore';
import { useBrandStore } from '@/stores/brandStore';

// =============================================================================
// SYNC ORDER TO SUPABASE
// =============================================================================

export async function syncOrderToServer(order: OfflineOrder): Promise<boolean> {
    if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured, skipping sync');
        return false;
    }

    try {
        // Check if order already exists (idempotency check)
        const { data: existing } = await supabase!
            .from('orders')
            .select('id')
            .eq('local_id', order.local_id)
            .maybeSingle();

        if (existing) {
            console.log('Order already synced:', order.local_id);
            return true; // Already exists, consider it synced
        }

        // Create order
        const { data: createdOrder, error: orderError } = await supabase!
            .from('orders')
            .insert({
                local_id: order.local_id,
                brand_id: order.brand_id,
                branch_id: order.branch_id,
                customer_id: order.customer_id || null,
                total_amount: order.total,
                subtotal: order.subtotal,
                discount_amount: order.discount,
                tax_amount: order.tax,
                payment_method: order.payment_method,
                status: 'completed',
                source: 'pos',
                created_at: order.created_at,
            })
            .select('id')
            .single();

        if (orderError) {
            console.error('Error creating order:', orderError);
            throw orderError;
        }

        // Create order items
        if (createdOrder && order.items.length > 0) {
            const orderItems = order.items.map(item => ({
                order_id: createdOrder.id,
                product_id: item.product_id,
                product_name: item.name,
                quantity: item.quantity,
                unit_price: item.price,
                discount: item.discount || 0,
                total: item.quantity * item.price - (item.discount || 0),
            }));

            const { error: itemsError } = await supabase!
                .from('order_items')
                .insert(orderItems);

            if (itemsError) {
                console.error('Error creating order items:', itemsError);
                // Don't throw - order was created, items failed
            }

            // Update inventory (server-side)
            for (const item of order.items) {
                try {
                    await supabase!.rpc('decrement_inventory', {
                        p_branch_id: order.branch_id,
                        p_product_id: item.product_id,
                        p_quantity: item.quantity,
                    });
                } catch (invError) {
                    console.warn('Inventory update failed for product:', item.product_id, invError);
                    // Don't throw - order is more important than inventory sync
                }
            }
        }

        console.log('Order synced successfully:', order.local_id, '-> ', createdOrder?.id);
        return true;

    } catch (error) {
        console.error('Sync failed for order:', order.local_id, error);
        throw error;
    }
}

// =============================================================================
// HELPER: Create order for POS (handles online/offline)
// =============================================================================

import { useOfflineOrders } from '@/hooks/useOfflineOrders';

export function usePOSOrderCreator() {
    const { saveOfflineOrder, markSynced, isOnline } = useOfflineOrders();
    const currentBranch = useBranchStore(state => state.currentBranch);
    const currentBrand = useBrandStore(state => state.currentBrand);

    const createOrder = async (orderData: {
        customer_id?: string;
        items: Array<{
            product_id: string;
            name: string;
            quantity: number;
            price: number;
            discount?: number;
        }>;
        subtotal: number;
        discount: number;
        tax: number;
        total: number;
        payment_method: string;
    }): Promise<{ success: boolean; local_id: string; synced: boolean }> => {

        const brand_id = currentBrand?.id || '';
        const branch_id = currentBranch?.id || '';

        if (!brand_id || !branch_id) {
            console.error('Missing brand or branch context');
            throw new Error('Missing brand or branch context');
        }

        const order: Omit<OfflineOrder, 'local_id' | 'synced' | 'created_at'> = {
            brand_id,
            branch_id,
            customer_id: orderData.customer_id,
            items: orderData.items.map(item => ({
                product_id: item.product_id,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                discount: item.discount,
            })),
            subtotal: orderData.subtotal,
            discount: orderData.discount,
            tax: orderData.tax,
            total: orderData.total,
            payment_method: orderData.payment_method,
        };

        // Always save to IndexedDB first
        const local_id = await saveOfflineOrder(order);

        // Try to sync if online
        if (isOnline()) {
            try {
                const fullOrder: OfflineOrder = {
                    ...order,
                    local_id,
                    synced: false,
                    created_at: new Date().toISOString(),
                };

                const success = await syncOrderToServer(fullOrder);
                if (success) {
                    await markSynced(local_id);
                    return { success: true, local_id, synced: true };
                }
            } catch (error) {
                console.warn('Online sync failed, order saved offline:', local_id);
            }
        }

        return { success: true, local_id, synced: false };
    };

    return { createOrder };
}
