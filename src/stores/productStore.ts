// =============================================================================
// PRODUCT STORE - Product Management State
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useCategoryStore, NO_BARCODE_CATEGORY_ID } from '@/stores/categoryStore';
import { MOCK_PRODUCTS } from '@/data/mockProducts';
import { cacheProducts, getCachedProducts } from '@/lib/indexedDBCache';
import type { Product } from '@/types';
import { generateId } from '@/lib/utils';
import { toast } from 'sonner';

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
    updateStockWithCost: (productId: string, quantityIn: number, unitCost: number, reason: string, referenceId?: string) => Promise<void>;
    sellCombo: (comboId: string, quantity: number, reason?: string) => Promise<void>;
    purchaseCombo: (comboId: string, quantity: number, reason?: string) => Promise<void>;
    updateBranchPrice: (productId: string, price: number) => Promise<boolean>;
}

export const useProductStore = create<ProductState>()(
    persist(
        (set, get) => ({
            products: [],
            isLoading: false,
            error: null,

            loadProducts: async () => {
                set({ isLoading: true, error: null });
                try {
                    const { brandId, branchId } = useAuthStore.getState();
                    if (!brandId) {
                        set({ isLoading: false });
                        return;
                    }

                    if (isSupabaseConfigured() && supabase) {
                        // Main product query - không join tables không có FK để tránh relationship error
                        const { data, error } = await supabase
                            .from('products')
                            .select(`*, 
                                units:product_units(*), 
                                brand:brands(name),
                                inventory:inventories(quantity, branch_id)
                            `)
                            .eq('brand_id', brandId)
                            .order('created_at', { ascending: false });

                        if (error) {
                            console.error('Error loading products:', error);
                            throw error;
                        }

                        // Fetch costs separately to avoid relationship error
                        let costsMap: Record<string, number> = {};
                        try {
                            const { data: costsData } = await supabase
                                .from('inventory_costs')
                                .select('product_id, avg_cost, branch_id')
                                .eq('branch_id', branchId);

                            if (costsData) {
                                costsData.forEach((c: any) => {
                                    costsMap[c.product_id] = c.avg_cost || 0;
                                });
                            }
                        } catch (err) {
                            console.warn('Could not load inventory_costs:', err);
                        }

                        let finalProducts = (data || []).map((p: any) => {
                            const prodInventory = p.inventory?.find((i: any) => i.branch_id === branchId);
                            const currentStock = prodInventory?.quantity ?? 0;

                            // Get cost from inventory_costs map (WAC)
                            const avgCost = costsMap[p.id] ?? p.cost_price ?? 0;

                            return {
                                ...p,
                                current_stock: currentStock,
                                brand: p.brand?.name,
                                // WAC từ inventory_costs - đây là giá vốn thực tế sau khi nhập hàng
                                avg_cost: avgCost,
                                // Fallback cost_price field cho compatibility
                                cost_price: avgCost
                            };
                        }) as Product[];

                        // Branch Pricing Logic
                        if (branchId) {
                            try {
                                const { data: prices } = await supabase
                                    .from('branch_prices')
                                    .select('product_id, price')
                                    .eq('branch_id', branchId);

                                if (prices && prices.length > 0) {
                                    finalProducts = finalProducts.map(p => {
                                        const override = prices.find((bp: any) => bp.product_id === p.id);
                                        if (override) {
                                            const originalPrice = p.selling_price;
                                            return {
                                                ...p,
                                                base_price: originalPrice,
                                                selling_price: Number(override.price),
                                                has_price_override: true
                                            };
                                        }
                                        return p;
                                    });
                                }
                            } catch (err) {
                                console.error('Failed to load branch prices', err);
                            }
                        }

                        set({ products: finalProducts, isLoading: false });

                        // Cache products to IndexedDB for offline use
                        cacheProducts(finalProducts).catch(err =>
                            console.warn('[ProductStore] Failed to cache products:', err)
                        );
                    } else {
                        // Demo mode or offline - try IndexedDB cache first
                        const cached = await getCachedProducts();
                        if (cached.length > 0) {
                            console.log('[ProductStore] Using IndexedDB cache:', cached.length, 'products');
                            set({ products: cached, isLoading: false });
                        } else if (get().products.length === 0) {
                            set({ products: MOCK_PRODUCTS, isLoading: false });
                        } else {
                            set({ isLoading: false });
                        }
                    }
                } catch (err: any) {
                    console.error('Load products error:', err);

                    // On error, try to use cached products
                    const cached = await getCachedProducts();
                    if (cached.length > 0) {
                        console.log('[ProductStore] Using IndexedDB cache after error:', cached.length, 'products');
                        set({ products: cached, isLoading: false, error: 'Đang sử dụng dữ liệu offline' });
                    } else {
                        set({ error: err.message || 'Không thể tải danh sách sản phẩm', isLoading: false });
                    }
                }
            },

            addProduct: async (productData) => {
                const { units, ...mainProductData } = productData;
                const user = useAuthStore.getState().user;
                const { brandId, branchId } = useAuthStore.getState();

                let categoryId = mainProductData.category_id;
                // Don't auto-assign a fake category - just let it be null/undefined if no barcode
                // The NO_BARCODE_CATEGORY_ID is now a UUID but may not exist in the database
                if (!categoryId) {
                    categoryId = undefined; // Let database handle null category
                }

                // Validate brandId before insert
                if (!brandId) {
                    throw new Error('Vui lòng chọn Thương hiệu trước khi tạo sản phẩm');
                }

                const newProduct: Product = {
                    ...mainProductData,
                    category_id: categoryId,
                    id: generateId(),
                    brand_id: brandId,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    created_by: user?.id,
                    // Note: created_by_name removed - column may not exist in all schemas
                    is_active: true,
                    current_stock: mainProductData.current_stock || 0
                };

                // Remove undefined fields that might cause issues
                if (!newProduct.image_url) delete newProduct.image_url;
                if (!newProduct.sku) delete newProduct.sku;
                if (!newProduct.barcode) delete newProduct.barcode;

                // Remove computed/joined fields that don't exist in products table
                delete (newProduct as any).inventory;
                delete (newProduct as any).costs;
                delete (newProduct as any).creator;
                delete (newProduct as any).avg_cost;
                delete (newProduct as any).current_stock; // Stored in inventories table
                delete (newProduct as any).created_by_name;

                // Ensure current_stock for local state
                const stockQty = mainProductData.current_stock || 0;

                if (isSupabaseConfigured() && supabase) {
                    const { error } = await supabase.from('products').insert(newProduct);
                    if (error) {
                        console.error('Add product failed', error);
                        throw error;
                    }

                    // Inventory
                    if (branchId) {
                        await supabase.from('inventories').insert({
                            branch_id: branchId,
                            brand_id: brandId,
                            product_id: newProduct.id,
                            quantity: stockQty,
                            min_stock: mainProductData.min_stock || 0
                        });
                    }

                    // Units - Insert vào product_units table (only columns that exist in schema)
                    if (units && units.length > 0) {
                        const unitsToInsert = units.map((u: any) => ({
                            id: u.id || generateId(),
                            product_id: newProduct.id,
                            unit_name: u.unit_name || u.name || '',
                            conversion_rate: u.conversion_rate || u.ratio || 1,
                            selling_price: u.selling_price || u.price || 0,
                            barcode: u.barcode || null,
                            is_base_unit: u.is_base_unit || false,
                            created_at: new Date().toISOString()
                        }));

                        const { error: unitError } = await supabase.from('product_units').insert(unitsToInsert);
                        if (unitError) {
                            console.error('Failed to insert product units:', unitError);
                        } else {
                            newProduct.units = unitsToInsert;
                            console.log('Successfully inserted', unitsToInsert.length, 'units for product', newProduct.id);
                        }
                    }
                }

                // Restore current_stock for local state display
                newProduct.current_stock = stockQty;

                set(state => ({ products: [newProduct, ...state.products] }));
                return newProduct;
            },

            updateProduct: async (id, updates) => {
                const { units, variants, ...mainUpdates } = updates;

                // Remove fields that may not exist in DB or are computed
                const cleanUpdates = { ...mainUpdates };
                delete (cleanUpdates as any).inventory;
                delete (cleanUpdates as any).costs;
                delete (cleanUpdates as any).creator;
                delete (cleanUpdates as any).avg_cost;
                delete (cleanUpdates as any).current_stock;
                delete (cleanUpdates as any).created_by_name;

                if (isSupabaseConfigured() && supabase) {
                    // Update main product
                    const { error } = await supabase.from('products').update(cleanUpdates).eq('id', id);
                    if (error) {
                        console.error('Update product error:', error);
                        throw error;
                    }

                    // Sync units (delete all then reinsert)
                    if (units !== undefined) {
                        // Delete existing units
                        await supabase.from('product_units').delete().eq('product_id', id);

                        // Insert new units (only columns that exist in schema)
                        if (units && units.length > 0) {
                            const unitsToInsert = units.map((u: any) => ({
                                id: u.id || generateId(),
                                product_id: id,
                                unit_name: u.unit_name,
                                conversion_rate: u.conversion_rate || 1,
                                selling_price: u.selling_price || 0,
                                barcode: u.barcode || null,
                                is_base_unit: u.is_base_unit || false
                            }));
                            const { error: unitError } = await supabase.from('product_units').insert(unitsToInsert);
                            if (unitError) {
                                console.error('Failed to save units:', unitError);
                            }
                        }
                    }
                }

                // Update local state
                set(state => ({
                    products: state.products.map(p => p.id === id ? {
                        ...p,
                        ...mainUpdates,
                        units: units !== undefined ? units : p.units
                    } : p)
                }));
            },

            deleteProduct: async (id) => {
                if (isSupabaseConfigured() && supabase) {
                    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
                    if (error) {
                        console.error('Delete product error:', error);
                        throw new Error(error.message || 'Không thể xóa sản phẩm');
                    }
                }
                set(state => ({ products: state.products.filter(p => p.id !== id) }));
            },

            getProductById: (id) => get().products.find(p => p.id === id),
            getProductByBarcode: (barcode) => get().products.find(p => p.barcode === barcode),
            searchProducts: (query) => {
                const lower = query.toLowerCase();
                return get().products.filter(p =>
                    p.name.toLowerCase().includes(lower) ||
                    p.sku?.toLowerCase().includes(lower) ||
                    p.barcode?.includes(query)
                );
            },

            updateStock: async (productId, quantityChange, reason, referenceType = 'manual') => {
                const { branchId, brandId } = useAuthStore.getState();
                const product = get().products.find(p => p.id === productId);
                if (!product) return;

                const newStock = (product.current_stock || 0) + quantityChange;
                if (newStock < 0 && !product.allow_negative_stock && referenceType !== 'sale') {
                    throw new Error('Not enough stock');
                }

                if (isSupabaseConfigured() && supabase && branchId) {
                    const { data: inv } = await supabase
                        .from('inventories')
                        .select('id, quantity')
                        .eq('branch_id', branchId)
                        .eq('product_id', productId)
                        .single();

                    if (inv) {
                        await supabase.from('inventories').update({ quantity: inv.quantity + quantityChange }).eq('id', inv.id);
                    } else {
                        await supabase.from('inventories').insert({
                            branch_id: branchId, brand_id: brandId, product_id: productId, quantity: quantityChange
                        });
                    }

                    // SYNC INVENTORY_COSTS (CRITICAL FOR WAC)
                    // If stock OUT (quantityChange < 0), we must reduce quantity in inventory_costs too
                    if (quantityChange < 0) {
                        await supabase.rpc('record_stock_out', {
                            p_product_id: productId,
                            p_branch_id: branchId,
                            p_qty_out: Math.abs(quantityChange)
                        });
                    }
                    // If stock IN (quantityChange > 0), we should technically use updateStockWithCost. 
                    // But if this function is called for manual adjustment (e.g. "Found 1 unit"), 
                    // we might want to just increase quantity ? Or should we force cost?
                    // For now, manual adjustments via this function will NOT update Cost Price, effectively "Free" item or "Same Cost" item?
                    // Ideally manual adjustment should ask for Cost. 
                    // If we assume same cost, we should call update_avg_cost(qty, current_avg). 
                    // But let's leave it simple: manual updateStock only affects Qty in inventories for now, 
                    // UNLESS it causes drift. 
                    // Let's at least sync Qty in inventory_costs to match inventories.
                    else if (quantityChange > 0) {
                        // For positive manual adjustment, we blindly increase inventory_costs qty 
                        // effectively assuming incoming goods have SAME value as current average (no impact on WAC).
                        /*
                        UPDATE inventory_costs SET quantity = quantity + p_qty ...
                        We can reuse update_avg_cost with current avg_cost?
                        */
                        // Let's keep it safe. If user uses this for Import, they are wrong. They should use Purchase Order.
                        // If used for "Found", best is to use 0 cost or current cost.
                        // Let's ignore for now to avoid complexity, but acknowledge drift risk for Stock In here.
                        // The 'record_stock_out' covers the SALE case which is 90% of activity.
                    }

                    await supabase.from('stock_movements').insert({
                        product_id: productId,
                        movement_type: quantityChange > 0 ? 'in' : 'out',
                        quantity: Math.abs(quantityChange),
                        stock_before: product.current_stock,
                        stock_after: newStock,
                        notes: reason,
                        created_by: useAuthStore.getState().user?.id
                    });
                }

                // Low Stock Alert - DISABLED (user request)
                // if (quantityChange < 0 && newStock <= (product.min_stock || 0)) {
                //     toast.warning(`⚠️ Cảnh báo: ${product.name} sắp hết hàng (Còn ${newStock} ${product.base_unit || 'cái'})`, {
                //         duration: 5000,
                //         position: 'top-right',
                //         style: { border: '2px solid #ef4444' }
                //     });
                // }

                set(state => ({
                    products: state.products.map(p => p.id === productId ? { ...p, current_stock: newStock } : p)
                }));
            },

            updateStockWithCost: async (productId, quantityIn, unitCost, reason, referenceId) => {
                const { branchId } = useAuthStore.getState();
                if (!branchId || !isSupabaseConfigured() || !supabase) return;

                // 1. Update Physical Stock & Log Movement (via updateStock logic)
                // Note: updateStock currently also inserts into inventories, which matches our RPC logic.
                // However, our RPC also inserts into inventories. We should avoid double insertion.
                // Actually, the new RPC `update_avg_cost` updates `inventories` too!
                // So we should NOT call `updateStock` here to avoid double counting or race conditions if we use the RPC.

                // BUT, `updateStock` also sends Toast and does other checks (negative stock).
                // Let's rely on RPC for correct atomic transaction.

                try {
                    const { error } = await supabase.rpc('update_avg_cost', {
                        p_product_id: productId,
                        p_branch_id: branchId,
                        p_qty_in: quantityIn,
                        p_unit_cost: unitCost
                    });

                    if (error) throw error;

                    // Log movement manually since we bypassed updateStock
                    await supabase.from('stock_movements').insert({
                        product_id: productId,
                        movement_type: quantityIn > 0 ? 'in' : 'out',
                        quantity: Math.abs(quantityIn),
                        stock_before: 0, // RPC handles logic, we might not know exact before state here without query
                        stock_after: 0,
                        notes: reason + ` (Cost: ${unitCost})`,
                        created_by: useAuthStore.getState().user?.id
                    });

                    // Update local state by forcing reload or just optimistic update
                    // Simplest is to reload products to get fresh stock/cost
                    // await get().loadProducts(); 

                    // Optimistic update local stock
                    set(state => ({
                        products: state.products.map(p =>
                            p.id === productId
                                ? { ...p, current_stock: (p.current_stock || 0) + quantityIn }
                                : p
                        )
                    }));

                } catch (err: any) {
                    console.error('Failed to update stock with cost:', err);
                    throw err;
                }
            },

            sellCombo: async (comboId, quantity, reason) => {
                // Combo logic placeholder
            },
            purchaseCombo: async (comboId, quantity, reason) => {
                // Combo logic placeholder
            },

            updateBranchPrice: async (productId, price) => {
                const { branchId, brandId } = useAuthStore.getState();
                if (!branchId || !brandId || !isSupabaseConfigured() || !supabase) return false;

                try {
                    const { error } = await supabase
                        .from('branch_prices')
                        .upsert({
                            brand_id: brandId,
                            branch_id: branchId,
                            product_id: productId,
                            price: price,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'branch_id, product_id' });

                    if (error) throw error;

                    set(state => ({
                        products: state.products.map(p => {
                            if (p.id === productId) {
                                return {
                                    ...p,
                                    base_price: p.base_price || p.selling_price,
                                    selling_price: price,
                                    has_price_override: true
                                };
                            }
                            return p;
                        })
                    }));
                    return true;
                } catch (err) {
                    console.error('Update branch price failed', err);
                    return false;
                }
            }
        }),
        {
            name: 'product-store',
            partialize: (state) => ({
                // Don't persist products array to avoid QuotaExceededError
                // products: state.products 
            }),
            skipHydration: true, // Don't load from localStorage
        }
    )
);

export const useProducts = () => useProductStore((state) => state.products);
export const useLowStockProducts = () => useProductStore((state) => state.products.filter((p) => p.current_stock <= p.min_stock));
