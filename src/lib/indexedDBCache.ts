// =============================================================================
// INDEXED DB CACHE - Cached products for offline use
// =============================================================================

import type { Product, Customer } from '@/types';

const DB_NAME = 'appbanhang-cache';
const DB_VERSION = 2;
const PRODUCTS_STORE = 'products';
const CUSTOMERS_STORE = 'customers';
const METADATA_STORE = 'metadata';

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB
 */
export async function initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[IndexedDB] Open failed:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('[IndexedDB] Opened successfully');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;

            // Products store
            if (!database.objectStoreNames.contains(PRODUCTS_STORE)) {
                const productStore = database.createObjectStore(PRODUCTS_STORE, { keyPath: 'id' });
                productStore.createIndex('barcode', 'barcode', { unique: false });
                productStore.createIndex('sku', 'sku', { unique: false });
                productStore.createIndex('name', 'name', { unique: false });
            }

            // Metadata store (for cache timestamps etc)
            if (!database.objectStoreNames.contains(METADATA_STORE)) {
                database.createObjectStore(METADATA_STORE, { keyPath: 'key' });
            }

            // Customers store
            if (!database.objectStoreNames.contains(CUSTOMERS_STORE)) {
                const customerStore = database.createObjectStore(CUSTOMERS_STORE, { keyPath: 'id' });
                customerStore.createIndex('phone', 'phone', { unique: false });
                customerStore.createIndex('name', 'name', { unique: false });
            }

            console.log('[IndexedDB] Schema upgraded');
        };
    });
}

/**
 * Cache products to IndexedDB
 */
export async function cacheProducts(products: Product[]): Promise<void> {
    try {
        const database = await initDB();
        const tx = database.transaction([PRODUCTS_STORE, METADATA_STORE], 'readwrite');
        const productStore = tx.objectStore(PRODUCTS_STORE);
        const metadataStore = tx.objectStore(METADATA_STORE);

        // Clear existing products
        await new Promise<void>((resolve, reject) => {
            const clearRequest = productStore.clear();
            clearRequest.onsuccess = () => resolve();
            clearRequest.onerror = () => reject(clearRequest.error);
        });

        // Add new products
        for (const product of products) {
            productStore.put(product);
        }

        // Update metadata
        metadataStore.put({
            key: 'products_cached_at',
            value: new Date().toISOString(),
            count: products.length
        });

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        console.log(`[IndexedDB] Cached ${products.length} products`);
    } catch (err) {
        console.error('[IndexedDB] Failed to cache products:', err);
    }
}

/**
 * Get cached products from IndexedDB
 */
export async function getCachedProducts(): Promise<Product[]> {
    try {
        const database = await initDB();
        const tx = database.transaction(PRODUCTS_STORE, 'readonly');
        const store = tx.objectStore(PRODUCTS_STORE);

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                console.log(`[IndexedDB] Loaded ${request.result.length} cached products`);
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error('[IndexedDB] Failed to get cached products:', err);
        return [];
    }
}

/**
 * Get cache metadata
 */
export async function getCacheMetadata(): Promise<{ cachedAt: string | null; count: number }> {
    try {
        const database = await initDB();
        const tx = database.transaction(METADATA_STORE, 'readonly');
        const store = tx.objectStore(METADATA_STORE);

        return new Promise((resolve) => {
            const request = store.get('products_cached_at');
            request.onsuccess = () => {
                if (request.result) {
                    resolve({
                        cachedAt: request.result.value,
                        count: request.result.count || 0
                    });
                } else {
                    resolve({ cachedAt: null, count: 0 });
                }
            };
            request.onerror = () => resolve({ cachedAt: null, count: 0 });
        });
    } catch {
        return { cachedAt: null, count: 0 };
    }
}

/**
 * Search cached products by barcode or SKU (for offline scanning)
 */
export async function searchCachedByBarcode(barcode: string): Promise<Product | null> {
    try {
        const database = await initDB();
        const tx = database.transaction(PRODUCTS_STORE, 'readonly');
        const store = tx.objectStore(PRODUCTS_STORE);
        const index = store.index('barcode');

        return new Promise((resolve) => {
            const request = index.get(barcode);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

/**
 * Cache customers to IndexedDB
 */
export async function cacheCustomers(customers: Customer[]): Promise<void> {
    try {
        const database = await initDB();
        const tx = database.transaction([CUSTOMERS_STORE, METADATA_STORE], 'readwrite');
        const customerStore = tx.objectStore(CUSTOMERS_STORE);
        const metadataStore = tx.objectStore(METADATA_STORE);

        // Clear existing customers
        await new Promise<void>((resolve, reject) => {
            const clearRequest = customerStore.clear();
            clearRequest.onsuccess = () => resolve();
            clearRequest.onerror = () => reject(clearRequest.error);
        });

        // Add new customers
        for (const customer of customers) {
            customerStore.put(customer);
        }

        // Update metadata
        metadataStore.put({
            key: 'customers_cached_at',
            value: new Date().toISOString(),
            count: customers.length
        });

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        console.log(`[IndexedDB] Cached ${customers.length} customers`);
    } catch (err) {
        console.error('[IndexedDB] Failed to cache customers:', err);
    }
}

/**
 * Get cached customers from IndexedDB
 */
export async function getCachedCustomers(): Promise<Customer[]> {
    try {
        const database = await initDB();
        const tx = database.transaction(CUSTOMERS_STORE, 'readonly');
        const store = tx.objectStore(CUSTOMERS_STORE);

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                console.log(`[IndexedDB] Loaded ${request.result.length} cached customers`);
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error('[IndexedDB] Failed to get cached customers:', err);
        return [];
    }
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<void> {
    try {
        const database = await initDB();
        const tx = database.transaction([PRODUCTS_STORE, CUSTOMERS_STORE, METADATA_STORE], 'readwrite');
        tx.objectStore(PRODUCTS_STORE).clear();
        tx.objectStore(CUSTOMERS_STORE).clear();
        tx.objectStore(METADATA_STORE).clear();

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        console.log('[IndexedDB] Cache cleared');
    } catch (err) {
        console.error('[IndexedDB] Failed to clear cache:', err);
    }
}
