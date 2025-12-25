// =============================================================================
// OFFLINE STORE - Manage pending orders when offline
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Order } from '@/types';
import { useOrderStore } from './orderStore';

interface OfflineState {
    pendingOrders: Order[];
    isSyncing: boolean;
    lastSyncAttempt: string | null;

    // Actions
    addPendingOrder: (order: Order) => void;
    removePendingOrder: (orderId: string) => void;
    clearPendingOrders: () => void;
    syncPendingOrders: () => Promise<{ success: number; failed: number }>;
    getPendingCount: () => number;
}

export const useOfflineStore = create<OfflineState>()(
    persist(
        (set, get) => ({
            pendingOrders: [],
            isSyncing: false,
            lastSyncAttempt: null,

            addPendingOrder: (order: Order) => {
                set((state) => ({
                    pendingOrders: [...state.pendingOrders, order]
                }));
            },

            removePendingOrder: (orderId: string) => {
                set((state) => ({
                    pendingOrders: state.pendingOrders.filter(o => o.id !== orderId)
                }));
            },

            clearPendingOrders: () => {
                set({ pendingOrders: [] });
            },

            getPendingCount: () => {
                return get().pendingOrders.length;
            },

            syncPendingOrders: async () => {
                const state = get();

                if (state.pendingOrders.length === 0) {
                    return { success: 0, failed: 0 };
                }

                if (!navigator.onLine) {
                    return { success: 0, failed: state.pendingOrders.length };
                }

                set({ isSyncing: true, lastSyncAttempt: new Date().toISOString() });

                let success = 0;
                let failed = 0;
                const orderStore = useOrderStore.getState();

                for (const order of state.pendingOrders) {
                    try {
                        // Try to sync to orderStore (which handles Supabase)
                        await orderStore.addOrder(order);
                        get().removePendingOrder(order.id);
                        success++;
                    } catch (error) {
                        console.error('Failed to sync order:', order.id, error);
                        failed++;
                    }
                }

                set({ isSyncing: false });

                return { success, failed };
            }
        }),
        {
            name: 'offline-orders-storage',
            partialize: (state) => ({
                pendingOrders: state.pendingOrders,
                lastSyncAttempt: state.lastSyncAttempt
            })
        }
    )
);

// Auto-sync when coming back online
if (typeof window !== 'undefined') {
    window.addEventListener('online', async () => {
        const store = useOfflineStore.getState();
        if (store.pendingOrders.length > 0) {
            console.log('🔄 Back online! Syncing', store.pendingOrders.length, 'pending orders...');
            const result = await store.syncPendingOrders();
            console.log('✅ Sync complete:', result);

            // Show notification to user
            if (result.success > 0) {
                alert(`✅ Đã đồng bộ ${result.success} đơn hàng offline lên hệ thống!`);
            }
            if (result.failed > 0) {
                alert(`⚠️ Có ${result.failed} đơn không thể đồng bộ. Vui lòng kiểm tra lại.`);
            }
        }
    });
}
