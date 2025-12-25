// =============================================================================
// OFFLINE ORDERS HOOK - IndexedDB for POS Offline Mode
// =============================================================================

import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import { v4 as uuid } from 'uuid';

const DB_NAME = 'storely-pos';
const DB_VERSION = 1;
const STORE_NAME = 'offline_orders';

// Order structure for offline storage
export interface OfflineOrder {
    local_id: string;
    brand_id: string;
    branch_id: string;
    customer_id?: string;
    items: OfflineOrderItem[];
    total: number;
    subtotal: number;
    discount: number;
    tax: number;
    payment_method: string;
    created_at: string;
    synced: boolean;
    sync_error?: string;
}

export interface OfflineOrderItem {
    product_id: string;
    name: string;
    quantity: number;
    price: number;
    discount?: number;
}

// Get or create database
async function getDB(): Promise<IDBPDatabase> {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'local_id' });
                store.createIndex('synced', 'synced', { unique: false });
                store.createIndex('created_at', 'created_at', { unique: false });
            }
        },
    });
}

// =============================================================================
// HOOK
// =============================================================================

export function useOfflineOrders() {
    /**
     * Save order to IndexedDB when offline
     */
    const saveOfflineOrder = async (order: Omit<OfflineOrder, 'local_id' | 'synced' | 'created_at'>): Promise<string> => {
        const db = await getDB();
        const local_id = uuid();

        const offlineOrder: OfflineOrder = {
            ...order,
            local_id,
            synced: false,
            created_at: new Date().toISOString(),
        };

        await db.put(STORE_NAME, offlineOrder);
        console.log('Order saved offline:', local_id);
        return local_id;
    };

    /**
     * Get all unsynced orders
     */
    const getUnsyncedOrders = async (): Promise<OfflineOrder[]> => {
        const db = await getDB();
        const all = await db.getAll(STORE_NAME);
        return all.filter((o) => !o.synced);
    };

    /**
     * Get count of unsynced orders
     */
    const getUnsyncedCount = async (): Promise<number> => {
        const orders = await getUnsyncedOrders();
        return orders.length;
    };

    /**
     * Mark order as synced after successful upload
     */
    const markSynced = async (local_id: string): Promise<void> => {
        const db = await getDB();
        const order = await db.get(STORE_NAME, local_id);
        if (order) {
            order.synced = true;
            order.sync_error = undefined;
            await db.put(STORE_NAME, order);
            console.log('Order marked as synced:', local_id);
        }
    };

    /**
     * Mark order with sync error
     */
    const markSyncError = async (local_id: string, error: string): Promise<void> => {
        const db = await getDB();
        const order = await db.get(STORE_NAME, local_id);
        if (order) {
            order.sync_error = error;
            await db.put(STORE_NAME, order);
        }
    };

    /**
     * Get all orders (for debugging/admin)
     */
    const getAllOrders = async (): Promise<OfflineOrder[]> => {
        const db = await getDB();
        return db.getAll(STORE_NAME);
    };

    /**
     * Delete synced orders older than X days
     */
    const cleanupOldOrders = async (daysOld: number = 7): Promise<number> => {
        const db = await getDB();
        const all = await db.getAll(STORE_NAME);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        let deleted = 0;
        for (const order of all) {
            if (order.synced && new Date(order.created_at) < cutoffDate) {
                await db.delete(STORE_NAME, order.local_id);
                deleted++;
            }
        }
        return deleted;
    };

    /**
     * Check if currently online
     */
    const isOnline = (): boolean => {
        return navigator.onLine;
    };

    return {
        saveOfflineOrder,
        getUnsyncedOrders,
        getUnsyncedCount,
        markSynced,
        markSyncError,
        getAllOrders,
        cleanupOldOrders,
        isOnline,
    };
}

// =============================================================================
// AUTO SYNC HOOK - Syncs when back online
// =============================================================================

export function useAutoSyncOrders(syncFunction: (order: OfflineOrder) => Promise<boolean>) {
    const { getUnsyncedOrders, markSynced, markSyncError } = useOfflineOrders();

    const syncAllPending = async (): Promise<{ success: number; failed: number }> => {
        const unsyncedOrders = await getUnsyncedOrders();
        let success = 0;
        let failed = 0;

        for (const order of unsyncedOrders) {
            try {
                const result = await syncFunction(order);
                if (result) {
                    await markSynced(order.local_id);
                    success++;
                } else {
                    failed++;
                }
            } catch (error: any) {
                await markSyncError(order.local_id, error.message || 'Unknown error');
                failed++;
            }
        }

        return { success, failed };
    };

    // Setup online listener
    if (typeof window !== 'undefined') {
        window.addEventListener('online', async () => {
            console.log('Back online! Syncing pending orders...');
            const result = await syncAllPending();
            console.log(`Sync complete: ${result.success} success, ${result.failed} failed`);
        });
    }

    return {
        syncAllPending,
    };
}
