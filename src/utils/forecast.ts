// =============================================================================
// FORECAST UTILITY - Sales Forecasting for Smart Purchase Orders
// =============================================================================

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useBranchStore } from '@/stores/branchStore';
import { useBrandStore } from '@/stores/brandStore';

// =============================================================================
// TYPES
// =============================================================================

export interface ProductForecast {
    product_id: string;
    product_name: string;
    product_sku: string;
    current_stock: number;
    min_stock: number;
    shortage: number;
    suggested_supplier_id: string | null;
    suggested_supplier_name: string | null;
    suggested_price: number | null;
    avg_daily_sales: number;
    suggested_quantity: number;
}

export interface SupplierPriceComparison {
    supplier_id: string;
    supplier_name: string;
    last_import_price: number;
    avg_import_price: number;
    min_import_price: number;
    max_import_price: number;
    last_import_date: string | null;
    total_import_count: number;
    is_preferred: boolean;
    is_cheapest: boolean;
}

// =============================================================================
// FORECAST CALCULATIONS (Local fallback when DB functions unavailable)
// =============================================================================

/**
 * Calculate suggested order quantity based on sales forecast
 * Formula: (avg_daily_sales * days_to_stock) + shortage
 */
export function calculateSuggestedQuantity(
    avgDailySales: number,
    currentStock: number,
    minStock: number,
    daysToStock: number = 14
): number {
    const shortage = Math.max(0, minStock - currentStock);
    const forecast = avgDailySales * daysToStock;
    return Math.max(1, Math.ceil(forecast + shortage));
}

/**
 * Calculate average daily sales from order data
 */
export function calculateAvgDailySales(
    totalSold: number,
    daysInPeriod: number = 30
): number {
    return daysInPeriod > 0 ? totalSold / daysInPeriod : 0;
}

// =============================================================================
// DATABASE QUERIES
// =============================================================================

/**
 * Get products needing reorder with suggested quantities and suppliers
 */
export async function getProductsNeedingReorder(): Promise<ProductForecast[]> {
    if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured, returning empty list');
        return [];
    }

    const currentBrand = useBrandStore.getState().currentBrand;
    if (!currentBrand?.id) {
        console.warn('No brand selected');
        return [];
    }

    try {
        const { data, error } = await supabase.rpc('get_products_needing_reorder', {
            p_brand_id: currentBrand.id
        });

        if (error) throw error;
        return (data || []) as ProductForecast[];
    } catch (err) {
        console.error('Failed to get products needing reorder:', err);
        return [];
    }
}

/**
 * Get supplier price comparison for a product
 */
export async function getSupplierPriceComparison(
    productId: string
): Promise<SupplierPriceComparison[]> {
    if (!isSupabaseConfigured()) {
        return [];
    }

    try {
        const { data, error } = await supabase.rpc('get_supplier_price_comparison', {
            p_product_id: productId
        });

        if (error) throw error;
        return (data || []) as SupplierPriceComparison[];
    } catch (err) {
        console.error('Failed to get supplier price comparison:', err);
        return [];
    }
}

// =============================================================================
// SMART PO GENERATION
// =============================================================================

export interface SmartPOInput {
    supplier_id: string;
    products: Array<{
        product_id: string;
        product_name: string;
        quantity: number;
        unit_price: number;
    }>;
}

/**
 * Group products by suggested supplier for smart PO creation
 */
export function groupProductsBySupplier(
    products: ProductForecast[]
): SmartPOInput[] {
    const supplierMap = new Map<string, SmartPOInput>();

    for (const product of products) {
        // Skip products without a suggested supplier
        if (!product.suggested_supplier_id) continue;

        const supplierId = product.suggested_supplier_id;

        if (!supplierMap.has(supplierId)) {
            supplierMap.set(supplierId, {
                supplier_id: supplierId,
                products: []
            });
        }

        supplierMap.get(supplierId)!.products.push({
            product_id: product.product_id,
            product_name: product.product_name,
            quantity: product.suggested_quantity,
            unit_price: product.suggested_price || 0
        });
    }

    return Array.from(supplierMap.values());
}

// =============================================================================
// SUPPLIER-PRODUCT MAPPING
// =============================================================================

export interface SupplierProductMapping {
    id: string;
    supplier_id: string;
    product_id: string;
    last_import_price: number;
    avg_import_price: number;
    min_import_price: number;
    max_import_price: number;
    last_import_date: string | null;
    total_import_count: number;
    total_import_quantity: number;
    is_preferred: boolean;
}

/**
 * Update supplier-product mapping after a PO is received
 * Called from purchaseOrderStore when receiving order
 */
export async function updateSupplierProductMapping(
    supplierId: string,
    items: Array<{
        product_id: string;
        unit_price: number;
        received_quantity: number;
    }>
): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const currentBrand = useBrandStore.getState().currentBrand;
    if (!currentBrand?.id) return;

    for (const item of items) {
        try {
            // Check if mapping exists
            const { data: existing } = await supabase
                .from('supplier_products')
                .select('*')
                .eq('brand_id', currentBrand.id)
                .eq('supplier_id', supplierId)
                .eq('product_id', item.product_id)
                .maybeSingle();

            if (existing) {
                // Update existing
                const newAvg = (existing.avg_import_price * existing.total_import_count + item.unit_price)
                    / (existing.total_import_count + 1);

                await supabase
                    .from('supplier_products')
                    .update({
                        last_import_price: item.unit_price,
                        avg_import_price: newAvg,
                        min_import_price: Math.min(existing.min_import_price, item.unit_price),
                        max_import_price: Math.max(existing.max_import_price, item.unit_price),
                        last_import_date: new Date().toISOString(),
                        total_import_count: existing.total_import_count + 1,
                        total_import_quantity: existing.total_import_quantity + item.received_quantity,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
            } else {
                // Create new
                await supabase
                    .from('supplier_products')
                    .insert({
                        brand_id: currentBrand.id,
                        supplier_id: supplierId,
                        product_id: item.product_id,
                        last_import_price: item.unit_price,
                        avg_import_price: item.unit_price,
                        min_import_price: item.unit_price,
                        max_import_price: item.unit_price,
                        last_import_date: new Date().toISOString(),
                        total_import_count: 1,
                        total_import_quantity: item.received_quantity
                    });
            }
        } catch (err) {
            console.error('Failed to update supplier-product mapping:', err);
        }
    }
}

/**
 * Get all supplier-product mappings for a product
 */
export async function getProductSuppliers(
    productId: string
): Promise<SupplierProductMapping[]> {
    if (!isSupabaseConfigured()) return [];

    try {
        const { data, error } = await supabase
            .from('supplier_products')
            .select('*')
            .eq('product_id', productId)
            .order('last_import_price', { ascending: true });

        if (error) throw error;
        return (data || []) as SupplierProductMapping[];
    } catch (err) {
        console.error('Failed to get product suppliers:', err);
        return [];
    }
}

/**
 * Set a supplier as preferred for a product
 */
export async function setPreferredSupplier(
    productId: string,
    supplierId: string
): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const currentBrand = useBrandStore.getState().currentBrand;
    if (!currentBrand?.id) return;

    try {
        // Clear existing preferred
        await supabase
            .from('supplier_products')
            .update({ is_preferred: false })
            .eq('brand_id', currentBrand.id)
            .eq('product_id', productId);

        // Set new preferred
        await supabase
            .from('supplier_products')
            .update({ is_preferred: true })
            .eq('brand_id', currentBrand.id)
            .eq('product_id', productId)
            .eq('supplier_id', supplierId);
    } catch (err) {
        console.error('Failed to set preferred supplier:', err);
    }
}
