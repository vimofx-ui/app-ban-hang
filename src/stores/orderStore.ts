import { create } from 'zustand';
import { supabase } from '@/lib/supabase'; // Assuming strict path or index export
import type { Order, OrderItem } from '@/types';

import { createBaseState, withAsync } from './baseStore';
import type { BaseState } from './baseStore';
import { logAction } from '@/lib/audit';

interface OrderState extends BaseState {
    orders: Order[];

    loadOrders: () => Promise<void>;
    addOrder: (order: Order) => void;
    getOrderById: (id: string) => Promise<Order | null>;
    updateOrder: (id: string, updates: Partial<Order>) => Promise<boolean>;
    shipOrder: (orderId: string) => Promise<boolean>;
    finalizeDeliveryOrder: (orderId: string) => Promise<boolean>;
    processReturn: (originalOrder: Order, itemsToReturn: { itemId: string; quantity: number }[], reason: string) => Promise<boolean>;
    subscribeToOrders: () => void;
    unsubscribeOrders: () => void;

    // Pagination
    totalOrders: number;
    currentPage: number;
    pageSize: number;
    setCurrentPage: (page: number) => void;
    setPageSize: (size: number) => void;

    // Server-side Filtering
    activeStatus: string;
    searchQuery: string;
    setActiveStatus: (status: string) => void;
    setSearchQuery: (query: string) => void;
}

// Helper: Remove images to save space
const cleanOrderForStorage = (order: Order): Order => ({
    ...order,
    order_items: order.order_items?.map(item => ({
        ...item,
        product: item.product ? {
            ...item.product,
            image_url: undefined,
            images: undefined
        } : item.product
    }))
});

export const useOrderStore = create<OrderState>((set, get) => ({
    ...createBaseState(),
    orders: [],
    // Pagination Defaults
    totalOrders: 0,
    currentPage: 1,
    pageSize: 20,
    activeStatus: 'all',
    searchQuery: '',

    setCurrentPage: (page: number) => set({ currentPage: page }),
    setPageSize: (size: number) => set({ pageSize: size }),
    setActiveStatus: (status: string) => set({ activeStatus: status, currentPage: 1 }), // Reset to page 1 on filter change
    setSearchQuery: (query: string) => set({ searchQuery: query, currentPage: 1 }),

    loadOrders: async () => {
        await withAsync(set, async () => {
            let data: any[] = [];
            let error = null;
            let count = 0;

            const { currentPage, pageSize, activeStatus, searchQuery } = get();
            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            if (supabase) {
                // Dynamically import or...
                const authStoreModule = await import('./authStore');
                const branchId = authStoreModule.useAuthStore.getState().branchId;

                let query = supabase
                    .from('orders')
                    .select(`
                        *,
                        order_items (*, product:products(*)),
                        customer:customers(*)
                    `, { count: 'exact' })
                    .order('created_at', { ascending: false })
                    .range(from, to);

                if (branchId) {
                    query = query.eq('branch_id', branchId);
                }

                // Apply Filters Server-side
                if (activeStatus && activeStatus !== 'all') {
                    query = query.eq('status', activeStatus);
                }

                if (searchQuery) {
                    // Search by order_number or customer name (requires join filter or simple check)
                    // Supabase simple search:
                    // query = query.or(`order_number.ilike.%${searchQuery}%,customer.name.ilike.%${searchQuery}%`); // This might fail on joined cols
                    // Safer: just order_number for now, or use a specific RPC if complex text search needed.
                    // Let's try order_number first.
                    query = query.ilike('order_number', `%${searchQuery}%`);
                }

                const res = await query;
                data = res.data || [];
                error = res.error;
                count = res.count || 0;
            }

            if (!error) {
                // Merge with offline orders if any (Logic slightly complicated with pagination, 
                // but usually offline orders are "new" so they should appear on page 1 if sorted by date)
                // For simplicity, we prioritize server data for pagination consistency.
                // However, offline orders should be visible. 
                // Strategy: If page 1, prepend offline orders. 

                let allOrders = [...data];

                if (currentPage === 1) {
                    const offlineOrders = JSON.parse(localStorage.getItem('offline-orders') || '[]');
                    const existingIds = new Set(data.map((o: any) => o.id));
                    const uniqueOfflineOrders = offlineOrders.filter((o: any) => !existingIds.has(o.id));
                    allOrders = [...uniqueOfflineOrders, ...data].sort((a, b) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    );
                }

                set({ orders: allOrders as Order[], totalOrders: count });
            } else if (error) {
                throw error;
            }
        }, 'Không thể tải danh sách đơn hàng');
    },

    // Add order to state and localStorage (for POS integration)
    addOrder: (order: Order) => {
        set((state) => {
            const newOrders = [order, ...state.orders];

            // Also save to offline storage
            const offlineOrders = JSON.parse(localStorage.getItem('offline-orders') || '[]');
            // Avoid duplicates
            if (!offlineOrders.find((o: Order) => o.id === order.id)) {
                offlineOrders.unshift(cleanOrderForStorage(order));
                localStorage.setItem('offline-orders', JSON.stringify(offlineOrders.slice(0, 100))); // Keep max 100
            }

            return { orders: newOrders };
        });
    },

    getOrderById: async (id: string) => {
        try {
            if (!supabase) {
                // Demo mode - check localStorage
                const offlineOrders = JSON.parse(localStorage.getItem('offline-orders') || '[]');
                return offlineOrders.find((o: Order) => o.id === id) || null;
            }
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (*, product: products(*)),
            customer: customers(*)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            return data as Order;
        } catch (err) {
            console.error('Error fetching order:', err);
            return null;
        }
    },

    updateOrder: async (id, updates) => {
        console.log('[updateOrder] Called with:', { id, updates });
        set({ isLoading: true });
        try {
            const now = new Date().toISOString();

            // Auto-add timestamps when status changes
            const enrichedUpdates = { ...updates };
            if (updates.status) {
                console.log('[updateOrder] Status change detected:', updates.status);
                switch (updates.status) {
                    case 'approved':
                        enrichedUpdates.approved_at = now;
                        break;
                    case 'packing':
                        enrichedUpdates.packing_at = now;
                        break;
                    case 'packed':
                        enrichedUpdates.packed_at = now;
                        break;
                    case 'shipping':
                        enrichedUpdates.shipped_at = now;
                        break;
                    case 'completed':
                        enrichedUpdates.completed_at = now;
                        break;
                    case 'cancelled':
                        enrichedUpdates.cancelled_at = now;
                        break;
                }
            }

            console.log('[updateOrder] Enriched updates:', enrichedUpdates);

            // Log action import moved to top level

            // ... (inside updateOrder)
            // 1. Update Supabase
            if (supabase) {
                console.log('[updateOrder] Updating Supabase...');
                const { error } = await supabase
                    .from('orders')
                    .update(enrichedUpdates)
                    .eq('id', id);
                if (error) {
                    console.error('[updateOrder] Supabase error:', error);
                    throw error;
                }
                console.log('[updateOrder] Supabase update successful');

                // LOG ACTION (Only for important status changes)
                if (updates.status) {
                    await logAction('update_order_status', 'orders', id, {
                        old_status: get().orders.find(o => o.id === id)?.status,
                        new_status: updates.status
                    });
                }
            }

            // 2. Update Local State & Offline Storage
            set((state) => {
                const newOrders = state.orders.map(o => o.id === id ? { ...o, ...enrichedUpdates } : o);
                console.log('[updateOrder] Updated local state, new orders count:', newOrders.length);

                // Update localStorage
                const offlineOrders = JSON.parse(localStorage.getItem('offline-orders') || '[]');
                const idx = offlineOrders.findIndex((o: Order) => o.id === id);
                if (idx !== -1) {
                    offlineOrders[idx] = cleanOrderForStorage({ ...offlineOrders[idx], ...enrichedUpdates });
                    localStorage.setItem('offline-orders', JSON.stringify(offlineOrders));
                }

                return { orders: newOrders };
            });

            return true;
        } catch (err: any) {
            console.error('[updateOrder] Error updating order:', err);
            set({ error: err.message });
            return false;
        } finally {
            set({ isLoading: false });
        }
    },

    /**
     * Ship order - Deducts stock but does NOT record revenue yet
     * Called when status changes to 'shipping'
     */
    shipOrder: async (orderId: string) => {
        set({ isLoading: true });
        try {
            const { useProductStore } = await import('./productStore');

            const order = get().orders.find(o => o.id === orderId);
            if (!order) throw new Error('Không tìm thấy đơn hàng');
            if (['shipping', 'completed', 'cancelled'].includes(order.status)) {
                throw new Error('Đơn hàng không thể xuất kho');
            }

            // 1. Update Status to Shipping
            const now = new Date().toISOString();
            await get().updateOrder(orderId, {
                status: 'shipping',
                shipped_at: now
            } as any);

            // 2. Deduct Stock (but don't record revenue yet)
            if (order.order_items) {
                for (const item of order.order_items) {
                    await useProductStore.getState().updateStock(
                        item.product_id,
                        -item.quantity,
                        `Xuất kho giao hàng - ${order.order_number} `,
                        'sale'
                    );
                }
            }

            return true;
        } catch (err: any) {
            console.error('Error shipping order:', err);
            set({ error: err.message });
            alert(err.message || 'Có lỗi xảy ra khi xuất kho');
            return false;
        } finally {
            set({ isLoading: false });
        }
    },

    /**
     * Finalize delivery order - Records revenue and marks as paid
     * Called when completing a shipped order
     * Stock was already deducted when shipping
     */
    finalizeDeliveryOrder: async (orderId: string) => {
        set({ isLoading: true });
        try {
            const { useShiftStore } = await import('./shiftStore');
            const { useCustomerStore } = await import('./customerStore');

            const order = get().orders.find(o => o.id === orderId);
            if (!order) throw new Error('Không tìm thấy đơn hàng');
            if (order.status === 'completed') throw new Error('Đơn hàng đã hoàn thành');
            if (order.status !== 'shipping') throw new Error('Đơn hàng chưa xuất kho');

            // 1. Update Status to Completed + Mark as Paid
            const now = new Date().toISOString();
            const updates = {
                status: 'completed',
                completed_at: now,
                payment_status: 'paid',
                paid_amount: order.total_amount // Mark fully paid
            };

            // Call internal updateOrder (handles Supabase + Local)
            await get().updateOrder(orderId, updates as any);

            // 2. NO STOCK DEDUCTION HERE - Already done in shipOrder

            // 3. Update Shift Revenue (Current Open Shift)
            const currentShift = useShiftStore.getState().currentShift;
            if (currentShift) {
                const { updateShiftTotals } = useShiftStore.getState();

                // Calculate net cash (received - change)
                const netCash = Math.max(0, (order.cash_received || 0) - (order.change_amount || 0));

                updateShiftTotals({
                    total_cash_sales: (currentShift.total_cash_sales || 0) + netCash,
                    total_transfer_sales: (currentShift.total_transfer_sales || 0) + (order.transfer_amount || 0),
                    total_card_sales: (currentShift.total_card_sales || 0) + (order.card_amount || 0),
                    total_debt_sales: (currentShift.total_debt_sales || 0) + (order.debt_amount || 0),
                    total_point_sales: (currentShift.total_point_sales || 0) + (order.points_discount || 0),
                });
            }

            // 4. Update Customer (Points, Usage, Debt)
            if (order.customer_id) {
                const { updateCustomer, customers } = useCustomerStore.getState();
                const customer = customers.find(c => c.id === order.customer_id);
                if (customer) {
                    // Calculate points earned (Example: 1 point per 10,000 VND)
                    const pointsRate = 10000;
                    const pointsEarned = Math.floor((order.total_amount - (order.tax_amount || 0)) / pointsRate);

                    await updateCustomer(customer.id, {
                        total_spent: (customer.total_spent || 0) + order.total_amount,
                        points_balance: (customer.points_balance || 0) + pointsEarned - (order.points_used || 0),
                        debt_balance: (customer.debt_balance || 0) + (order.debt_amount || 0),
                        total_orders: (customer.total_orders || 0) + 1,
                        last_purchase_at: now
                    });
                }
            }

            return true;
        } catch (err: any) {
            console.error('Error finalizing delivery order:', err);
            set({ error: err.message });
            alert(err.message || 'Có lỗi xảy ra khi hoàn tất đơn hàng');
            return false;
        } finally {
            set({ isLoading: false });
        }
    },

    processReturn: async (originalOrder, itemsToReturn, reason) => {
        set({ isLoading: true });
        try {
            const { useShiftStore } = await import('./shiftStore');
            const { useProductStore } = await import('./productStore');
            const { generateId } = await import('@/lib/utils');
            const returnOrderNumber = `RT${originalOrder.order_number.replace('ORD-', '').replace('HD', '')} `;
            const now = new Date().toISOString();
            const currentShift = useShiftStore.getState().currentShift;
            let totalRefund = 0;

            // Calculate total refund and prepare items
            const returnItems: any[] = [];
            for (const item of itemsToReturn) {
                const originalItem = originalOrder.order_items?.find((i: any) => i.id === item.itemId);
                if (!originalItem) continue;

                const refundAmount = originalItem.unit_price * item.quantity;
                totalRefund += refundAmount;

                returnItems.push({
                    originalItem,
                    quantity: item.quantity,
                    refundAmount
                });
            }

            if (supabase) {
                // SUPABASE MODE
                const { data: returnOrder, error: orderError } = await supabase
                    .from('orders')
                    .insert({
                        order_number: returnOrderNumber,
                        shift_id: currentShift?.id || originalOrder.shift_id, // Use current shift if open, otherwise fallback
                        customer_id: originalOrder.customer_id,
                        status: 'returned',
                        original_order_id: originalOrder.id,
                        return_reason: reason,
                        payment_method: 'cash', // Refunds defaulting to cash for now
                        total_amount: totalRefund,
                        created_at: now
                    })
                    .select()
                    .single();

                if (orderError) throw orderError;

                for (const { originalItem, quantity, refundAmount } of returnItems) {
                    await supabase.from('order_items').insert({
                        order_id: returnOrder.id,
                        product_id: originalItem.product_id,
                        quantity: quantity,
                        unit_price: originalItem.unit_price,
                        total_price: refundAmount,
                        returned_quantity: 0
                    });

                    await supabase
                        .from('order_items')
                        .update({ returned_quantity: (originalItem.returned_quantity || 0) + quantity })
                        .eq('id', originalItem.id);
                }
            } else {
                // DEMO MODE - Update localStorage
                const returnOrder = {
                    id: generateId(),
                    order_number: returnOrderNumber,
                    status: 'returned' as const,
                    original_order_id: originalOrder.id,
                    return_reason: reason,
                    total_amount: totalRefund,
                    created_at: now,
                    order_items: returnItems.map(({ originalItem, quantity, refundAmount }) => ({
                        id: generateId(),
                        product_id: originalItem.product_id,
                        quantity,
                        unit_price: originalItem.unit_price,
                        total_price: refundAmount,
                        product: originalItem.product
                    }))
                };

                // Save return order to localStorage
                const offlineOrders = JSON.parse(localStorage.getItem('offline-orders') || '[]');
                offlineOrders.unshift(cleanOrderForStorage(returnOrder as Order));
                localStorage.setItem('offline-orders', JSON.stringify(offlineOrders.slice(0, 100)));
            }



            // ADD STOCK BACK - Works in BOTH modes
            for (const { originalItem, quantity } of returnItems) {
                await useProductStore.getState().updateStock(
                    originalItem.product_id,
                    quantity, // Positive = add back to stock
                    `Trả hàng - ${returnOrderNumber} `,
                    'return'
                );
            }

            // UPDATE SHIFT TOTALS
            // Deduct from sales or track as return amount
            if (currentShift) {
                const { updateShiftTotals } = useShiftStore.getState();

                // We default to deducting from cash for refunds
                // In future could match original payment method, but simple is better
                updateShiftTotals({
                    total_returns: (currentShift.total_returns || 0) + totalRefund,
                    // Optionally deduct from cash balance if we want to track net cash
                    total_cash_sales: Math.max(0, (currentShift.total_cash_sales || 0) - totalRefund)
                });

                if (supabase) {
                    await supabase.from('shifts').update({
                        total_returns: (currentShift.total_returns || 0) + totalRefund,
                        total_cash_sales: Math.max(0, (currentShift.total_cash_sales || 0) - totalRefund)
                    }).eq('id', currentShift.id);
                }
            }

            // Reload orders
            await get().loadOrders();
            return true;

        } catch (err: any) {
            console.error('Error processing return:', err);
            set({ error: err.message });
            return false;
        } finally {
            set({ isLoading: false });
        }
    },

    subscribeToOrders: async () => {
        const authStoreModule = await import('./authStore');
        const branchId = authStoreModule.useAuthStore.getState().branchId;
        if (!supabase || !branchId) return;

        // Unsubscribe existing if any
        if (get().unsubscribeOrders) get().unsubscribeOrders();

        console.log('📡 Subscribing to orders for branch:', branchId);
        const channel = supabase
            .channel('orders-list-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `branch_id = eq.${branchId} `
                },
                async (payload) => {
                    console.log('🔔 Realtime order update:', payload.eventType);
                    const { eventType, new: newRecord, old: oldRecord } = payload;

                    if (eventType === 'INSERT') {
                        // Fetch the full order details including relations
                        const { data, error } = await supabase
                            .from('orders')
                            .select(`
            *,
            order_items(*, product: products(*)),
            customer: customers(*)
                `)
                            .eq('id', (newRecord as any).id)
                            .single();

                        if (data && !error) {
                            set(state => ({
                                orders: [data as Order, ...state.orders]
                            }));
                        }
                    } else if (eventType === 'UPDATE') {
                        // Ideally we fetch full details again to be safe with relations, 
                        // or we just update the fields we know.
                        // For now, let's just shallow update the order fields in the list
                        // and re-fetch if status changed to 'completed' or something critical?
                        // Simplest safety: fetch the single updated order.
                        const { data, error } = await supabase
                            .from('orders')
                            .select(`
                *,
                order_items(*, product: products(*)),
                customer: customers(*)
                    `)
                            .eq('id', (newRecord as any).id)
                            .single();

                        if (data && !error) {
                            set(state => ({
                                orders: state.orders.map(o => o.id === data.id ? data as Order : o)
                            }));
                        }
                    } else if (eventType === 'DELETE') {
                        set(state => ({
                            orders: state.orders.filter(o => o.id !== (oldRecord as any).id)
                        }));
                    }
                }
            )
            .subscribe();

        // Check helper to store channel reference? 
        // Actually zustand store actions are functions. 
        // We need a place to store the channel. 
        // Let's rely on a module-level variable OR add it to state (but state should be serializable).
        // Module level is fine for singleton store.
        (get() as any)._channel = channel;
    },

    unsubscribeOrders: () => {
        const channel = (get() as any)._channel;
        if (channel) {
            console.log('🔇 Unsubscribing from orders');
            supabase.removeChannel(channel);
            (get() as any)._channel = null;
        }
    }
}));



