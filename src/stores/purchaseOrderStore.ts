// =============================================================================
// PURCHASE ORDER STORE - Manage purchase orders and goods receipts
// =============================================================================

import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from './authStore';
import { useProductStore } from './productStore';
import { useBrandStore } from './brandStore';
import { useBranchStore } from './branchStore';

export interface PurchaseOrder {
    id: string;
    brand_id: string;
    branch_id: string;
    supplier_id: string;
    po_number: string;
    status: 'draft' | 'pending' | 'approved' | 'ordered' | 'delivering' | 'partial' | 'received' | 'cancelled';
    order_date: string;
    expected_date?: string;
    received_date?: string;
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
    paid_amount: number;
    payment_status: 'unpaid' | 'partial' | 'paid';
    notes?: string;
    internal_notes?: string;
    approved_by?: string;
    approved_at?: string;
    created_by?: string;
    created_at: string;
    updated_at: string;
    // Joined
    supplier_name?: string;
    supplier_phone?: string;
    supplier_address?: string;
    branch_name?: string;
    items?: PurchaseOrderItem[];
    items_count?: number;
    invoice_images?: string[];

    // Cost Allocation Fields (Phase C)
    shipping_cost?: number;
    import_tax?: number;
    other_costs?: number;
    supplier_discount?: number;
}

export interface PurchaseOrderItem {
    id: string;
    purchase_order_id: string;
    product_id: string;
    product_name: string;
    sku?: string;
    unit: string;
    ordered_qty: number;
    received_qty: number;
    unit_price: number;
    discount_percent: number;
    discount_amount: number;
    tax_percent: number;
    tax_amount: number;
    total: number;
    notes?: string;

    // Cost Allocation Fields
    allocated_cost?: number;
    final_unit_cost?: number;
}

export interface GoodsReceipt {
    id: string;
    brand_id: string;
    branch_id: string;
    purchase_order_id?: string;
    supplier_id?: string;
    receipt_number: string;
    receipt_date: string;
    status: 'draft' | 'completed' | 'cancelled';
    total_items: number;
    total_amount: number;
    notes?: string;
    received_by?: string;
    created_at: string;
    // Joined
    supplier_name?: string;
    po_number?: string;
    items?: GoodsReceiptItem[];
}

export interface GoodsReceiptItem {
    id: string;
    goods_receipt_id: string;
    purchase_order_item_id?: string;
    product_id: string;
    product_name: string;
    sku?: string;
    barcode?: string;
    expected_qty: number;
    received_qty: number;
    damaged_qty: number;
    unit_price: number;
    total: number;
    lot_number?: string;
    expiry_date?: string;
    notes?: string;
}



export interface OrderActivityLog {
    id: string;
    order_id: string;
    user_id?: string;
    user_name?: string;
    action: string;
    details?: string;
    created_at: string;
}

interface PurchaseOrderState {
    purchaseOrders: PurchaseOrder[];
    currentPO: PurchaseOrder | null;
    goodsReceipts: GoodsReceipt[];
    currentReceipt: GoodsReceipt | null;
    isLoading: boolean;
    error: string | null;

    // PO Actions
    fetchPurchaseOrders: (status?: string) => Promise<void>;
    getPurchaseOrder: (id: string) => Promise<PurchaseOrder | null>;
    createPurchaseOrder: (po: Partial<PurchaseOrder>, items: Partial<PurchaseOrderItem>[]) => Promise<PurchaseOrder | null>;
    updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => Promise<boolean>;
    updatePOStatus: (id: string, status: PurchaseOrder['status']) => Promise<boolean>;
    cancelPurchaseOrder: (id: string, returnItems?: Array<{ productId: string; returnQty: number; cost: number }>) => Promise<boolean>;
    deletePurchaseOrder: (id: string) => Promise<boolean>;

    // Activity Log
    logActivity: (orderId: string, action: string, description: string) => Promise<void>;
    getActivityLogs: (orderId: string) => Promise<OrderActivityLog[]>;

    // PO Items
    addPOItem: (poId: string, item: Partial<PurchaseOrderItem>) => Promise<boolean>;
    updatePOItem: (itemId: string, updates: Partial<PurchaseOrderItem>) => Promise<boolean>;
    removePOItem: (itemId: string) => Promise<boolean>;

    // Goods Receipt Actions
    fetchGoodsReceipts: () => Promise<void>;
    getGoodsReceipt: (id: string) => Promise<GoodsReceipt | null>;
    createGoodsReceipt: (poId: string) => Promise<GoodsReceipt | null>;
    updateReceiptItem: (itemId: string, receivedQty: number, damagedQty?: number) => Promise<boolean>;
    completeReceipt: (id: string) => Promise<boolean>;

    // Smart Ordering
    getSuggestedOrders: () => Promise<SuggestedOrder[]>;
    autoCreatePO: (supplierId: string, items: { productId: string; qty: number }[]) => Promise<PurchaseOrder | null>;

    // Realtime Subscription
    subscribeToRealtimeUpdates: () => void;
    unsubscribeFromRealtimeUpdates: () => void;


    // Pagination
    totalOrders: number;
    currentPage: number;
    pageSize: number;
    setCurrentPage: (page: number) => void;
    setPageSize: (size: number) => void;
}

export interface SuggestedOrder {
    product_id: string;
    product_name: string;
    sku: string;
    current_stock: number;
    min_stock: number;
    suggested_qty: number;
    best_supplier_id?: string;
    best_supplier_name?: string;
    best_price?: number;
    avg_daily_sales: number;
    lead_time_days: number;
}

// Type alias for backwards compatibility
export type PurchaseOrderWithItems = PurchaseOrder;

export const usePurchaseOrderStore = create<PurchaseOrderState>((set, get) => ({
    purchaseOrders: [],
    currentPO: null,
    goodsReceipts: [],
    currentReceipt: null,
    isLoading: false,

    error: null,
    // Pagination Defaults
    totalOrders: 0,
    currentPage: 1,
    pageSize: 20,

    setCurrentPage: (page: number) => set({ currentPage: page }),
    setPageSize: (size: number) => set({ pageSize: size }),

    fetchPurchaseOrders: async (status?: string) => {
        if (!isSupabaseConfigured()) {
            console.log('[PO Store] Supabase not configured');
            return;
        }

        set({ isLoading: true, error: null });
        try {
            // Get brandId from multiple sources for robustness
            const brandStoreBrandId = useBrandStore.getState().currentBrand?.id;
            const authStoreBrandId = useAuthStore.getState().brandId;
            const brandId = brandStoreBrandId || authStoreBrandId;
            console.log('[PO Store] Fetching POs for brandId:', brandId, '(from:', brandStoreBrandId ? 'brandStore' : 'authStore', ')');

            if (!brandId) throw new Error('No brand selected');

            const { currentPage, pageSize } = get();
            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            let query = supabase
                .from('purchase_orders')
                .select(`
                    *,
                    suppliers(name),
                    branches(name),
                    purchase_order_items(count)
                `, { count: 'exact' })
                .eq('brand_id', brandId)
                .order('created_at', { ascending: false })
                .range(from, to);

            if (status && status !== 'all') {
                query = query.eq('status', status);
            }

            const { data, error, count } = await query;

            console.log('[PO Store] Query result:', { data, error, count });

            if (error) throw error;

            const mapped = (data || []).map((po: any) => ({
                ...po,
                supplier_name: po.suppliers?.name,
                branch_name: po.branches?.name,
                items_count: po.purchase_order_items?.[0]?.count || 0,
            }));

            console.log('[PO Store] Setting purchaseOrders:', mapped.length, 'items');
            set({ purchaseOrders: mapped, totalOrders: count || 0, isLoading: false });
        } catch (err: any) {
            console.error('[PO Store] Error fetching POs:', err);
            set({ error: err.message, isLoading: false });
        }
    },

    getPurchaseOrder: async (id: string) => {
        if (!isSupabaseConfigured()) return null;

        try {
            const { data: po, error: poError } = await supabase
                .from('purchase_orders')
                .select(`*, suppliers(name, phone, address, email), branches(name)`)
                .eq('id', id)
                .single();

            if (poError) throw poError;

            const { data: items, error: itemsError } = await supabase
                .from('purchase_order_items')
                .select('*, products(name)')
                .eq('purchase_order_id', id);

            if (itemsError) throw itemsError;

            // Map items to include product_name from joined products table
            const mappedItems = (items || []).map((item: any) => ({
                ...item,
                product_name: item.product_name || item.products?.name || 'Sản phẩm',
                ordered_qty: item.quantity || item.ordered_qty || 0,
            }));

            const fullPO = {
                ...po,
                supplier_name: po.suppliers?.name,
                supplier_phone: po.suppliers?.phone,
                supplier_address: po.suppliers?.address,
                branch_name: po.branches?.name,
                items: mappedItems,
            };

            set({ currentPO: fullPO });
            return fullPO;
        } catch (err: any) {
            set({ error: err.message });
            return null;
        }
    },

    createPurchaseOrder: async (po: Partial<PurchaseOrder>, items: Partial<PurchaseOrderItem>[]) => {
        if (!isSupabaseConfigured()) return null;

        try {
            // Try getting brandId from multiple sources for robustness
            let brandId = useBrandStore.getState().currentBrand?.id;
            if (!brandId) {
                // Fallback: get from authStore
                brandId = useAuthStore.getState().brandId || undefined;
            }

            let branchId = useBranchStore.getState().getCurrentBranch()?.id;
            if (!branchId) {
                // Fallback: get from authStore
                branchId = useAuthStore.getState().branchId || undefined;
            }

            if (!brandId || !branchId) {
                console.error('Missing brandId or branchId:', { brandId, branchId });
                throw new Error('Vui lòng đăng nhập lại hoặc chọn chi nhánh');
            }

            // Generate PO number with fallback
            let poNumber = `REI${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${Date.now().toString().slice(-6)}`;
            try {
                const { data: rpcNumber } = await supabase.rpc('generate_po_number', { p_brand_id: brandId });
                if (rpcNumber) poNumber = rpcNumber;
            } catch (rpcErr) {
                console.warn('RPC generate_po_number not available, using fallback');
            }

            // Calculate totals
            let subtotal = 0;
            items.forEach(item => {
                const qty = item.ordered_qty || 0;
                const price = item.unit_price || 0;
                const discount = (item.discount_percent || 0) / 100;
                subtotal += qty * price * (1 - discount);
            });

            // Try insert with branch_id first, fall back without it if column doesn't exist
            let createdPO;
            let poError;

            // First attempt with branch_id
            const insertData: any = {
                brand_id: brandId,
                supplier_id: po.supplier_id || null,
                po_number: poNumber,
                status: po.status || 'pending',
                subtotal,
                // Use total_amount if provided (includes costs), else subtotal
                total_amount: po.total_amount || subtotal,
                notes: po.notes || null,
                expected_date: po.expected_date || null,
                invoice_images: (po as any).invoice_images || null,

                // Cost Allocation Fields
                shipping_cost: (po as any).shipping_cost || 0,
                import_tax: (po as any).import_tax || 0,
                other_costs: (po as any).other_costs || 0,
                supplier_discount: (po as any).supplier_discount || 0,
            };

            // Try with branch_id first
            const { data: po1, error: err1 } = await supabase
                .from('purchase_orders')
                .insert({ ...insertData, branch_id: branchId })
                .select()
                .single();

            if (err1) {
                // If branch_id column doesn't exist, retry without it
                if (err1.message?.includes('branch_id')) {
                    console.warn('branch_id column not found, retrying without it');
                    const { data: po2, error: err2 } = await supabase
                        .from('purchase_orders')
                        .insert(insertData)
                        .select()
                        .single();

                    if (err2) {
                        console.error('Error creating PO (2nd attempt):', err2);
                        throw err2;
                    }
                    createdPO = po2;
                } else {
                    console.error('Error creating PO:', err1);
                    throw err1;
                }
            } else {
                createdPO = po1;
            }

            if (!createdPO) {
                throw new Error('Failed to create purchase order');
            }

            // Create items
            console.log('Creating PO items for order:', createdPO.id);
            console.log('Items to insert:', items);

            // Map to ACTUAL database column names (from purchase_order_items schema)
            const poItems = items.map(item => {
                const qty = (item as any).ordered_qty || (item as any).quantity || 0;
                const price = item.unit_price || 0;
                const discountPct = (item as any).discount_percent || 0;
                const totalPrice = qty * price * (1 - discountPct / 100);

                return {
                    purchase_order_id: createdPO.id,
                    product_id: item.product_id,
                    product_name: (item as any).product_name || 'Sản phẩm', // Save product name
                    // Database uses 'quantity' not 'ordered_qty'
                    quantity: qty,
                    // Database uses 'received_quantity' not 'received_qty'
                    received_quantity: 0,
                    unit_price: price,
                    // Database uses 'total_price' not 'total'
                    total_price: totalPrice,

                    // Cost Allocation
                    allocated_cost: (item as any).allocated_cost || 0,
                    final_unit_cost: (item as any).final_unit_cost || 0,
                };
            });

            console.log('Formatted PO items:', poItems);

            const { data: insertedItems, error: itemsError } = await supabase
                .from('purchase_order_items')
                .insert(poItems)
                .select();

            if (itemsError) {
                console.error('Error creating PO items:', itemsError);
                console.error('Error details:', JSON.stringify(itemsError, null, 2));
                // Show visible error too
                alert('Lỗi khi lưu sản phẩm: ' + itemsError.message);
            } else {
                console.log('PO items created successfully:', insertedItems);
            }

            await get().fetchPurchaseOrders();
            return createdPO;
        } catch (err: any) {
            console.error('createPurchaseOrder error:', err);
            set({ error: err.message });
            return null;
        }
    },

    updatePurchaseOrder: async (id: string, updates: Partial<PurchaseOrder>) => {
        if (!isSupabaseConfigured()) return false;

        try {
            const { error } = await supabase
                .from('purchase_orders')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            set(state => ({
                purchaseOrders: state.purchaseOrders.map(po =>
                    po.id === id ? { ...po, ...updates } : po
                )
            }));

            // Log Activity
            if (updates.status) {
                await get().logActivity(id, 'status_change', `Cập nhật trạng thái: ${updates.status}`);
            } else {
                const keys = Object.keys(updates).join(', ');
                await get().logActivity(id, 'update', `Cập nhật thông tin: ${keys}`);
            }

            return true;
        } catch (err: any) {
            set({ error: err.message });
            return false;
        }
    },

    updatePOStatus: async (id: string, status: PurchaseOrder['status']) => {
        const updates: Partial<PurchaseOrder> = { status };

        // Add received_date when status becomes 'received'
        if (status === 'received') {
            updates.received_date = new Date().toISOString();
        }

        return get().updatePurchaseOrder(id, updates);
    },

    cancelPurchaseOrder: async (id: string, returnItems?: Array<{ productId: string; returnQty: number; cost: number }>) => {
        if (!isSupabaseConfigured()) return false;

        try {
            // Fetch full PO with items first
            const po = await get().getPurchaseOrder(id);
            if (!po) throw new Error('Purchase Order not found');

            // If 'delivering' or 'received', this is a RETURN operation - need to update stock
            if (po.status === 'received' || po.status === 'delivering') {
                const { updateStockWithCost } = useProductStore.getState();

                // If specific items to return are provided, use those
                if (returnItems && returnItems.length > 0) {
                    for (const item of returnItems) {
                        if (item.returnQty > 0) {
                            // For returns, decrease stock (negative qty)
                            await updateStockWithCost(
                                item.productId,
                                -item.returnQty,
                                item.cost,
                                `Trả hàng NCC đơn nhập ${po.po_number}`,
                                id
                            );
                        }
                    }
                } else if (po.items && po.items.length > 0) {
                    // Return all items if no specific items provided
                    for (const item of po.items) {
                        const qty = (item as any).ordered_qty || (item as any).quantity || 0;
                        if (qty > 0) {
                            const cost = (item as any).final_unit_cost || item.unit_price || 0;
                            await updateStockWithCost(
                                item.product_id,
                                -qty,
                                cost,
                                `Trả hàng NCC đơn nhập ${po.po_number}`,
                                id
                            );
                        }
                    }
                }
            }

            // Update status to cancelled
            const { error } = await supabase
                .from('purchase_orders')
                .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            set(state => ({
                purchaseOrders: state.purchaseOrders.map(p =>
                    p.id === id ? { ...p, status: 'cancelled' } : p
                )
            }));

            // Log Activity
            await get().logActivity(id, 'cancel', 'Hủy đơn hàng / Trả hàng');

            return true;
        } catch (err: any) {
            set({ error: err.message });
            return false;
        }
    },

    deletePurchaseOrder: async (id: string) => {
        if (!isSupabaseConfigured()) return false;

        try {
            const { error } = await supabase
                .from('purchase_orders')
                .delete()
                .eq('id', id);

            if (error) throw error;

            set(state => ({
                purchaseOrders: state.purchaseOrders.filter(po => po.id !== id)
            }));
            return true;
        } catch (err: any) {
            set({ error: err.message });
            return false;
        }
    },

    addPOItem: async (poId: string, item: Partial<PurchaseOrderItem>) => {
        if (!isSupabaseConfigured()) return false;

        try {
            const { error } = await supabase
                .from('purchase_order_items')
                .insert({
                    purchase_order_id: poId,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    sku: item.sku,
                    unit: item.unit || 'cái',
                    ordered_qty: item.ordered_qty || 0,
                    unit_price: item.unit_price || 0,
                    total: (item.ordered_qty || 0) * (item.unit_price || 0),
                });

            if (error) throw error;

            await get().getPurchaseOrder(poId);
            return true;
        } catch (err: any) {
            set({ error: err.message });
            return false;
        }
    },

    updatePOItem: async (itemId: string, updates: Partial<PurchaseOrderItem>) => {
        if (!isSupabaseConfigured()) return false;

        try {
            const { error } = await supabase
                .from('purchase_order_items')
                .update(updates)
                .eq('id', itemId);

            if (error) throw error;
            return true;
        } catch (err: any) {
            set({ error: err.message });
            return false;
        }
    },

    removePOItem: async (itemId: string) => {
        if (!isSupabaseConfigured()) return false;

        try {
            const { error } = await supabase
                .from('purchase_order_items')
                .delete()
                .eq('id', itemId);

            if (error) throw error;
            return true;
        } catch (err: any) {
            set({ error: err.message });
            return false;
        }
    },

    // Goods Receipts
    fetchGoodsReceipts: async () => {
        if (!isSupabaseConfigured()) return;

        set({ isLoading: true, error: null });
        try {
            const brandId = useBrandStore.getState().currentBrand?.id;
            if (!brandId) throw new Error('No brand selected');

            const { data, error } = await supabase
                .from('goods_receipts')
                .select(`*, suppliers(name), purchase_orders(po_number)`)
                .eq('brand_id', brandId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mapped = (data || []).map((gr: any) => ({
                ...gr,
                supplier_name: gr.suppliers?.name,
                po_number: gr.purchase_orders?.po_number,
            }));

            set({ goodsReceipts: mapped, isLoading: false });
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
        }
    },

    getGoodsReceipt: async (id: string) => {
        if (!isSupabaseConfigured()) return null;

        try {
            const { data: gr, error: grError } = await supabase
                .from('goods_receipts')
                .select(`*, suppliers(name)`)
                .eq('id', id)
                .single();

            if (grError) throw grError;

            const { data: items, error: itemsError } = await supabase
                .from('goods_receipt_items')
                .select('*')
                .eq('goods_receipt_id', id);

            if (itemsError) throw itemsError;

            const fullGR = {
                ...gr,
                supplier_name: gr.suppliers?.name,
                items: items || [],
            };

            set({ currentReceipt: fullGR });
            return fullGR;
        } catch (err: any) {
            set({ error: err.message });
            return null;
        }
    },

    createGoodsReceipt: async (poId: string) => {
        if (!isSupabaseConfigured()) return null;

        try {
            const po = await get().getPurchaseOrder(poId);
            if (!po) throw new Error('PO not found');

            // Try getting brandId/branchId from multiple sources (same as createPurchaseOrder)
            let brandId = useBrandStore.getState().currentBrand?.id;
            if (!brandId) {
                brandId = useAuthStore.getState().brandId || undefined;
            }

            let branchId = useBranchStore.getState().getCurrentBranch()?.id;
            if (!branchId) {
                branchId = useAuthStore.getState().branchId || undefined;
            }

            if (!brandId || !branchId) {
                console.error('createGoodsReceipt: Missing brandId or branchId', { brandId, branchId });
                throw new Error('Vui lòng đăng nhập lại hoặc chọn chi nhánh');
            }

            // Generate receipt number
            const { data: receiptNumber } = await supabase.rpc('generate_receipt_number', { p_brand_id: brandId });

            const { data: gr, error: grError } = await supabase
                .from('goods_receipts')
                .insert({
                    brand_id: brandId,
                    branch_id: branchId,
                    purchase_order_id: poId,
                    supplier_id: po.supplier_id,
                    receipt_number: receiptNumber || `GR-${Date.now()}`,
                    total_items: po.items?.length || 0,
                })
                .select()
                .single();

            if (grError) throw grError;

            // Create receipt items from PO items
            if (po.items && po.items.length > 0) {
                const grItems = po.items.map(item => ({
                    goods_receipt_id: gr.id,
                    purchase_order_item_id: item.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    sku: item.sku,
                    expected_qty: item.ordered_qty,
                    received_qty: item.ordered_qty, // Auto-receive full qty
                    // Use final_unit_cost (allocated) if available, otherwise base unit_price
                    unit_price: item.final_unit_cost || item.unit_price,
                }));

                await supabase.from('goods_receipt_items').insert(grItems);

                // Update stock immediately
                const { updateStockWithCost } = useProductStore.getState();
                for (const item of po.items) {
                    const qty = item.ordered_qty || 0;
                    const cost = item.final_unit_cost || item.unit_price || 0;
                    if (qty > 0) {
                        await updateStockWithCost(
                            item.product_id,
                            qty,
                            cost,
                            `Nhập hàng ${po.po_number}`,
                            poId
                        );
                    }
                }
            }

            // Update PO status to 'received' (goods have been received into inventory)
            await get().updatePOStatus(poId, 'received');

            // Log
            await get().logActivity(poId, 'import', `Đã nhập kho: ${gr.receipt_number}`);

            return gr;
        } catch (err: any) {
            set({ error: err.message });
            return null;
        }
    },

    updateReceiptItem: async (itemId: string, receivedQty: number, damagedQty = 0) => {
        if (!isSupabaseConfigured()) return false;

        try {
            const { data: item, error: fetchError } = await supabase
                .from('goods_receipt_items')
                .select('unit_price')
                .eq('id', itemId)
                .single();

            if (fetchError) throw fetchError;

            const { error } = await supabase
                .from('goods_receipt_items')
                .update({
                    received_qty: receivedQty,
                    damaged_qty: damagedQty,
                    total: receivedQty * (item?.unit_price || 0),
                })
                .eq('id', itemId);

            if (error) throw error;
            return true;
        } catch (err: any) {
            set({ error: err.message });
            return false;
        }
    },

    completeReceipt: async (id: string) => {
        if (!isSupabaseConfigured()) return false;

        try {
            const { error } = await supabase
                .from('goods_receipts')
                .update({ status: 'completed' })
                .eq('id', id);

            if (error) throw error;

            // Trigger stock and cost updates
            const items = await supabase
                .from('goods_receipt_items')
                .select('*')
                .eq('goods_receipt_id', id);

            if (items.data) {
                const { updateStockWithCost } = useProductStore.getState();
                for (const item of items.data) {
                    // Use final_unit_cost from PO Item if associated, else receipt item price (fallback)
                    // Currently we store unit_price in goods_receipt_items as the cost
                    await updateStockWithCost(
                        item.product_id,
                        item.received_qty,
                        item.unit_price, // This should be the final unit cost
                        `Nhập hàng PO: ${item.goods_receipt_id}`,
                        id
                    );
                }
            }

            await get().fetchGoodsReceipts();

            // Log
            const gr = await get().getGoodsReceipt(id);
            if (gr && gr.purchase_order_id) {
                await get().logActivity(gr.purchase_order_id, 'complete_import', `Hoàn thành nhập hàng: ${gr.receipt_number}`);
            }

            return true;
        } catch (err: any) {
            set({ error: err.message });
            return false;
        }
    },

    // Smart Ordering
    getSuggestedOrders: async () => {
        if (!isSupabaseConfigured()) return [];

        try {
            const brandId = useBrandStore.getState().currentBrand?.id;
            const branchId = useBranchStore.getState().getCurrentBranch()?.id;
            if (!brandId || !branchId) return [];

            // Get products that are low on stock
            const { data: lowStock, error: stockError } = await supabase
                .from('branch_inventory')
                .select(`
                    product_id,
                    quantity,
                    products(name, sku, min_stock, reorder_point)
                `)
                .eq('branch_id', branchId)
                .lte('quantity', 10); // Low stock threshold

            if (stockError) throw stockError;

            // Get supplier info for these products
            const productIds = lowStock?.map((ls: any) => ls.product_id) || [];

            const { data: supplierProducts } = await supabase
                .from('supplier_products')
                .select(`
                    product_id,
                    supplier_id,
                    last_import_price,
                    lead_time_days,
                    is_preferred,
                    suppliers(name)
                `)
                .eq('brand_id', brandId)
                .in('product_id', productIds);

            // Build suggestions
            const suggestions: SuggestedOrder[] = (lowStock || []).map((ls: any) => {
                const product = ls.products;
                const suppliers = supplierProducts?.filter((sp: any) => sp.product_id === ls.product_id) || [];
                const bestSupplier = suppliers.find((s: any) => s.is_preferred) || suppliers[0];

                return {
                    product_id: ls.product_id,
                    product_name: product?.name || 'Unknown',
                    sku: product?.sku || '',
                    current_stock: ls.quantity,
                    min_stock: product?.min_stock || 5,
                    suggested_qty: Math.max(20, (product?.reorder_point || 10) * 2),
                    best_supplier_id: bestSupplier?.supplier_id,
                    best_supplier_name: (bestSupplier?.suppliers as any)?.name,
                    best_price: bestSupplier?.last_import_price,
                    avg_daily_sales: 0, // Would need order history analysis
                    lead_time_days: bestSupplier?.lead_time_days || 3,
                };
            });

            return suggestions;
        } catch (err: any) {
            console.error('Error getting suggestions:', err);
            return [];
        }
    },

    autoCreatePO: async (supplierId: string, items: { productId: string; qty: number }[]) => {
        // Get product details and create PO
        const poItems: Partial<PurchaseOrderItem>[] = [];

        for (const item of items) {
            // Get product info
            const { data: product } = await supabase
                .from('products')
                .select('id, name, sku')
                .eq('id', item.productId)
                .single();

            // Get supplier price
            const { data: sp } = await supabase
                .from('supplier_products')
                .select('last_import_price')
                .eq('supplier_id', supplierId)
                .eq('product_id', item.productId)
                .single();

            if (product) {
                poItems.push({
                    product_id: product.id,
                    product_name: product.name,
                    sku: product.sku,
                    ordered_qty: item.qty,
                    unit_price: sp?.last_import_price || 0,
                });
            }
        }

        return get().createPurchaseOrder({ supplier_id: supplierId }, poItems);
    },

    // Activity Logs Implementation
    logActivity: async (orderId: string, action: string, description: string) => {
        if (!isSupabaseConfigured()) return;
        try {
            const user = useAuthStore.getState().user;
            const userName = user?.name || user?.email || 'Unknown';

            await supabase.from('order_activity_logs').insert({
                order_id: orderId,
                user_id: user?.id,
                user_name: userName,
                action,
                details: description
            });
        } catch (error) {
            console.error('Failed to log activity:', error);
        }
    },

    getActivityLogs: async (orderId: string) => {
        if (!isSupabaseConfigured()) return [];
        try {
            const { data, error } = await supabase
                .from('order_activity_logs')
                .select('*')
                .eq('order_id', orderId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as OrderActivityLog[];
        } catch (err: any) {
            console.error('Error fetching logs:', err);
            return [];
        }
    },

    // =========================================================================
    // REALTIME SUBSCRIPTION
    // =========================================================================
    subscribeToRealtimeUpdates: () => {
        if (!isSupabaseConfigured()) return;

        const brandId = useBrandStore.getState().currentBrand?.id || useAuthStore.getState().brandId;
        if (!brandId) {
            console.warn('[PO Store] Cannot subscribe: no brandId');
            return;
        }

        // Unsubscribe existing channel if any
        if (poRealtimeChannel) {
            supabase.removeChannel(poRealtimeChannel);
        }

        console.log('[PO Store] Subscribing to realtime updates for brand:', brandId);

        poRealtimeChannel = supabase
            .channel(`purchase_orders_${brandId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'purchase_orders',
                    filter: `brand_id=eq.${brandId}`
                },
                (payload) => {
                    console.log('[PO Store] Realtime event:', payload.eventType, payload);

                    const { eventType, new: newRecord, old: oldRecord } = payload;
                    const state = get();

                    if (eventType === 'INSERT') {
                        // Add new PO to list (if not already there)
                        const exists = state.purchaseOrders.find(po => po.id === (newRecord as any).id);
                        if (!exists) {
                            set({ purchaseOrders: [newRecord as PurchaseOrder, ...state.purchaseOrders] });
                        }
                    } else if (eventType === 'UPDATE') {
                        // Update existing PO in list
                        set({
                            purchaseOrders: state.purchaseOrders.map(po =>
                                po.id === (newRecord as any).id ? { ...po, ...newRecord } : po
                            )
                        });
                    } else if (eventType === 'DELETE') {
                        // Remove PO from list
                        set({
                            purchaseOrders: state.purchaseOrders.filter(po => po.id !== (oldRecord as any).id)
                        });
                    }
                }
            )
            .subscribe((status) => {
                console.log('[PO Store] Realtime subscription status:', status);
            });
    },

    unsubscribeFromRealtimeUpdates: () => {
        if (poRealtimeChannel) {
            console.log('[PO Store] Unsubscribing from realtime updates');
            supabase.removeChannel(poRealtimeChannel);
            poRealtimeChannel = null;
        }
    },
}));

// Module-level variable to hold the realtime channel
let poRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;
