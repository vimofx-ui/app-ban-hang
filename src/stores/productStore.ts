// =============================================================================
// PRODUCT STORE - Product Management State
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useCategoryStore, NO_BARCODE_CATEGORY_ID } from '@/stores/categoryStore';
import { MOCK_PRODUCTS } from '@/data/mockProducts';
import { logPriceEdit } from '@/lib/ghostScan';
import type { Product } from '@/types';
import { generateId } from '@/lib/utils';

export interface ProductState {
    products: Product[];
    isLoading: boolean;
    error: string | null;

    // Actions
    loadProducts: () => Promise<void>;
    addProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<Product>;
    updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;
    getProductById: (id: string) => Product | undefined;
    getProductByBarcode: (barcode: string) => Product | undefined;
    searchProducts: (query: string) => Product[];
    updateStock: (productId: string, quantityChange: number, reason: string, referenceType?: string) => Promise<void>;
    // New: Update stock with cost for weighted average calculation
    updateStockWithCost: (productId: string, quantityIn: number, unitCost: number, reason: string, referenceId?: string) => Promise<void>;
    // Combo product stock management
    sellCombo: (comboId: string, quantity: number, reason?: string) => Promise<void>;
    purchaseCombo: (comboId: string, quantity: number, reason?: string) => Promise<void>;
}

export const useProductStore = create<ProductState>()(
    persist(
        (set, get) => ({
            products: [],
            isLoading: false,
            error: null,

            // Load products from Supabase or use persisted/mock data
            loadProducts: async () => {
                const currentProducts = get().products;
                set({ isLoading: true, error: null });

                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { data, error } = await supabase
                            .from('products')
                            .select('*, units:product_units(*)')
                            .eq('is_active', true)
                            .order('name');

                        if (error) throw error;

                        set({ products: data as Product[], isLoading: false });
                    } catch (err) {
                        console.error('Failed to load products:', err);
                        set({
                            error: 'Không thể tải sản phẩm',
                            isLoading: false,
                            products: currentProducts.length > 0 ? currentProducts : MOCK_PRODUCTS
                        });
                    }
                } else {
                    // Demo mode - use persisted products OR mock products (first load only)
                    if (currentProducts.length === 0) {
                        // First time load - use mock products
                        set({ products: MOCK_PRODUCTS, isLoading: false });
                    } else {
                        // Already have products (from persistence) - keep them
                        set({ isLoading: false });
                    }
                }
            },

            // Add new product
            addProduct: async (productData) => {
                const { units, ...mainProductData } = productData;
                const user = useAuthStore.getState().user;

                // Auto-assign to "Không mã" category if no barcode
                let categoryId = mainProductData.category_id;
                if (!mainProductData.barcode || mainProductData.barcode.trim() === '') {
                    useCategoryStore.getState().getOrCreateNoBarcodeCategory();
                    categoryId = NO_BARCODE_CATEGORY_ID;
                }

                const newProduct: Product = {
                    ...mainProductData,
                    category_id: categoryId,
                    id: generateId(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    created_by: user?.id, // Track who created the product
                    created_by_name: user?.name || user?.email || 'Unknown', // Store name for display
                };

                // Remove undefined values and fields not in database
                if (!newProduct.image_url) delete newProduct.image_url;
                if (!newProduct.sku) delete newProduct.sku;
                if (!newProduct.barcode) delete newProduct.barcode;

                // Helper to perform insert with fallback
                const executeInsert = async (dataToInsert: any) => {
                    const { created_by_name, ...cleanData } = dataToInsert;
                    const { error } = await supabase!.from('products').insert(cleanData);
                    return error;
                };

                if (isSupabaseConfigured() && supabase) {
                    try {
                        let error = await executeInsert(newProduct);

                        // ROBUST RETRY STRATEGY: Remove problematic columns progressively
                        if (error && error.code === 'PGRST204') {
                            console.warn('Schema mismatch detected, retrying with safe data...', error.message);

                            // Build a clean object by removing ALL potentially missing columns upfront
                            const safeData: any = { ...newProduct };
                            const columnsToRemove = [
                                'exclude_from_loyalty_points',
                                'category_ids',
                                'created_by',
                                'code',
                                'combo_items',
                                'variants',
                                'attributes',
                                'product_kind',
                                'avg_cost_price',
                                'total_cost_value',
                                'last_sold_at',
                                'total_sold',
                                'purchase_price',
                                'cost_price',
                                'wholesale_price',
                                'weight',
                                'allow_negative_stock',
                                'brand_id',
                                'product_type_id',
                                'units'
                            ];

                            for (const col of columnsToRemove) {
                                delete safeData[col];
                            }
                            // Also remove created_by_name which is a frontend-only field
                            delete safeData.created_by_name;

                            console.log('Retrying with safe data (removed potentially missing columns):', Object.keys(safeData));
                            error = await executeInsert(safeData);
                        }

                        if (error) throw error;

                        // Add units if any
                        if (units && units.length > 0) {
                            const unitsToInsert = units.map(u => ({
                                ...u,
                                id: generateId(),
                                product_id: newProduct.id,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }));

                            const { error: unitsError } = await supabase
                                .from('product_units')
                                .insert(unitsToInsert);

                            if (unitsError) throw unitsError;

                            newProduct.units = unitsToInsert;
                        }

                    } catch (err) {
                        console.error('Failed to add product:', err);
                        throw err;
                    }
                }

                set((state) => ({
                    products: [...state.products, newProduct],
                }));

                return newProduct;
            },

            // Update product
            updateProduct: async (id, updates) => {
                const { units, ...mainUpdates } = updates;
                const updatedData = {
                    ...mainUpdates,
                    updated_at: new Date().toISOString(),
                };

                // Log Price Edit
                const currentProduct = get().products.find(p => p.id === id);
                if (currentProduct && updates.selling_price !== undefined && updates.selling_price !== currentProduct.selling_price) {
                    const userId = useAuthStore.getState().user?.id;
                    logPriceEdit({
                        product: currentProduct,
                        oldPrice: currentProduct.selling_price,
                        newPrice: updates.selling_price,
                        userId
                    }).catch(console.error);
                }

                // Handle "Không mã" category based on barcode changes
                if (currentProduct) {
                    const hadBarcode = currentProduct.barcode && currentProduct.barcode.trim() !== '';
                    const hasBarcode = updates.barcode !== undefined
                        ? updates.barcode && updates.barcode.trim() !== ''
                        : hadBarcode;

                    // If barcode was added - remove from "Không mã" category
                    if (!hadBarcode && hasBarcode && currentProduct.category_id === NO_BARCODE_CATEGORY_ID) {
                        updatedData.category_id = undefined; // Clear the no-barcode category
                    }

                    // If barcode was removed - add to "Không mã" category  
                    if (hadBarcode && !hasBarcode) {
                        useCategoryStore.getState().getOrCreateNoBarcodeCategory();
                        updatedData.category_id = NO_BARCODE_CATEGORY_ID;
                    }
                }

                if (isSupabaseConfigured() && supabase) {
                    try {
                        // Helper for update
                        const executeUpdate = async (dataToUpdate: any) => {
                            const { error } = await supabase!
                                .from('products')
                                .update(dataToUpdate)
                                .eq('id', id);
                            return error;
                        };

                        // 1. Update Product Main Data
                        let error = await executeUpdate(updatedData);

                        // RETRY STRATEGY FOR MISSING COLUMNS
                        if (error && error.code === 'PGRST204') {
                            console.warn('Update schema mismatch, retrying...', error.message);
                            if (error.message.includes('category_ids') || updatedData.category_ids) {
                                const { category_ids, ...retryData } = updatedData;
                                error = await executeUpdate(retryData);
                            }
                            if (error && (error.code === 'PGRST204' || error.message.includes('created_by'))) {
                                const { created_by, category_ids, ...retryData } = updatedData;
                                error = await executeUpdate(retryData);
                            }
                        }

                        if (error) throw error;

                        // 2. Handle Units Update if provided
                        if (units) {
                            // Get existing units to know what to delete
                            const { data: existingUnits } = await supabase
                                .from('product_units')
                                .select('id')
                                .eq('product_id', id);

                            const existingIds = existingUnits?.map(u => u.id) || [];
                            const incomingIds = units.filter(u => u.id).map(u => u.id);

                            // Delete removed units
                            const idsToDelete = existingIds.filter(id => !incomingIds.includes(id));
                            if (idsToDelete.length > 0) {
                                await supabase
                                    .from('product_units')
                                    .delete()
                                    .in('id', idsToDelete);
                            }

                            // Upsert (Update existing + Insert new)
                            const unitsToUpsert = units.map(u => {
                                const isNew = !u.id;
                                return {
                                    ...u,
                                    id: u.id || generateId(),
                                    product_id: id,
                                    updated_at: new Date().toISOString(),
                                    created_at: u.created_at || new Date().toISOString(),
                                };
                            });

                            if (unitsToUpsert.length > 0) {
                                const { error: upsertError } = await supabase
                                    .from('product_units')
                                    .upsert(unitsToUpsert);
                                if (upsertError) throw upsertError;
                            }
                        }

                    } catch (err) {
                        console.error('Failed to update product:', err);
                        throw err;
                    }
                }

                set((state) => ({
                    products: state.products.map((p) =>
                        p.id === id ? { ...p, ...updates, ...updatedData } : p
                    ),
                }));
            },



            // Delete product (soft delete)
            deleteProduct: async (id) => {
                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { error } = await supabase
                            .from('products')
                            .update({ is_active: false })
                            .eq('id', id);

                        if (error) throw error;
                    } catch (err) {
                        console.error('Failed to delete product:', err);
                        throw err;
                    }
                }

                set((state) => ({
                    products: state.products.filter((p) => p.id !== id),
                }));
            },

            // Get product by ID
            getProductById: (id) => {
                return get().products.find((p) => p.id === id);
            },

            // Get product by barcode
            getProductByBarcode: (barcode) => {
                return get().products.find((p) => p.barcode === barcode);
            },

            // Search products
            searchProducts: (query) => {
                const lowerQuery = query.toLowerCase();
                return get().products.filter(
                    (p) =>
                        p.name.toLowerCase().includes(lowerQuery) ||
                        p.sku?.toLowerCase().includes(lowerQuery) ||
                        p.barcode?.includes(query)
                );
            },

            // Update stock (for sales, returns, adjustments)
            updateStock: async (productId, quantityChange, reason, referenceType = 'manual') => {
                const product = get().products.find(p => p.id === productId);
                if (!product) return;

                const newStock = (product.current_stock || 0) + quantityChange;

                // Check if negative stock is allowed
                // For POS sales, allow negative stock by default (common practice - inventory may be inaccurate)
                // For other operations, check the product's allow_negative_stock setting
                const allowNegative = referenceType === 'sale' || product.allow_negative_stock;
                if (newStock < 0 && !allowNegative) {
                    throw new Error('Không đủ tồn kho');
                }

                // Determine movement type based on quantity and reference
                let movementType: 'sale' | 'purchase' | 'return' | 'adjustment_in' | 'adjustment_out' = 'adjustment_in';
                if (referenceType === 'sale') {
                    movementType = 'sale';
                } else if (referenceType === 'purchase') {
                    movementType = 'purchase';
                } else if (referenceType === 'return') {
                    movementType = 'return';
                } else if (quantityChange > 0) {
                    movementType = 'adjustment_in';
                } else {
                    movementType = 'adjustment_out';
                }

                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { error } = await supabase.from('products')
                            .update({
                                current_stock: newStock,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', productId);

                        if (error) throw error;

                        const userId = useAuthStore.getState().user?.id;

                        // Log stock movement
                        await supabase.from('stock_movements').insert({
                            product_id: productId,
                            movement_type: movementType,
                            quantity: Math.abs(quantityChange),
                            stock_before: product.current_stock,
                            stock_after: newStock,
                            reference_type: referenceType,
                            created_by: userId,
                            notes: reason,
                        });
                    } catch (err) {
                        console.error('Failed to update stock:', err);
                        throw err;
                    }
                } else {
                    // Demo mode - also log to stockMovementStore
                    const { useStockMovementStore } = await import('./stockMovementStore');
                    await useStockMovementStore.getState().addMovement({
                        product_id: productId,
                        product_name: product.name,
                        movement_type: movementType,
                        quantity: quantityChange,
                        stock_before: product.current_stock || 0,
                        stock_after: newStock,
                        cost_price_at_time: product.cost_price || 0,
                        reference_type: referenceType as 'order' | 'purchase_order' | 'manual' | 'return',
                        notes: reason,
                    });
                }

                // Update local state
                set((state) => ({
                    products: state.products.map((p) =>
                        p.id === productId
                            ? { ...p, current_stock: newStock, updated_at: new Date().toISOString() }
                            : p
                    ),
                }));

                console.log(`📦 Stock updated: ${product.name} ${quantityChange > 0 ? '+' : ''}${quantityChange} (${reason})`);
            },

            // Update stock with new cost (for purchases) - calculates weighted average cost
            updateStockWithCost: async (productId, quantityIn, unitCost, reason, referenceId) => {
                const product = get().products.find(p => p.id === productId);
                if (!product || quantityIn <= 0) return;

                const oldStock = product.current_stock || 0;
                const oldAvgCost = product.avg_cost_price || product.cost_price || 0;
                const newStock = oldStock + quantityIn;

                // Weighted average cost formula
                // new_avg = (old_stock * old_avg_cost + new_qty * new_cost) / (old_stock + new_qty)
                const newAvgCost = oldStock > 0
                    ? Math.round((oldStock * oldAvgCost + quantityIn * unitCost) / newStock)
                    : unitCost;

                // Total inventory value
                const totalCostValue = newStock * newAvgCost;

                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { error } = await supabase.from('products')
                            .update({
                                current_stock: newStock,
                                purchase_price: unitCost, // Latest purchase price (Giá nhập mới nhất)
                                cost_price: newAvgCost, // Weighted average cost (Giá vốn bình quân)
                                avg_cost_price: newAvgCost, // For explicit tracking
                                total_cost_value: totalCostValue,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', productId);

                        if (error) throw error;

                        const userId = useAuthStore.getState().user?.id;

                        await supabase.from('stock_movements').insert({
                            product_id: productId,
                            movement_type: 'purchase',
                            quantity: quantityIn,
                            stock_before: oldStock,
                            stock_after: newStock,
                            reference_type: 'purchase_order',
                            reference_id: referenceId,
                            created_by: userId,
                            notes: reason,
                        });
                    } catch (err) {
                        console.error('Failed to update stock with cost:', err);
                        throw err;
                    }
                } else {
                    // Demo mode - log movement
                    const { useStockMovementStore } = await import('./stockMovementStore');
                    await useStockMovementStore.getState().addMovement({
                        product_id: productId,
                        product_name: product.name,
                        movement_type: 'purchase',
                        quantity: quantityIn,
                        stock_before: oldStock,
                        stock_after: newStock,
                        cost_price_at_time: unitCost,
                        reference_type: 'purchase_order',
                        reference_id: referenceId,
                        notes: reason,
                    });
                }

                // Update local state
                set((state) => ({
                    products: state.products.map((p) =>
                        p.id === productId
                            ? {
                                ...p,
                                current_stock: newStock,
                                purchase_price: unitCost, // Latest purchase price (Giá nhập mới nhất)
                                cost_price: newAvgCost, // Weighted average cost (Giá vốn bình quân)
                                avg_cost_price: newAvgCost, // For explicit tracking
                                total_cost_value: totalCostValue,
                                updated_at: new Date().toISOString()
                            }
                            : p
                    ),
                }));

                console.log(`📦 Stock in (Nhập): ${product.name} +${quantityIn} @ ${unitCost.toLocaleString()}đ | Avg: ${newAvgCost.toLocaleString()}đ`);
            },

            // Sell combo - deduct stock from all component products
            sellCombo: async (comboId, quantity, reason) => {
                const combo = get().getProductById(comboId);
                if (!combo || combo.product_kind !== 'combo' || !combo.combo_items) {
                    console.warn('sellCombo: Not a valid combo product');
                    return;
                }

                for (const item of combo.combo_items) {
                    // Deduct stock (negative quantity)
                    await get().updateStock(
                        item.product_id,
                        -item.quantity * quantity,
                        reason || `Bán combo ${combo.name}`,
                        'sale'
                    );
                }
                console.log(`📦 Combo sold: ${combo.name} x${quantity} - ${combo.combo_items.length} components updated`);
            },

            // Purchase combo - add stock to all component products
            purchaseCombo: async (comboId, quantity, reason) => {
                const combo = get().getProductById(comboId);
                if (!combo || combo.product_kind !== 'combo' || !combo.combo_items) {
                    console.warn('purchaseCombo: Not a valid combo product');
                    return;
                }

                for (const item of combo.combo_items) {
                    // Add stock (positive quantity)
                    await get().updateStock(
                        item.product_id,
                        item.quantity * quantity,
                        reason || `Nhập combo ${combo.name}`,
                        'purchase'
                    );
                }
                console.log(`📦 Combo purchased: ${combo.name} x${quantity} - ${combo.combo_items.length} components updated`);
            },
        }),
        {
            name: 'product-store',
            partialize: (state) => ({
                products: state.products,
            }),
        }
    )
);

// Selectors
export const useProducts = () => useProductStore((state) => state.products);
export const useLowStockProducts = () =>
    useProductStore((state) =>
        state.products.filter((p) => p.current_stock <= p.min_stock)
    );
