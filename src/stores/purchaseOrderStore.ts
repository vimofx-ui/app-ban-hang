// =============================================================================
// PURCHASE ORDER STORE - Enhanced Stock In Management
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useProductStore } from '@/stores/productStore';
import { useSupplierStore } from '@/stores/supplierStore';
import { useDebtStore } from '@/stores/debtStore';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useBrandStore } from '@/stores/brandStore';
import type { PurchaseOrder, PurchaseOrderItem } from '@/types';
import { generateId, generateOrderNumber } from '@/lib/utils';
import {
    updateSupplierProductMapping,
    getProductsNeedingReorder,
    groupProductsBySupplier,
    type ProductForecast,
    type SmartPOInput
} from '@/utils/forecast';

// Activity Log Entry for history timeline
export interface ActivityLogEntry {
    id: string;
    timestamp: string;
    action: string;
    user: string;
    details?: string;
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
    items: PurchaseOrderItem[];
    supplier_name?: string;

    // Enhanced fields (only new ones not in base PurchaseOrder)
    payment_status: 'unpaid' | 'partial' | 'paid';
    paid_amount: number;
    reference: string;
    assigned_to: string;
    branch_name: string;
    import_cost: number;
    discount_value: number;
    receipt_number?: string; // New field for Phieu Nhap ID
    history: ActivityLogEntry[];
}

// Status types for filtering
export type POStatus = 'draft' | 'confirmed' | 'received' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface CreateOrderInput {
    supplier_id?: string;
    items: Array<{ product_id: string; quantity: number; unit_price: number; product_name?: string }>;
    notes?: string;
    tags?: string[];
    invoice_images?: string[]; // Base64 or URLs of invoice images
    expected_date?: string;
    assigned_to?: string;
    is_draft?: boolean;
    total_amount?: number;
    auto_receive?: boolean;
}

export interface PurchaseOrderState {
    orders: PurchaseOrderWithItems[];
    isLoading: boolean;
    selectedOrderId: string | null;

    loadOrders: () => Promise<void>;
    createOrder: (input: CreateOrderInput) => Promise<PurchaseOrderWithItems>;
    updateOrder: (orderId: string, updates: Partial<PurchaseOrderWithItems>, items?: CreateOrderInput['items']) => Promise<void>;
    duplicateOrder: (orderId: string) => Promise<PurchaseOrderWithItems | null>;
    saveDraft: (input: CreateOrderInput) => Promise<PurchaseOrderWithItems>;
    confirmOrder: (orderId: string) => Promise<void>;
    receiveOrder: (orderId: string) => Promise<void>;
    returnOrder: (orderId: string, returnItems: Array<{ product_id: string; quantity: number }>, reason?: string) => Promise<void>;
    cancelOrder: (orderId: string) => Promise<void>;
    processPayment: (orderId: string, amount: number) => Promise<void>;
    addNote: (orderId: string, note: string) => Promise<void>;
    getOrderById: (id: string) => PurchaseOrderWithItems | undefined;
    setSelectedOrder: (id: string | null) => void;

    // Smart PO functions
    loadSmartPOSuggestions: () => Promise<ProductForecast[]>;
    createSmartPOs: () => Promise<PurchaseOrderWithItems[]>;
    smartPOSuggestions: ProductForecast[];
    isLoadingSmartPO: boolean;
}

export const usePurchaseOrderStore = create<PurchaseOrderState>()(
    persist(
        (set, get) => ({
            orders: [],
            isLoading: false,
            selectedOrderId: null,
            smartPOSuggestions: [],
            isLoadingSmartPO: false,

            loadOrders: async () => {
                set({ isLoading: true });

                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { data, error } = await supabase
                            .from('purchase_orders')
                            .select(`
                                *,
                                suppliers(name),
                                purchase_order_items(*)
                            `)
                            .order('created_at', { ascending: false });

                        if (error) throw error;

                        const orders = (data || []).map((o: Record<string, unknown>) => ({
                            ...o,
                            supplier_name: (o.suppliers as Record<string, string>)?.name,
                            items: o.purchase_order_items || [],
                            payment_status: (o.payment_status as PaymentStatus) || 'unpaid',
                            paid_amount: (o.paid_amount as number) || 0,
                            notes: (o.notes as string) || '',
                            expected_date: (o.expected_date as string) || null,
                            reference: (o.reference as string) || '',
                            assigned_to: (o.assigned_to as string) || 'Admin',
                            branch_name: (o.branch_name as string) || 'Cửa hàng chính',
                            import_cost: (o.import_cost as number) || 0,
                            discount_value: (o.discount_value as number) || 0,
                            receipt_number: (o.receipt_number as string) || null,
                            history: (o.history as ActivityLogEntry[]) || [],
                        })) as PurchaseOrderWithItems[];

                        set({ orders, isLoading: false });
                    } catch (err) {
                        console.error('Failed to load purchase orders:', err);
                        set({ isLoading: false });
                    }
                } else {
                    set({ orders: get().orders, isLoading: false });
                }
            },

            createOrder: async (input) => {
                const orderId = generateId();
                const orderNumber = generateOrderNumber('REI');
                const now = new Date().toISOString();

                const orderItems: PurchaseOrderItem[] = input.items.map((item) => ({
                    id: generateId(),
                    purchase_order_id: orderId,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    received_quantity: 0,
                    unit_price: item.unit_price,
                    total_price: item.quantity * item.unit_price,
                    created_at: now,
                }));

                const subtotal = orderItems.reduce((sum, i) => sum + i.total_price, 0);

                const currentUser = useAuthStore.getState().user;
                const assignedToName = input.assigned_to || currentUser?.name || 'Admin';

                const newOrder: PurchaseOrderWithItems = {
                    id: orderId,
                    po_number: orderNumber,
                    supplier_id: input.supplier_id,
                    status: input.is_draft ? 'draft' : 'confirmed',
                    subtotal,
                    discount_amount: 0,
                    discount_percent: 0,
                    tax_amount: 0,
                    total_amount: subtotal,
                    created_at: now,
                    items: orderItems,
                    payment_status: 'unpaid',
                    paid_amount: 0,
                    points_used: 0,
                    points_discount: 0,
                    notes: input.notes || '',
                    tags: input.tags || [],
                    invoice_images: input.invoice_images || [],
                    expected_date: input.expected_date || undefined,
                    reference: '',
                    assigned_to: assignedToName,
                    branch_name: 'Cửa hàng chính',
                    import_cost: 0,
                    discount_value: 0,
                    history: [{
                        id: generateId(),
                        timestamp: now,
                        action: 'Thêm mới đơn nhập hàng',
                        user: assignedToName
                    }]
                };

                const currentBranch = useBranchStore.getState().currentBranch;
                const currentBrand = useBrandStore.getState().currentBrand;

                if (isSupabaseConfigured() && supabase) {
                    try {
                        await supabase.from('purchase_orders').insert({
                            id: orderId,
                            po_number: orderNumber,
                            supplier_id: input.supplier_id,
                            status: newOrder.status,
                            subtotal,
                            total_amount: subtotal,
                            payment_status: 'unpaid',
                            notes: input.notes || '',
                            expected_date: input.expected_date || null,
                            created_by: currentUser?.id,
                            assigned_to: assignedToName,
                            brand_id: currentBrand?.id,
                            branch_id: currentBranch?.id
                        });

                        await supabase.from('purchase_order_items').insert(
                            orderItems.map((i) => ({
                                purchase_order_id: orderId,
                                product_id: i.product_id,
                                quantity: i.quantity,
                                unit_price: i.unit_price,
                                total_price: i.total_price,
                            }))
                        );
                    } catch (err) {
                        console.error('Failed to save purchase order:', err);
                    }
                }

                set((state) => ({ orders: [newOrder, ...state.orders] }));

                // Auto receive if requested (and not draft)
                if (input.auto_receive && !input.is_draft) {
                    await get().receiveOrder(orderId);
                    return get().getOrderById(orderId) || newOrder;
                }

                return newOrder;
            },

            updateOrder: async (orderId, updates, items) => {
                const order = get().getOrderById(orderId);
                if (!order) return;

                let newItems = order.items;
                let subtotal = order.subtotal;

                if (items) {
                    newItems = items.map((item) => ({
                        id: generateId(),
                        created_at: new Date().toISOString(),
                        purchase_order_id: orderId,
                        product_id: item.product_id,
                        quantity: item.quantity,
                        received_quantity: 0,
                        unit_price: item.unit_price,
                        total_price: item.quantity * item.unit_price,

                    }));
                    subtotal = newItems.reduce((sum, i) => sum + i.total_price, 0);
                }

                const updatedOrder: PurchaseOrderWithItems = {
                    ...order,
                    ...updates,
                    items: newItems,
                    subtotal,
                    discount_percent: order.discount_percent || 0,
                    total_amount: subtotal - (updates.discount_value || order.discount_value || 0) + (updates.import_cost || order.import_cost || 0),
                    history: [
                        ...order.history,
                        {
                            id: generateId(),
                            timestamp: new Date().toISOString(),
                            action: 'Cập nhật đơn nhập hàng',
                            user: useAuthStore.getState().user?.name || order.assigned_to || 'Admin'
                        }
                    ]
                };

                if (isSupabaseConfigured() && supabase) {
                    await supabase.from('purchase_orders').update({
                        status: updatedOrder.status,
                        subtotal: updatedOrder.subtotal,
                        total_amount: updatedOrder.total_amount,
                        notes: updatedOrder.notes
                    }).eq('id', orderId);

                    if (items) {
                        // Replace items logic (delete all and insert new)
                        await supabase.from('purchase_order_items').delete().eq('purchase_order_id', orderId);
                        await supabase.from('purchase_order_items').insert(
                            newItems.map(i => ({
                                purchase_order_id: orderId,
                                product_id: i.product_id,
                                quantity: i.quantity,
                                unit_price: i.unit_price,
                                total_price: i.total_price
                            }))
                        );
                    }
                }

                set((state) => ({
                    orders: state.orders.map((o) => o.id === orderId ? updatedOrder : o)
                }));
            },

            duplicateOrder: async (orderId) => {
                const order = get().getOrderById(orderId);
                if (!order) return null;

                const newOrderInput: CreateOrderInput = {
                    supplier_id: order.supplier_id,
                    items: order.items.map(i => ({
                        product_id: i.product_id,
                        quantity: i.quantity,
                        unit_price: i.unit_price
                    })),
                    notes: `Sao chép từ ${order.po_number}`,
                    is_draft: true
                };

                return get().createOrder(newOrderInput);
            },

            saveDraft: async (input) => {
                return get().createOrder({ ...input, is_draft: true });
            },

            confirmOrder: async (orderId) => {
                const order = get().getOrderById(orderId);
                if (!order) return;

                const now = new Date().toISOString();
                const updates = { status: 'confirmed' as const };

                if (isSupabaseConfigured() && supabase) {
                    await supabase.from('purchase_orders').update(updates).eq('id', orderId);
                }

                set((state) => ({
                    orders: state.orders.map((o) =>
                        o.id === orderId
                            ? {
                                ...o,
                                ...updates,
                                history: [...o.history, {
                                    id: generateId(),
                                    timestamp: now,
                                    action: 'Xác nhận đơn nhập hàng',
                                    user: useAuthStore.getState().user?.name || o.assigned_to || 'Admin'
                                }]
                            }
                            : o
                    ),
                }));
            },

            receiveOrder: async (orderId) => {
                const order = get().getOrderById(orderId);
                if (!order) return;

                // Update stock for each item with cost tracking
                const productStore = useProductStore.getState();
                for (const item of order.items) {
                    // Use updateStockWithCost to calculate weighted average cost
                    await productStore.updateStockWithCost(
                        item.product_id,
                        item.quantity,
                        item.unit_price, // Purchase price for this batch
                        `Nhập hàng - ${order.po_number}`,
                        order.id
                    );
                }

                // SUPPLIER DEBT SYNC: Add unpaid amount to supplier's debt
                const unpaidAmount = order.total_amount - order.paid_amount;
                if (unpaidAmount > 0 && order.supplier_id) {
                    // Update supplier debt balance
                    await useSupplierStore.getState().addDebt(order.supplier_id, unpaidAmount);
                }

                // Generate Receipt Number (PN + Random)
                const receiptNumber = generateOrderNumber('PN');
                const now = new Date().toISOString();
                const updates = {
                    status: 'received' as const,
                    received_date: now,
                    receipt_number: receiptNumber
                };

                if (isSupabaseConfigured() && supabase) {
                    const userId = useAuthStore.getState().user?.id;
                    await supabase.from('purchase_orders').update({ ...updates, received_by: userId }).eq('id', orderId);
                    for (const item of order.items) {
                        await supabase.from('purchase_order_items')
                            .update({ received_quantity: item.quantity })
                            .eq('id', item.id);
                    }

                    // Update supplier-product mappings
                    if (order.supplier_id) {
                        const mappingItems = order.items.map(item => ({
                            product_id: item.product_id,
                            unit_price: item.unit_price,
                            received_quantity: item.quantity
                        }));
                        await updateSupplierProductMapping(order.supplier_id, mappingItems);
                    }
                }

                set((state) => ({
                    orders: state.orders.map((o) =>
                        o.id === orderId
                            ? {
                                ...o,
                                ...updates,
                                items: o.items.map((i) => ({ ...i, received_quantity: i.quantity })),
                                history: [...o.history, {
                                    id: generateId(),
                                    timestamp: now,
                                    action: 'Xác nhận nhập kho đơn nhập',
                                    user: o.assigned_to || 'Admin'
                                }]
                            }
                            : o
                    ),
                }));
            },

            cancelOrder: async (orderId) => {
                const order = get().getOrderById(orderId);
                if (!order) return;

                if (isSupabaseConfigured() && supabase) {
                    await supabase.from('purchase_orders').update({ status: 'cancelled' }).eq('id', orderId);
                }

                set((state) => ({
                    orders: state.orders.map((o) =>
                        o.id === orderId
                            ? {
                                ...o,
                                status: 'cancelled',
                                history: [...o.history, {
                                    id: generateId(),
                                    timestamp: new Date().toISOString(),
                                    action: 'Hủy đơn nhập hàng',
                                    user: useAuthStore.getState().user?.name || o.assigned_to || 'Admin'
                                }]
                            }
                            : o
                    ),
                }));
            },

            returnOrder: async (orderId, returnItems, reason) => {
                const order = get().getOrderById(orderId);
                if (!order || order.status !== 'received') return;

                // Deduct stock for each returned item
                const productStore = useProductStore.getState();
                for (const item of returnItems) {
                    await productStore.updateStock(
                        item.product_id,
                        -item.quantity, // Negative to deduct
                        `Trả hàng - ${order.po_number}${reason ? ` (${reason})` : ''}`,
                        'return'
                    );
                }

                const now = new Date().toISOString();
                const totalReturnQty = returnItems.reduce((sum, i) => sum + i.quantity, 0);

                if (isSupabaseConfigured() && supabase) {
                    // Update return info in database
                    await supabase.from('purchase_orders').update({
                        returned_at: now,
                        return_reason: reason || null
                    }).eq('id', orderId);
                }

                set((state) => ({
                    orders: state.orders.map((o) =>
                        o.id === orderId
                            ? {
                                ...o,
                                items: o.items.map((i) => {
                                    const returnItem = returnItems.find(r => r.product_id === i.product_id);
                                    if (returnItem) {
                                        return { ...i, returned_quantity: (i.returned_quantity || 0) + returnItem.quantity };
                                    }
                                    return i;
                                }),
                                history: [...o.history, {
                                    id: generateId(),
                                    timestamp: now,
                                    action: 'Trả hàng',
                                    user: useAuthStore.getState().user?.name || o.assigned_to || 'Admin',
                                    details: `Số lượng: ${totalReturnQty}${reason ? ` - Lý do: ${reason}` : ''}`
                                }]
                            }
                            : o
                    ),
                }));
            },

            processPayment: async (orderId, amount) => {
                const order = get().getOrderById(orderId);
                if (!order) return;

                const newPaidAmount = order.paid_amount + amount;
                const remainingAmount = order.total_amount - newPaidAmount;
                let paymentStatus: PaymentStatus = 'unpaid';

                if (remainingAmount <= 0) {
                    paymentStatus = 'paid';
                } else if (newPaidAmount > 0) {
                    paymentStatus = 'partial';
                }

                const now = new Date().toISOString();

                if (isSupabaseConfigured() && supabase) {
                    await supabase.from('purchase_orders').update({
                        paid_amount: newPaidAmount,
                        payment_status: paymentStatus
                    }).eq('id', orderId);
                }

                // SUPPLIER DEBT SYNC: Reduce supplier debt
                if (order.supplier_id) {
                    await useSupplierStore.getState().payDebt(order.supplier_id, amount);

                    // Also record in debt store as a payment
                    useDebtStore.getState().addPayment({
                        payment_type: 'supplier',
                        supplier_id: order.supplier_id,
                        purchase_order_id: orderId, // Link to PO
                        amount: amount,
                        payment_method: 'cash', // Defaulting to cash for now as PO doesn't specify method in this function
                        debt_before: 0, // Should ideally fetch current debt, but payDebt handles the logic
                        debt_after: 0, // debtStore will just record the log
                        notes: `Thanh toán cho đơn nhập ${order.po_number}`
                    });
                }

                set((state) => ({
                    orders: state.orders.map((o) =>
                        o.id === orderId
                            ? {
                                ...o,
                                paid_amount: newPaidAmount,
                                payment_status: paymentStatus,
                                history: [...o.history, {
                                    id: generateId(),
                                    timestamp: now,
                                    action: `Thanh toán cho đơn nhập hàng`,
                                    user: useAuthStore.getState().user?.name || o.assigned_to || 'Admin',
                                    details: `Số tiền: ${amount.toLocaleString()}đ`
                                }]
                            }
                            : o
                    ),
                }));
            },

            addNote: async (orderId, note) => {
                const order = get().getOrderById(orderId);
                if (!order) return;

                set((state) => ({
                    orders: state.orders.map((o) =>
                        o.id === orderId
                            ? { ...o, notes: note }
                            : o
                    ),
                }));
            },

            getOrderById: (id) => get().orders.find((o) => o.id === id),

            setSelectedOrder: (id) => set({ selectedOrderId: id }),

            // =============================================================================
            // SMART PO FUNCTIONS
            // =============================================================================

            loadSmartPOSuggestions: async () => {
                set({ isLoadingSmartPO: true });
                try {
                    const suggestions = await getProductsNeedingReorder();
                    set({ smartPOSuggestions: suggestions, isLoadingSmartPO: false });
                    return suggestions;
                } catch (err) {
                    console.error('Failed to load smart PO suggestions:', err);
                    set({ isLoadingSmartPO: false });
                    return [];
                }
            },

            createSmartPOs: async () => {
                const suggestions = get().smartPOSuggestions;
                if (suggestions.length === 0) {
                    // Load suggestions if not already loaded
                    const loaded = await get().loadSmartPOSuggestions();
                    if (loaded.length === 0) return [];
                }

                const currentSuggestions = get().smartPOSuggestions;
                const groupedBySupplier = groupProductsBySupplier(currentSuggestions);
                const createdOrders: PurchaseOrderWithItems[] = [];

                for (const group of groupedBySupplier) {
                    try {
                        const order = await get().createOrder({
                            supplier_id: group.supplier_id,
                            items: group.products.map(p => ({
                                product_id: p.product_id,
                                product_name: p.product_name,
                                quantity: p.quantity,
                                unit_price: p.unit_price
                            })),
                            notes: 'Đơn hàng tự động từ hệ thống Smart PO - Sản phẩm hết/sắp hết hàng',
                            is_draft: true // Create as draft for review
                        });
                        createdOrders.push(order);
                    } catch (err) {
                        console.error('Failed to create smart PO for supplier:', group.supplier_id, err);
                    }
                }

                // Clear suggestions after creating POs
                set({ smartPOSuggestions: [] });

                return createdOrders;
            },
        }),
        {
            name: 'purchase-order-store',
            // Exclude invoice_images from persistence to avoid localStorage quota issues
            partialize: (state) => ({
                orders: state.orders.map(order => ({
                    ...order,
                    invoice_images: undefined // Don't store large base64 images
                }))
            }),
        }
    )
);
