// =============================================================================
// POS STORE - Main Point of Sale State Management
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '@/lib/utils';
import type { Product, Customer, Order, OrderItem, PaymentMethod, Shift } from '@/types';
import { logGhostScan, logCartCleared, logQuantityChange, logDiscountChange } from '@/lib/ghostScan';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from './authStore';
import { useUserStore } from './userStore';
import { useOrderStore } from './orderStore';
import { useShiftStore } from './shiftStore';
import { useProductStore } from './productStore';
import { useCategoryStore } from './categoryStore';
import { useCustomerStore } from './customerStore';
import { useSettingsStore } from './settingsStore';
import { useOfflineStore } from './offlineStore';
import { useLoyaltyStore } from './loyaltyStore';

// ============= Types =============
export interface CartItem extends OrderItem {
    product: Product;
    unitName?: string;
    conversionRate?: number; // How many base units in this unit (1 for base)
    selectedUnitId?: string; // ID of ProductUnit if not base unit
}

export interface DraftOrder {
    id: string;
    timestamp: string;
    note?: string;
    order: Partial<Order>;
    items: CartItem[];
    customer: Customer | null;
}

interface POSState {
    // Current Transaction State
    cartItems: CartItem[];
    currentOrder: Partial<Order> | null;
    customer: Customer | null;

    // Financials
    subtotal: number;
    discountAmount: number;
    pointsUsed: number;
    pointsDiscount: number;
    taxRate: number;
    taxAmount: number;
    total: number;

    // Payment
    cashReceived: number;
    change: number;
    paymentMethod: PaymentMethod | null;

    // UI & System State
    isSubmitting: boolean;
    currentShiftId: string | null;
    currentUserId: string | null;
    wholesaleMode: boolean; // Wholesale pricing mode

    // Draft Orders
    draftOrders: DraftOrder[];

    // Actions
    addItem: (product: Product, quantity?: number, unitPrice?: number) => void;
    addItemWithUnit: (product: Product, quantity: number, unitName: string, unitPrice: number, conversionRate: number, unitId?: string) => void;
    updateItemQuantity: (itemId: string, quantity: number) => void;
    removeItem: (itemId: string, reason?: string) => void;
    updateItemNote: (itemId: string, note: string) => void;
    updateItemUnit: (itemId: string, unitName: string) => void;
    updateItemDiscount: (itemId: string, discount: number, reason?: string) => void;
    updateItemPrice: (itemId: string, price: number) => void;
    clearCart: (reason?: string) => void;

    setCustomer: (customer: Customer | null) => void;

    // Discounts
    setDiscount: (amount: number) => void;
    setPointsDiscount: (points: number, amount: number) => void;
    setTaxRate: (rate: number) => void;

    setPaymentMethod: (method: PaymentMethod) => void;
    setCashReceived: (amount: number) => void;

    // Order Management
    parkOrder: (note?: string) => void;
    resumeOrder: (id: string) => void;
    deleteDraftOrder: (id: string, reason?: string) => void;

    toggleWholesaleMode: () => void;
    setWholesaleMode: (enabled: boolean) => void;

    submitOrder: (orderData?: any) => Promise<Order | null>;
    sanitizeState: () => void;
    loadFromOrder: (order: Order, editMode?: boolean) => void;
    isEditMode: boolean;
}

// Initial State
const initialState = {
    cartItems: [],
    currentOrder: null,
    customer: null,
    subtotal: 0,
    discountAmount: 0,
    pointsUsed: 0,
    pointsDiscount: 0,
    taxRate: 0,
    taxAmount: 0,
    total: 0,
    cashReceived: 0,
    change: 0,
    paymentMethod: null as PaymentMethod | null,
    currentShiftId: null,
    currentUserId: null,
    draftOrders: [],
    isSubmitting: false,
    wholesaleMode: false,
    isEditMode: false,
};

// ============= Store =============
export const usePOSStore = create<POSState>()(
    persist(
        (set, get) => ({
            ...initialState,

            // Add item to cart
            addItem: (product: Product, quantity = 1, unitPrice?: number) => {
                set((state) => {
                    // Determine price: unitPrice override > wholesaleMode > selling_price
                    let price = unitPrice;
                    if (price === undefined) {
                        if (state.wholesaleMode && product.wholesale_price && product.wholesale_price > 0) {
                            price = product.wholesale_price;
                        } else {
                            price = product.selling_price;
                        }
                    }

                    const existingIndex = state.cartItems.findIndex(
                        (item) => item.product_id === product.id && item.unit_price === price
                    );

                    let newItems: CartItem[];

                    if (existingIndex >= 0) {
                        // Update existing item AND move to top of list
                        const existingItem = state.cartItems[existingIndex];
                        const updatedItem = {
                            ...existingItem,
                            quantity: existingItem.quantity + quantity,
                            total_price: (existingItem.quantity + quantity) * existingItem.unit_price,
                        };
                        // Remove from current position and add to TOP
                        const otherItems = state.cartItems.filter((_, idx) => idx !== existingIndex);
                        newItems = [updatedItem, ...otherItems];
                    } else {
                        // Add new item at TOP of list
                        const newItem: CartItem = {
                            id: generateId(),
                            order_id: state.currentOrder?.id ? String(state.currentOrder.id) : generateId(),
                            product_id: product.id,
                            unit_id: undefined,
                            quantity: quantity,
                            unit_price: price,
                            discount_amount: 0,
                            total_price: price * quantity,
                            returned_quantity: 0,
                            created_at: new Date().toISOString(),
                            product: product,
                            unitName: product.base_unit || 'Cái',
                        };
                        newItems = [newItem, ...state.cartItems];
                    }

                    const subtotal = newItems.reduce((sum, item) => sum + item.total_price, 0);
                    const total = subtotal - state.discountAmount;

                    return {
                        cartItems: newItems,
                        subtotal,
                        total,
                        change: state.cashReceived - total,
                    };
                });
            },

            // Add item with specific unit (for unit conversion products)
            addItemWithUnit: (product: Product, quantity: number, unitName: string, unitPrice: number, conversionRate: number, unitId?: string) => {
                set((state) => {
                    // Check for existing item with same product AND same unit
                    const existingIndex = state.cartItems.findIndex(
                        (item) => item.product_id === product.id && item.unitName === unitName
                    );

                    let newItems: CartItem[];

                    if (existingIndex >= 0) {
                        // Update existing item AND move to top of list
                        const existingItem = state.cartItems[existingIndex];
                        const updatedItem = {
                            ...existingItem,
                            quantity: existingItem.quantity + quantity,
                            total_price: (existingItem.quantity + quantity) * existingItem.unit_price,
                        };
                        // Remove from current position and add to TOP
                        const otherItems = state.cartItems.filter((_, idx) => idx !== existingIndex);
                        newItems = [updatedItem, ...otherItems];
                    } else {
                        // Add new item with unit info at TOP of list
                        const newItem: CartItem = {
                            id: generateId(),
                            order_id: state.currentOrder?.id ? String(state.currentOrder.id) : generateId(),
                            product_id: product.id,
                            unit_id: unitId,
                            quantity: quantity,
                            unit_price: unitPrice,
                            discount_amount: 0,
                            total_price: unitPrice * quantity,
                            returned_quantity: 0,
                            created_at: new Date().toISOString(),
                            product: product,
                            unitName: unitName,
                            conversionRate: conversionRate,
                            selectedUnitId: unitId,
                        };
                        newItems = [newItem, ...state.cartItems];
                    }

                    const subtotal = newItems.reduce((sum, item) => sum + item.total_price, 0);
                    const total = subtotal - state.discountAmount;

                    return {
                        cartItems: newItems,
                        subtotal,
                        total,
                        change: state.cashReceived - total,
                    };
                });
            },

            // Update item quantity
            updateItemQuantity: (itemId: string, quantity: number) => {
                const state = get();
                const item = state.cartItems.find((i) => i.id === itemId);

                if (!item) return;

                // Log if quantity decreased (potential ghost scan)
                // Use optional chaining for safety if logging fails
                if (quantity < item.quantity) {
                    try {
                        logQuantityChange({
                            item,
                            product: item.product,
                            oldQuantity: item.quantity,
                            newQuantity: quantity,
                            shiftId: state.currentShiftId || undefined,
                            orderId: state.currentOrder?.id,
                            userId: useAuthStore.getState().user?.id,
                        });
                    } catch (e) { console.error('Log failed', e); }
                }

                if (quantity <= 0) {
                    // Remove item completely
                    get().removeItem(itemId, 'Số lượng về 0');
                    return;
                }

                set((state) => {
                    const newItems = state.cartItems.map((item) =>
                        item.id === itemId
                            ? {
                                ...item,
                                quantity,
                                total_price: quantity * item.unit_price,
                            }
                            : item
                    );

                    const subtotal = newItems.reduce((sum, item) => sum + item.total_price, 0);
                    const total = subtotal - state.discountAmount;

                    return {
                        cartItems: newItems,
                        subtotal,
                        total,
                        change: state.cashReceived - total,
                    };
                });
            },

            updateItemNote: (itemId: string, note: string) => {
                set((state) => ({
                    cartItems: state.cartItems.map((item) =>
                        item.id === itemId ? { ...item, notes: note } : item
                    ),
                }));
            },

            updateItemUnit: (itemId: string, unitName: string) => {
                set((state) => ({
                    cartItems: state.cartItems.map((item) =>
                        item.id === itemId ? { ...item, unitName } : item
                    ),
                }));
            },

            updateItemDiscount: (itemId: string, discount: number, reason?: string) => {
                const state = get();
                const item = state.cartItems.find(i => i.id === itemId);
                if (item && item.discount_amount !== discount) {
                    try {
                        logDiscountChange({
                            item,
                            product: item.product,
                            oldDiscount: item.discount_amount,
                            newDiscount: discount,
                            reason,
                            shiftId: state.currentShiftId || undefined,
                            orderId: state.currentOrder?.id,
                            userId: useAuthStore.getState().user?.id,
                        });
                    } catch (e) { console.error('Log failed', e); }
                }

                set((state) => {
                    const newItems = state.cartItems.map((item) => {
                        if (item.id === itemId) {
                            return {
                                ...item,
                                discount_amount: discount,
                                total_price: (item.quantity * item.unit_price) - discount,
                                notes: reason ? reason : item.notes
                            };
                        }
                        return item;
                    });
                    const subtotal = newItems.reduce((sum, item) => sum + item.total_price, 0);
                    const total = subtotal - state.discountAmount;
                    return {
                        cartItems: newItems,
                        subtotal,
                        total,
                        change: state.cashReceived - total,
                    };
                });
            },

            // Update item price directly
            updateItemPrice: (itemId: string, price: number) => {
                set((state) => {
                    const newItems = state.cartItems.map((item) => {
                        if (item.id === itemId) {
                            return {
                                ...item,
                                unit_price: price,
                                // Recalculate total price: (qty * new_price) - existing_discount
                                total_price: (item.quantity * price) - item.discount_amount,
                            };
                        }
                        return item;
                    });
                    const subtotal = newItems.reduce((sum, item) => sum + item.total_price, 0);
                    const total = subtotal - state.discountAmount;
                    return {
                        cartItems: newItems,
                        subtotal,
                        total,
                        change: state.cashReceived - total,
                    };
                });
            },

            // Remove item from cart (with Ghost Scan logging)
            removeItem: (itemId: string, reason?: string) => {
                const state = get();
                const item = state.cartItems.find((i) => i.id === itemId);

                if (item) {
                    // Log ghost scan
                    try {
                        logGhostScan({
                            item,
                            product: item.product,
                            reason,
                            shiftId: state.currentShiftId || undefined,
                            orderId: state.currentOrder?.id,
                            userId: useAuthStore.getState().user?.id,
                        });
                    } catch (e) { console.error('Log failed', e); }
                }

                set((state) => {
                    const newItems = state.cartItems.filter((item) => item.id !== itemId);
                    const subtotal = newItems.reduce((sum, item) => sum + item.total_price, 0);
                    const total = subtotal - state.discountAmount;

                    return {
                        cartItems: newItems,
                        subtotal,
                        total,
                        change: state.cashReceived - total,
                    };
                });
            },

            // Wholesale Mode Actions
            toggleWholesaleMode: () => {
                set((state) => {
                    const newMode = !state.wholesaleMode;
                    const newItems = state.cartItems.map((item) => {
                        // Only update items using base unit (no selectedUnitId)
                        // If item has selectedUnitId, it means it's a specific unit, we skip for now 
                        // unless we want to support wholesale price per unit (requires data structure change)
                        if (!item.selectedUnitId) {
                            let newPrice = item.unit_price;

                            if (newMode) {
                                // Switching TO Wholesale
                                if (item.product.wholesale_price && item.product.wholesale_price > 0) {
                                    newPrice = item.product.wholesale_price;
                                }
                            } else {
                                // Switching TO Retail
                                // Revert to selling price
                                newPrice = item.product.selling_price;
                            }

                            if (newPrice !== item.unit_price) {
                                return {
                                    ...item,
                                    unit_price: newPrice,
                                    total_price: (item.quantity * newPrice) - item.discount_amount,
                                };
                            }
                        }
                        return item;
                    });

                    const subtotal = newItems.reduce((sum, item) => sum + item.total_price, 0);
                    const total = subtotal - state.discountAmount;

                    return {
                        wholesaleMode: newMode,
                        cartItems: newItems,
                        subtotal,
                        total,
                        change: state.cashReceived - total,
                    };
                });
            },

            setWholesaleMode: (enabled: boolean) => {
                set((state) => {
                    if (state.wholesaleMode === enabled) return {}; // No change

                    // Reuse logic from toggle? Or duplicate logic for clarity/safety?
                    // Let's duplicate to ensure "enabled" target is respected.
                    const newMode = enabled;
                    const newItems = state.cartItems.map((item) => {
                        if (!item.selectedUnitId) {
                            let newPrice = item.unit_price;
                            if (newMode) {
                                if (item.product.wholesale_price && item.product.wholesale_price > 0) {
                                    newPrice = item.product.wholesale_price;
                                }
                            } else {
                                newPrice = item.product.selling_price;
                            }
                            if (newPrice !== item.unit_price) {
                                return {
                                    ...item,
                                    unit_price: newPrice,
                                    total_price: (item.quantity * newPrice) - item.discount_amount,
                                };
                            }
                        }
                        return item;
                    });

                    const subtotal = newItems.reduce((sum, item) => sum + item.total_price, 0);
                    const total = subtotal - state.discountAmount;

                    return {
                        wholesaleMode: newMode,
                        cartItems: newItems,
                        subtotal,
                        total,
                        change: state.cashReceived - total,
                    };
                });
            },

            // Clear entire cart (with Ghost Scan logging)
            clearCart: (reason?: string) => {
                const state = get();

                if (state.cartItems.length > 0) {
                    // Log cart cleared
                    try {
                        logCartCleared({
                            items: state.cartItems.map((item) => ({
                                product: item.product,
                                item,
                            })),
                            reason,
                            shiftId: state.currentShiftId || undefined,
                            orderId: state.currentOrder?.id,
                            userId: useAuthStore.getState().user?.id,
                        });
                    } catch (e) { console.error('Log failed', e); }
                }

                set({
                    cartItems: [],
                    subtotal: 0,
                    total: 0,
                    discountAmount: 0,
                    change: 0,
                    cashReceived: 0,
                    paymentMethod: null,
                    customer: null,
                });
            },

            // Set customer
            setCustomer: (customer: Customer | null) => {
                set({ customer });
            },

            // Load items from an existing order (for copy or edit functionality)
            loadFromOrder: (order: Order, editMode = false) => {
                const productStore = useProductStore.getState();
                const customerStore = useCustomerStore.getState();

                // Clear current cart first
                get().clearCart('Tải đơn hàng');

                // Build cart items from order items
                const cartItems: CartItem[] = (order.order_items || []).map((item) => {
                    // Try to find the product in store
                    const product = productStore.products.find(p => p.id === item.product_id);
                    return {
                        id: generateId(),
                        order_id: editMode ? String(order.id) : '', // Keep ID if editing
                        product_id: item.product_id,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        discount_amount: item.discount_amount || 0,
                        total_price: item.quantity * item.unit_price,
                        returned_quantity: 0,
                        created_at: new Date().toISOString(),
                        product: product || item.product as Product,
                        unitName: (item as any).unit_name || 'Cái',
                    };
                }).filter(item => item.product); // Only include items with valid products

                const subtotal = cartItems.reduce((sum, item) => sum + item.total_price, 0);

                // Set customer if exists
                let customer: Customer | null = null;
                if (order.customer_id) {
                    customer = customerStore.customers.find(c => c.id === order.customer_id) || order.customer || null;
                }

                set({
                    cartItems,
                    subtotal,
                    total: subtotal,
                    customer,
                    discountAmount: 0,
                    pointsUsed: 0, // Reset points for now, user can re-apply if needed
                    pointsDiscount: 0,
                    isEditMode: editMode,
                    currentOrder: editMode ? order : null,
                });
            },

            // Set discount
            setDiscount: (amount: number) => {
                const s = get();
                const newTotal = Math.max(0, s.subtotal - amount - s.pointsDiscount + s.taxAmount);
                set({
                    discountAmount: amount,
                    total: Math.round(newTotal),
                    change: Math.max(0, s.cashReceived - Math.round(newTotal)),
                });
            },

            setPointsDiscount: (points: number, amount: number) => {
                const s = get();
                const newTotal = Math.max(0, s.subtotal - s.discountAmount - amount + s.taxAmount);
                set({
                    pointsUsed: points,
                    pointsDiscount: amount,
                    total: Math.round(newTotal),
                    change: Math.max(0, s.cashReceived - Math.round(newTotal)),
                });
            },

            setTaxRate: (rate: number) => {
                const state = get();
                const subtotal = state.subtotal;
                const discount = state.discountAmount;
                const taxRate = rate;
                const taxAmount = (subtotal - discount) * (taxRate / 100);
                const total = Math.max(0, subtotal - discount + taxAmount);

                set({
                    taxRate,
                    taxAmount,
                    total,
                    change: Math.max(0, state.cashReceived - total),
                });
            },

            // Set payment method
            setPaymentMethod: (method: PaymentMethod) => {
                set({ paymentMethod: method });
            },

            // Set cash received
            setCashReceived: (amount: number) => {
                set((state) => ({
                    cashReceived: amount,
                    change: amount - state.total,
                }));
            },

            // Park order
            parkOrder: (note?: string) => {
                const state = get();

                if (state.cartItems.length === 0) return;

                const draft = {
                    id: generateId(),
                    timestamp: new Date().toISOString(),
                    note,
                    order: {
                        id: generateId(),
                        status: 'draft' as const,
                        subtotal: state.subtotal,
                        discount_amount: state.discountAmount,
                        total_amount: state.total,
                        created_at: new Date().toISOString(),
                    },
                    items: [...state.cartItems],
                    customer: state.customer,
                };

                set((state) => ({
                    draftOrders: [draft, ...state.draftOrders],
                    cartItems: [],
                    currentOrder: null,
                    customer: null,
                    subtotal: 0,
                    discountAmount: 0,
                    taxRate: 0,
                    taxAmount: 0,
                    total: 0,
                    cashReceived: 0,
                    change: 0,
                    paymentMethod: null,
                    isSubmitting: false,
                }));
            },

            resumeOrder: (id: string) => {
                const state = get();
                const draftIndex = state.draftOrders.findIndex(d => d.id === id);
                if (draftIndex === -1) return;

                const draft = state.draftOrders[draftIndex];

                if (state.cartItems.length > 0) {
                    get().parkOrder();
                }

                set((state) => ({
                    draftOrders: state.draftOrders.filter(d => d.id !== id),
                    cartItems: draft.items,
                    currentOrder: draft.order,
                    customer: draft.customer,
                    subtotal: draft.order.subtotal || 0,
                    discountAmount: draft.order.discount_amount || 0,
                    total: draft.order.total_amount || 0,
                }));
            },

            // Delete draft order with logging
            deleteDraftOrder: (id: string, reason = 'Xóa đơn chờ') => {
                const state = get();
                const draft = state.draftOrders.find(d => d.id === id);

                if (draft) {
                    try {
                        logCartCleared({
                            items: draft.items.map(item => ({ product: item.product, item })),
                            reason: `Hủy đơn chờ (ID: ${id}) - ${reason}`,
                            shiftId: state.currentShiftId || undefined,
                            orderId: String(draft.order.id || ''),
                            userId: useAuthStore.getState().user?.id,
                        });
                    } catch (e) { console.error('Log failed', e); }
                }

                set((state) => ({
                    draftOrders: state.draftOrders.filter(d => d.id !== id),
                }));
            },

            sanitizeState: () => {
                const state = get();
                const newDrafts = state.draftOrders.map(d => ({
                    ...d,
                    id: d.id || generateId()
                }));
                if (JSON.stringify(newDrafts) !== JSON.stringify(state.draftOrders)) {
                    set({ draftOrders: newDrafts });
                }
            },

            // ==================
            // SUBMIT ORDER
            // ==================
            submitOrder: async (orderData) => {
                const state = get();
                const { user } = useAuthStore.getState();
                const { users } = useUserStore.getState();
                const currentUserProfile = users.find(u => u.id === user?.id);

                if (state.cartItems.length === 0) return null;

                set({ isSubmitting: true });

                try {
                    // ID Generation: Use existing if Edit, else new
                    const orderId = state.isEditMode && state.currentOrder?.id
                        ? state.currentOrder.id
                        : generateId();

                    const orderNumber = state.isEditMode && state.currentOrder?.order_number
                        ? state.currentOrder.order_number
                        : `DH${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;

                    const now = new Date().toISOString();
                    const createdAt = state.isEditMode && state.currentOrder?.created_at
                        ? state.currentOrder.created_at
                        : now;

                    // Calculate finals
                    const subtotal = state.subtotal;
                    const discount = state.discountAmount + state.pointsDiscount;
                    const tax = state.taxAmount;
                    const total = state.total;

                    const order: Order = {
                        id: orderId,
                        created_at: createdAt,
                        updated_at: now, // Always update updated_at
                        order_number: orderNumber,
                        customer_id: state.customer?.id,
                        shift_id: state.currentShiftId || useShiftStore.getState().currentShift?.id || undefined,
                        status: orderData?.status || 'completed',

                        // Delivery fields
                        is_delivery: orderData?.is_delivery,
                        delivery_info: orderData?.delivery_info,

                        // Determine payment method based on paymentSplit
                        payment_method: (() => {
                            const split = orderData?.paymentSplit;
                            if (!split) return state.paymentMethod || 'cash';

                            const usedMethods = Object.entries(split)
                                .filter(([, amount]) => (amount as number) > 0)
                                .map(([method]) => method);

                            if (usedMethods.length === 0) return state.paymentMethod || 'cash';
                            if (usedMethods.length === 1) return usedMethods[0] as PaymentMethod;
                            return 'mixed' as PaymentMethod;
                        })(),
                        subtotal,
                        discount_amount: state.discountAmount,
                        discount_percent: 0,
                        tax_amount: tax,
                        total_amount: total,
                        points_used: state.pointsUsed,
                        points_discount: state.pointsDiscount,
                        // Use paymentSplit if available, otherwise fallback to current logic
                        cash_received: orderData?.paymentSplit?.cash || state.cashReceived,
                        change_amount: state.change,
                        transfer_amount: orderData?.paymentSplit?.transfer || (state.paymentMethod === 'transfer' ? total : 0),
                        card_amount: orderData?.paymentSplit?.card || (state.paymentMethod === 'card' ? total : 0),
                        debt_amount: orderData?.paymentSplit?.debt || (state.paymentMethod === 'debt' ? total : 0),
                        provisional_printed: false,
                        receipt_printed: false,
                        created_by: user?.id,
                        completed_at: (orderData?.status || 'completed') === 'completed' ? now : undefined,
                        notes: orderData?.note || undefined,
                        // Seller tracking (Phase 2)
                        seller_id: user?.id || currentUserProfile?.id,
                        seller_name: currentUserProfile?.full_name || 'Nhân viên'
                    };

                    const orderItems = state.cartItems.map(item => ({
                        id: generateId(),
                        created_at: now,
                        order_id: orderId,
                        product_id: item.product_id,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        discount_amount: item.discount_amount || 0,
                        total_price: item.total_price,
                        unit_id: item.unit_id,
                        notes: item.notes,
                        returned_quantity: 0
                    }));

                    if (isSupabaseConfigured() && supabase) {
                        // Check if online
                        if (!navigator.onLine) {
                            // Save to offline store for later sync
                            useOfflineStore.getState().addPendingOrder(order);
                            console.log('📴 Offline: Đơn hàng đã được lưu chờ đồng bộ', order.order_number);
                        } else {
                            const { error: orderError } = await supabase.from('orders').insert(order);
                            if (orderError) throw orderError;

                            const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
                            if (itemsError) throw itemsError;
                        }
                    } else {
                        // Demo mode - check offline too
                        if (!navigator.onLine) {
                            useOfflineStore.getState().addPendingOrder(order);
                            console.log('📴 Offline (Demo): Đơn hàng đã được lưu chờ đồng bộ', order.order_number);
                        }
                    }

                    // =========================================================================
                    // POST-SAVE ACTIONS (Stock, Revenue, Customer)
                    // ONLY RUN IF ORDER IS COMPLETED
                    // =========================================================================
                    if (order.status === 'completed') {
                        // 1. UPDATE SHIFT TOTALS
                        const { currentShift, updateShiftTotals } = useShiftStore.getState();
                        if (currentShift && currentShift.id === order.shift_id) {
                            const cashSales = (currentShift.total_cash_sales || 0) + (
                                order.payment_method === 'cash' ? order.total_amount :
                                    order.payment_method === 'mixed' ? Math.max(0, order.total_amount - (order.transfer_amount || 0) - (order.card_amount || 0) - (order.debt_amount || 0)) : 0
                            );

                            const transferSales = (currentShift.total_transfer_sales || 0) + (order.transfer_amount || (order.payment_method === 'transfer' ? order.total_amount : 0));
                            const cardSales = (currentShift.total_card_sales || 0) + (order.card_amount || (order.payment_method === 'card' ? order.total_amount : 0));
                            const debtSales = (currentShift.total_debt_sales || 0) + (order.debt_amount || (order.payment_method === 'debt' ? order.total_amount : 0));
                            const pointSales = (currentShift.total_point_sales || 0) + (order.points_discount || 0);

                            updateShiftTotals({
                                total_cash_sales: cashSales,
                                total_transfer_sales: transferSales,
                                total_card_sales: cardSales,
                                total_debt_sales: debtSales,
                                total_point_sales: pointSales
                            });

                            // Also update Supabase if online
                            if (isSupabaseConfigured() && supabase) {
                                await supabase.from('shifts').update({
                                    total_cash_sales: cashSales,
                                    total_transfer_sales: transferSales,
                                    total_card_sales: cardSales,
                                    total_debt_sales: debtSales,
                                    total_point_sales: pointSales
                                }).eq('id', currentShift.id);
                            }
                        }

                        // 2. STOCK DEDUCTION
                        for (let i = 0; i < orderItems.length; i++) {
                            const item = orderItems[i];
                            const cartItem = state.cartItems[i];
                            // If conversionRate is set, multiply quantity by it to get base units
                            const baseUnitQuantity = item.quantity * (cartItem?.conversionRate || 1);
                            await useProductStore.getState().updateStock(
                                item.product_id,
                                -baseUnitQuantity,
                                `Bán hàng - ${orderNumber} (${cartItem?.unitName || 'base'}: ${item.quantity})`,
                                'sale'
                            );
                        }

                        // 3. CUSTOMER UPDATES
                        if (state.customer) {
                            // Get loyalty settings
                            const { loyalty } = useSettingsStore.getState();
                            const loyaltyConfig = useLoyaltyStore.getState().config;

                            // Calculate eligible amount (exclude products/categories) using proportional method
                            const { categories } = useCategoryStore.getState();

                            const includedRawTotal = state.cartItems.reduce((acc, item) => {
                                const isExcludedProduct = item.product.exclude_from_loyalty_points;
                                const category = item.product.category_id ? categories.find(c => c.id === item.product.category_id) : null;
                                const isExcludedCategory = category?.exclude_from_loyalty_points;

                                if (!isExcludedProduct && !isExcludedCategory) {
                                    return acc + (item.total_price || 0);
                                }
                                return acc;
                            }, 0);

                            // Calculate final eligible amount based on ratio of included items to subtotal
                            // This ensures global discounts/taxes are distributed proportionally
                            let eligibleTotal = 0;
                            if (state.subtotal > 0) {
                                const ratio = includedRawTotal / state.subtotal;
                                eligibleTotal = total * ratio;
                            }

                            // Only earn points if loyalty is enabled
                            const pointsEarned = loyalty.enabled && loyalty.pointsPerAmount > 0
                                ? Math.floor(eligibleTotal / loyalty.pointsPerAmount)
                                : 0;

                            const newPoints = Math.max(0, (state.customer.points_balance || 0) - state.pointsUsed + pointsEarned);

                            // Calculate debt from paymentSplit or fallback to payment method
                            const debtAmount = orderData?.paymentSplit?.debt ||
                                (state.paymentMethod === 'debt' ? total : 0);
                            const newDebt = debtAmount > 0
                                ? (state.customer.debt_balance || 0) + debtAmount
                                : state.customer.debt_balance || 0;

                            await useCustomerStore.getState().updateCustomer(state.customer.id, {
                                points_balance: newPoints,
                                total_spent: (state.customer.total_spent || 0) + total,
                                total_orders: (state.customer.total_orders || 0) + 1,
                                debt_balance: newDebt
                            });

                            // Record points transactions in loyaltyStore for activity log
                            const loyaltyStore = useLoyaltyStore.getState();

                            // Record points earned
                            if (pointsEarned > 0) {
                                loyaltyStore.earnPoints(
                                    state.customer.id,
                                    state.customer.name,
                                    pointsEarned,
                                    orderId,
                                    orderNumber
                                );
                            }

                            // Record points redeemed (used for payment)
                            if (state.pointsUsed > 0) {
                                loyaltyStore.redeemPoints(
                                    state.customer.id,
                                    state.customer.name,
                                    state.pointsUsed,
                                    orderId,
                                    orderNumber
                                );
                            }

                            // Point transactions (only for Supabase mode)
                            if (isSupabaseConfigured() && supabase && (state.pointsUsed > 0 || pointsEarned > 0)) {
                                await supabase.from('point_transactions').insert({
                                    id: generateId(),
                                    customer_id: state.customer.id,
                                    order_id: orderId,
                                    points_change: pointsEarned - state.pointsUsed,
                                    reason: `Đơn hàng ${orderNumber}`,
                                    created_at: now,
                                    created_by: user?.id
                                });
                            }
                        }
                    }

                    // Sync order to OrderStore (for Orders page display)
                    order.order_items = orderItems.map((item, idx) => ({
                        ...item,
                        product: state.cartItems[idx]?.product
                    }));
                    order.customer = state.customer || undefined;

                    if (state.isEditMode) {
                        // Update existing order
                        useOrderStore.getState().updateOrder(order.id, order);
                        console.log('📝 Updated existing order:', order.order_number);
                    } else {
                        // Add new order
                        useOrderStore.getState().addOrder(order);
                    }

                    // Clear Cart
                    set({
                        cartItems: [],
                        currentOrder: null,
                        customer: null,
                        subtotal: 0,
                        discountAmount: 0,
                        pointsUsed: 0,
                        pointsDiscount: 0,
                        taxRate: 0,
                        taxAmount: 0,
                        total: 0,
                        cashReceived: 0,
                        change: 0,
                        paymentMethod: null,
                        isSubmitting: false,
                        isEditMode: false
                    });

                    return order;

                } catch (error: any) {
                    const errorMsg = error?.message || JSON.stringify(error) || 'Unknown error';
                    console.error('Submit order failed:', error);
                    set({ isSubmitting: false });
                    throw new Error(errorMsg);
                }
            }
        }),
        {
            name: 'pos-storage',
            partialize: (state) => ({
                // Exclude product images from persistence to avoid quota issues
                cartItems: state.cartItems.map(item => ({
                    ...item,
                    product: item.product ? {
                        ...item.product,
                        image_url: undefined, // Don't store product images
                        images: undefined
                    } : item.product
                })),
                currentOrder: state.currentOrder,
                customer: state.customer,
                draftOrders: state.draftOrders.map(draft => ({
                    ...draft,
                    items: draft.items.map(item => ({
                        ...item,
                        product: item.product ? {
                            ...item.product,
                            image_url: undefined,
                            images: undefined
                        } : item.product
                    }))
                }))
            })
        }
    )
);
