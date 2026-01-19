// =============================================================================
// OFFLINE ORDERS HOOK - IndexedDB operations for offline POS
// =============================================================================

import { openDB } from 'idb';
import { v4 as uuid } from 'uuid';


export interface OfflineOrder {
    local_id: string;
    brand_id: string;
    branch_id: string;
    items: OfflineOrderItem[];
    subtotal: number;
    discount: number;
    tax?: number;
    total: number;
    payment_method: string;
    customer_id?: string;
    customer_name?: string;
    note?: string;
    created_at: string;
    synced: boolean;
    synced_at?: string;
    server_id?: string;
}

export interface OfflineOrderItem {
    product_id: string;
    name: string;
    sku?: string;
    quantity: number;
    unit_price?: number;
    price?: number; // Alias for unit_price
    discount?: number;
    total?: number;
}

const DB_NAME = 'bango-pos-offline';
const DB_VERSION = 1;
const STORE_NAME = 'offline_orders';

let dbInstance: any = null;

async function getDB() {
    if (dbInstance) return dbInstance;

    dbInstance = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'local_id' });
                store.createIndex('by-synced', 'synced');
            }
        },
    });

    return dbInstance;
}

export function useOfflineOrders() {
    /**
     * Save an order to IndexedDB for later sync
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
        console.log('[Offline] Saved order:', local_id);

        return local_id;
    };

    /**
     * Get all orders that haven't been synced yet
     */
    const getUnsyncedOrders = async (): Promise<OfflineOrder[]> => {
        const db = await getDB();
        const all = await db.getAll(STORE_NAME);
        return all.filter((order: any) => !order.synced);
    };

    /**
     * Mark an order as synced after successful server sync
     */
    const markSynced = async (local_id: string, server_id?: string): Promise<void> => {
        const db = await getDB();
        const order = await db.get(STORE_NAME, local_id);

        if (order) {
            order.synced = true;
            order.synced_at = new Date().toISOString();
            if (server_id) order.server_id = server_id;
            await db.put(STORE_NAME, order);
            console.log('[Offline] Marked synced:', local_id);
        }
    };

    /**
     * Get count of unsynced orders
     */
    const getUnsyncedCount = async (): Promise<number> => {
        const unsynced = await getUnsyncedOrders();
        return unsynced.length;
    };

    /**
     * Get an order by local_id
     */
    const getOrder = async (local_id: string): Promise<OfflineOrder | undefined> => {
        const db = await getDB();
        return db.get(STORE_NAME, local_id);
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
    const cleanupOldOrders = async (olderThanDays: number = 30): Promise<number> => {
        const db = await getDB();
        const all = await db.getAll(STORE_NAME);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - olderThanDays);

        let deleted = 0;
        for (const order of all) {
            if (order.synced && new Date(order.created_at) < cutoff) {
                await db.delete(STORE_NAME, order.local_id);
                deleted++;
            }
        }

        console.log(`[Offline] Cleaned up ${deleted} old orders`);
        return deleted;
    };

    return {
        saveOfflineOrder,
        getUnsyncedOrders,
        markSynced,
        getUnsyncedCount,
        getOrder,
        getAllOrders,
        cleanupOldOrders,
    };
}

// =============================================================================
// AUTO SYNC HOOK - Automatically sync when online
// =============================================================================

export function useAutoSync(syncFn: (order: OfflineOrder) => Promise<string | null>) {
    const { getUnsyncedOrders, markSynced } = useOfflineOrders();

    const syncAll = async (): Promise<{ synced: number; failed: number }> => {
        const unsynced = await getUnsyncedOrders();
        let synced = 0;
        let failed = 0;

        for (const order of unsynced) {
            try {
                const serverId = await syncFn(order);
                if (serverId) {
                    await markSynced(order.local_id, serverId);
                    synced++;
                } else {
                    failed++;
                }
            } catch (err) {
                console.error('[AutoSync] Failed to sync order:', order.local_id, err);
                failed++;
            }
        }

        console.log(`[AutoSync] Synced ${synced}, failed ${failed}`);
        return { synced, failed };
    };

    // Setup online listener
    const setupAutoSync = () => {
        const handleOnline = () => {
            console.log('[AutoSync] Online detected, syncing...');
            syncAll();
        };

        window.addEventListener('online', handleOnline);

        // Also sync on mount if online
        if (navigator.onLine) {
            syncAll();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
        };
    };

    return {
        syncAll,
        setupAutoSync,
    };
}

// =============================================================================
// NETWORK STATUS HOOK
// =============================================================================

export function useNetworkStatus() {
    const isOnline = (): boolean => navigator.onLine;

    const waitForOnline = (): Promise<void> => {
        return new Promise(resolve => {
            if (navigator.onLine) {
                resolve();
            } else {
                const handler = () => {
                    window.removeEventListener('online', handler);
                    resolve();
                };
                window.addEventListener('online', handler);
            }
        });
    };

    return {
        isOnline,
        waitForOnline,
    };
}
