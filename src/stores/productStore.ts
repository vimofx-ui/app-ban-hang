// =============================================================================
// PRODUCT STORE - Product Management State
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useBrandStore } from '@/stores/brandStore';
import { useBranchStore } from '@/stores/branchStore';
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

                // Get Current Branch
                const currentBranch = useBranchStore.getState().currentBranch;

                set({ isLoading: true, error: null });

                if (isSupabaseConfigured() && supabase) {
                    try {
                        // 1. Fetch Base Products
                        let query = supabase
                            .from('products')
                            .select('*, units:product_units(*)')
                            // .eq('is_active', true) // Load all for SKU check and Inactive filter
                            .order('name');

                        // Filter by Brand if available (RLS handles this but good to be explicit/safe)
                        if (currentBranch?.brand_id) {
                            query = query.eq('brand_id', currentBranch.brand_id);
                        }

                        const { data: productsData, error: productError } = await query;

                        if (productError) throw productError;

                        let finalProducts = productsData as Product[];

                        // 2. Fetch Branch-Specific Data (Inventory & Pricing) if a branch is selected
                        if (currentBranch?.id) {
                            // Fetch Inventory for this branch
                            const { data: inventoryData } = await supabase
                                .from('inventories')
                                .select('product_id, quantity')
                                .eq('branch_id', currentBranch.id);

                            // Fetch Price Overrides for this branch
                            const { data: branchProductsData } = await supabase
                                .from('branch_products')
                                .select('product_id, price_override, is_active')
                                .eq('branch_id', currentBranch.id);

                            // Merge Data
                            if (inventoryData || branchProductsData) {
                                finalProducts = finalProducts.map(p => {
                                    const inv = inventoryData?.find(i => i.product_id === p.id);
                                    const override = branchProductsData?.find(o => o.product_id === p.id);

                                    return {
                                        ...p,
                                        // Override stock with branch inventory
                                        current_stock: inv ? inv.quantity : 0,
                                        // Override price if set
                                        selling_price: override?.price_override ?? p.selling_price,
                                        // Handle branch visibility (active status) if we want to filter hidden items
                                        is_active: override?.is_active ?? p.is_active
                                    };
                                });
                            }
                        }

                        set({ products: finalProducts, isLoading: false });
                    } catch (err) {
                        console.error('Failed to load products:', err);
                        set({
                            error: 'Không thể tải sản phẩm',
                            isLoading: false,
                            products: currentProducts.length > 0 ? currentProducts : MOCK_PRODUCTS
                        });
                    }
                } else {
                    // Demo mode
                    if (currentProducts.length === 0) {
                        set({ products: MOCK_PRODUCTS, isLoading: false });
                    } else {
                        set({ isLoading: false });
                    }
                }
            },

            // Add new product
            addProduct: async (productData) => {
                const { units, ...mainProductData } = productData;
                const user = useAuthStore.getState().user;
                const currentBranch = useBranchStore.getState().currentBranch;
                // Fallback to Brand Store if Branch is not selected (Critical for new setups)
                const currentBrand = useBrandStore.getState().currentBrand;
                const brandId = currentBranch?.brand_id || currentBrand?.id;

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
                    brand_id: brandId, // Assign to current brand
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    created_by: user?.id,
                    created_by_name: user?.name || user?.email || 'Unknown',
                    is_active: true, // IMPORTANT: Default active so it shows in list
                };

                // Remove undefined values
                if (!newProduct.image_url) delete newProduct.image_url;
                if (!newProduct.sku) delete newProduct.sku;
                if (!newProduct.barcode) delete newProduct.barcode;

                // Helper insert
                const executeInsert = async (dataToInsert: any) => {
                    const { created_by_name, ...cleanData } = dataToInsert;
                    const { error } = await supabase.from('products').insert(cleanData);
                    return error;
                };

                if (isSupabaseConfigured() && supabase) {
                    try {
                        let error = await executeInsert(newProduct);

                        // Retry Strategy
                        if (error && error.code === 'PGRST204') {
                            console.warn('Schema mismatch detected, retrying...', error.message);
                            const safeData: any = { ...newProduct };
                            // Remove columns that might not exist yet or cause issues
                            const columnsToRemove = [
                                'exclude_from_loyalty_points', 'category_ids', 'created_by', 'code',
                                'combo_items', 'variants', 'attributes', 'product_kind',
                                'avg_cost_price', 'total_cost_value', 'last_sold_at', 'total_sold',
                                'purchase_price', 'wholesale_price', 'weight', 'product_type_id', 'units'
                            ];
                            for (const col of columnsToRemove) delete safeData[col];
                            delete safeData.created_by_name;

                            error = await executeInsert(safeData);
                        }

                        if (error && error.code === '23505' && error.message?.includes('sku')) {
                            console.warn('Duplicate SKU detected, auto-generating new SKU...');
                            // Auto-fix SKU by appending a short random suffix
                            const safeData: any = { ...newProduct };
                            // Remove columns that might not exist yet (copy from above logic due to potential retry overlap)
                            const columnsToRemove = [
                                'exclude_from_loyalty_points', 'category_ids', 'created_by', 'code',
                                'combo_items', 'variants', 'attributes', 'product_kind',
                                'avg_cost_price', 'total_cost_value', 'last_sold_at', 'total_sold',
                                'purchase_price', 'wholesale_price', 'weight', 'product_type_id', 'units'
                            ];
                            for (const col of columnsToRemove) delete safeData[col];
                            delete safeData.created_by_name;

                            safeData.sku = `${safeData.sku || 'PVN'}-${Math.floor(Math.random() * 10000)}`;
                            newProduct.sku = safeData.sku; // Update main object too for state update

                            error = await executeInsert(safeData);
                        }

                        if (error) throw error;

                        // Initialize Inventory for this branch
                        if (currentBranch?.id) {
                            await supabase.from('inventories').insert({
                                branch_id: currentBranch.id,
                                brand_id: currentBranch.brand_id,
                                product_id: newProduct.id,
                                quantity: newProduct.current_stock || 0,
                                min_stock: newProduct.min_stock || 0
                            });
                        }

                        // Add units
                        if (units && units.length > 0) {
                            const unitsToInsert = units.map(u => ({
                                ...u,
                                id: generateId(),
                                product_id: newProduct.id,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }));
                            await supabase.from('product_units').insert(unitsToInsert);
                            newProduct.units = unitsToInsert;
                        }

                    } catch (err) {
                        console.error('Failed to add product:', err);

                        // Friendly Error Message
                        const errCode = (err as any)?.code;
                        const errMsg = (err as any)?.message || '';

                        let userMessage = 'Có lỗi xảy ra khi tạo sản phẩm.';
                        if (errCode === '23505') {
                            if (errMsg.includes('sku')) userMessage = 'Mã sản phẩm (SKU) đã tồn tại. Hệ thống đã thử tự động sửa nhưng thất bại. Vui lòng thử lại.';
                            else if (errMsg.includes('barcode')) userMessage = 'Mã vạch (Barcode) đã tồn tại.';
                        } else if (errCode === 'PGRST204') {
                            userMessage = 'Lỗi cấu hình CSDL (Missing Column). Vui lòng liên hệ Admin.';
                        } else {
                            userMessage = `${userMessage}\n${errMsg}`;
                        }

                        alert(userMessage);
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

                // Barcode/Category logic
                if (currentProduct) {
                    const hadBarcode = currentProduct.barcode && currentProduct.barcode.trim() !== '';
                    const hasBarcode = updates.barcode !== undefined
                        ? updates.barcode && updates.barcode.trim() !== ''
                        : hadBarcode;
                    if (!hadBarcode && hasBarcode && currentProduct.category_id === NO_BARCODE_CATEGORY_ID) {
                        updatedData.category_id = undefined;
                    }
                    if (hadBarcode && !hasBarcode) {
                        useCategoryStore.getState().getOrCreateNoBarcodeCategory();
                        updatedData.category_id = NO_BARCODE_CATEGORY_ID;
                    }
                }

                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { error } = await supabase
                            .from('products')
                            .update(updatedData)
                            .eq('id', id);

                        if (error) throw error; // Handle retries if needed similar to addProduct

                        // Units Update Logic (Simplified)
                        if (units) {
                            const { data: existingUnits } = await supabase.from('product_units').select('id').eq('product_id', id);
                            const existingIds = existingUnits?.map(u => u.id) || [];
                            const incomingIds = units.filter(u => u.id).map(u => u.id);
                            const idsToDelete = existingIds.filter(id => !incomingIds.includes(id));

                            if (idsToDelete.length > 0) await supabase.from('product_units').delete().in('id', idsToDelete);

                            const unitsToUpsert = units.map(u => {
                                // Check if ID is valid UUID, otherwise generate new one (for new units added in UI)
                                const isValidUUID = u.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u.id);
                                const finalId = isValidUUID ? u.id : generateId();

                                return {
                                    ...u,
                                    id: finalId,
                                    product_id: id,
                                    updated_at: new Date().toISOString(),
                                    created_at: u.created_at || new Date().toISOString(),
                                };
                            });

                            if (unitsToUpsert.length > 0) await supabase.from('product_units').upsert(unitsToUpsert);
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

            // Delete product
            deleteProduct: async (id) => {
                if (isSupabaseConfigured() && supabase) {
                    try {
                        await supabase.from('products').update({ is_active: false }).eq('id', id);
                    } catch (err) {
                        console.error('Failed to delete product:', err);
                        throw err;
                    }
                }
                set((state) => ({ products: state.products.filter((p) => p.id !== id) }));
            },

            getProductById: (id) => get().products.find((p) => p.id === id),
            getProductByBarcode: (barcode) => get().products.find((p) => p.barcode === barcode),
            searchProducts: (query) => {
                const lowerQuery = query.toLowerCase();
                return get().products.filter((p) =>
                    p.name.toLowerCase().includes(lowerQuery) || p.sku?.toLowerCase().includes(lowerQuery) || p.barcode?.includes(query)
                );
            },

            // Update Stock (Multi-Branch Aware)
            updateStock: async (productId, quantityChange, reason, referenceType = 'manual') => {
                const product = get().products.find(p => p.id === productId);
                const currentBranch = useBranchStore.getState().currentBranch;
                if (!product) return;

                const newStock = (product.current_stock || 0) + quantityChange;

                // Check negative stock
                const allowNegative = referenceType === 'sale' || product.allow_negative_stock;
                if (newStock < 0 && !allowNegative) throw new Error('Không đủ tồn kho');

                // Movement Type
                let movementType = 'adjustment_in';
                if (referenceType === 'sale') movementType = 'sale';
                else if (referenceType === 'purchase') movementType = 'purchase';
                else if (referenceType === 'return') movementType = 'return';
                else if (quantityChange < 0) movementType = 'adjustment_out';

                if (isSupabaseConfigured() && supabase) {
                    try {
                        const userId = useAuthStore.getState().user?.id;

                        // 1. Update INVENTORIES table if branch is selected (Preferred)
                        if (currentBranch?.id) {
                            // Check if inventory record exists
                            const { data: inv, error: fetchErr } = await supabase
                                .from('inventories')
                                .select('id, quantity')
                                .eq('branch_id', currentBranch.id)
                                .eq('product_id', productId)
                                .single();

                            if (inv) {
                                // Update existing
                                await supabase.from('inventories')
                                    .update({
                                        quantity: inv.quantity + quantityChange,
                                        updated_at: new Date().toISOString()
                                    })
                                    .eq('id', inv.id);
                            } else {
                                // Create new inventory record
                                await supabase.from('inventories').insert({
                                    branch_id: currentBranch.id,
                                    brand_id: currentBranch.brand_id,
                                    product_id: productId,
                                    quantity: quantityChange, // Start with this change
                                    min_stock: product.min_stock || 0
                                });
                            }
                        } else {
                            // Fallback: Update legacy products.current_stock (no branch context)
                            await supabase.from('products')
                                .update({ current_stock: newStock, updated_at: new Date().toISOString() })
                                .eq('id', productId);
                        }

                        // 2. Log Movement
                        await supabase.from('stock_movements').insert({
                            product_id: productId,
                            movement_type: movementType,
                            quantity: Math.abs(quantityChange),
                            stock_before: product.current_stock,
                            stock_after: newStock,
                            reference_type: referenceType,
                            created_by: userId,
                            notes: reason,
                            // Add branch_id to stock_movements if the table supports it (Phase 2 TODO: Add branch_id column to stock_movements)
                        });

                    } catch (err) {
                        console.error('Failed to update stock:', err);
                        throw err;
                    }
                }

                // Update Local State
                set((state) => ({
                    products: state.products.map((p) =>
                        p.id === productId
                            ? { ...p, current_stock: newStock, updated_at: new Date().toISOString() }
                            : p
                    ),
                }));
                console.log(`📦 Stock updated: ${product.name} ${quantityChange > 0 ? '+' : ''}${quantityChange} (${reason})`);
            },

            // Update stock with Cost (Purchase)
            updateStockWithCost: async (productId, quantityIn, unitCost, reason, referenceId) => {
                // This logic is complex for multi-branch average cost. 
                // Either we track cost per branch, or global average.
                // For now, we'll keep updating the Product's global cost/price, but update the Branch's inventory quantity.

                const product = get().products.find(p => p.id === productId);
                const currentBranch = useBranchStore.getState().currentBranch;
                if (!product || quantityIn <= 0) return;

                const oldStock = product.current_stock || 0; // This is branch stock now!
                // We should probably get GLOBAL stock for accurate avg cost, but for MVP let's use what we have.
                const oldAvgCost = product.avg_cost_price || product.cost_price || 0;
                const newStock = oldStock + quantityIn;

                const newAvgCost = oldStock > 0
                    ? Math.round((oldStock * oldAvgCost + quantityIn * unitCost) / newStock)
                    : unitCost;

                if (isSupabaseConfigured() && supabase) {
                    try {
                        // 1. Update Inventory Quantity (Branch)
                        if (currentBranch?.id) {
                            const { data: inv } = await supabase.from('inventories')
                                .select('id, quantity').eq('branch_id', currentBranch.id).eq('product_id', productId).single();

                            if (inv) {
                                await supabase.from('inventories').update({ quantity: inv.quantity + quantityIn }).eq('id', inv.id);
                            } else {
                                await supabase.from('inventories').insert({
                                    branch_id: currentBranch.id, brand_id: currentBranch.brand_id, product_id: productId, quantity: quantityIn
                                });
                            }
                        }

                        // 2. Update Product Cost (Global)
                        await supabase.from('products').update({
                            purchase_price: unitCost,
                            cost_price: newAvgCost,
                            avg_cost_price: newAvgCost,
                            updated_at: new Date().toISOString()
                        }).eq('id', productId);

                        // 3. Log
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
                        console.error('Failed to update stock/cost:', err);
                        throw err;
                    }
                }

                set((state) => ({
                    products: state.products.map((p) =>
                        p.id === productId
                            ? { ...p, current_stock: newStock, purchase_price: unitCost, cost_price: newAvgCost, avg_cost_price: newAvgCost }
                            : p
                    ),
                }));
            },

            sellCombo: async (comboId, quantity, reason) => {
                const combo = get().getProductById(comboId);
                if (!combo || combo.product_kind !== 'combo' || !combo.combo_items) return;
                for (const item of combo.combo_items) {
                    await get().updateStock(item.product_id, -item.quantity * quantity, reason || `Bán combo ${combo.name}`, 'sale');
                }
            },

            purchaseCombo: async (comboId, quantity, reason) => {
                const combo = get().getProductById(comboId);
                if (!combo || combo.product_kind !== 'combo' || !combo.combo_items) return;
                for (const item of combo.combo_items) {
                    await get().updateStock(item.product_id, item.quantity * quantity, reason || `Nhập combo ${combo.name}`, 'purchase');
                }
            },
        }),
        {
            name: 'product-store',
            partialize: (state) => ({ products: state.products }),
        }
    )
);

export const useProducts = () => useProductStore((state) => state.products);
export const useLowStockProducts = () => useProductStore((state) => state.products.filter((p) => p.current_stock <= p.min_stock));

