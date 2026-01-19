// =============================================================================
// DEBT STORE - Debt Payment History Management
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DebtPayment, UUID } from '@/types';
import { useAuthStore } from './authStore';
import { createBaseState } from './baseStore';
import type { BaseState } from './baseStore';

// Generate unique ID
const generateId = () => `debt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

interface DebtState extends BaseState {
    payments: DebtPayment[];

    // Actions
    loadPayments: () => void;
    addPayment: (payment: Omit<DebtPayment, 'id' | 'created_at' | 'created_by' | 'created_by_name'>) => DebtPayment;

    // Customer payments
    getCustomerPayments: (customerId: UUID) => DebtPayment[];
    getCustomerOrderPayments: (orderId: UUID) => DebtPayment[];

    // Supplier payments
    getSupplierPayments: (supplierId: UUID) => DebtPayment[];
    getSupplierPOPayments: (purchaseOrderId: UUID) => DebtPayment[];

    // Stats
    getTotalPaidToday: (type: 'customer' | 'supplier') => number;
}

export const useDebtStore = create<DebtState>()(
    persist(
        (set, get) => ({
            ...createBaseState(),
            payments: [],
            isLoading: false,
            error: null,

            loadPayments: () => {
                // Payments are loaded from localStorage via persist
                set({ isLoading: false });
            },

            addPayment: (paymentData) => {
                const user = useAuthStore.getState().user;

                const newPayment: DebtPayment = {
                    ...paymentData,
                    id: generateId(),
                    created_at: new Date().toISOString(),
                    created_by: user?.id,
                    created_by_name: user?.name || user?.email || 'Unknown',
                };

                set((state) => ({
                    payments: [newPayment, ...state.payments],
                }));

                return newPayment;
            },

            getCustomerPayments: (customerId) => {
                return get().payments.filter(
                    (p) => p.payment_type === 'customer' && p.customer_id === customerId
                );
            },

            getCustomerOrderPayments: (orderId) => {
                return get().payments.filter(
                    (p) => p.payment_type === 'customer' && p.order_id === orderId
                );
            },

            getSupplierPayments: (supplierId) => {
                return get().payments.filter(
                    (p) => p.payment_type === 'supplier' && p.supplier_id === supplierId
                );
            },

            getSupplierPOPayments: (purchaseOrderId) => {
                return get().payments.filter(
                    (p) => p.payment_type === 'supplier' && p.purchase_order_id === purchaseOrderId
                );
            },

            getTotalPaidToday: (type) => {
                const today = new Date().toISOString().split('T')[0];
                return get().payments
                    .filter((p) =>
                        p.payment_type === type &&
                        p.created_at.startsWith(today)
                    )
                    .reduce((sum, p) => sum + p.amount, 0);
            },
        }),
        {
            name: 'debt-storage',
        }
    )
);

export default useDebtStore;
