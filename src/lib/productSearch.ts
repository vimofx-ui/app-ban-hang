import type { Product, ProductUnit, ProductSearchItem } from '@/types';

/**
 * Remove Vietnamese diacritics for fuzzy matching
 */
export function removeVietnameseDiacritics(str: string): string {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}

/**
 * Tokenize a string into searchable words
 */
function tokenize(str: string): string[] {
    return str.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Check if all query tokens are found in the target string
 * Supports flexible word order and Vietnamese diacritics
 */
export function fuzzyMatch(target: string, query: string): boolean {
    if (!query.trim()) return true;

    const normalizedTarget = removeVietnameseDiacritics(target.toLowerCase());
    const normalizedQuery = removeVietnameseDiacritics(query.toLowerCase());

    // Check if query as a whole is contained
    if (normalizedTarget.includes(normalizedQuery)) return true;

    // Check if all query tokens are found (flexible word order)
    const queryTokens = tokenize(normalizedQuery);
    const targetTokens = tokenize(normalizedTarget);

    // Every token in query must be found as substring in target
    return queryTokens.every(qt =>
        normalizedTarget.includes(qt) ||
        targetTokens.some(tt => tt.includes(qt) || qt.includes(tt))
    );
}

/**
 * Format stock with up to 3 decimal places, removing trailing zeros
 */
export function formatStock(stock: number): number {
    return Math.round(stock * 1000) / 1000;
}

/**
 * Converts a Product or Product+Unit into a standardized ProductSearchItem
 */
export function toSearchItem(product: Product, unit?: ProductUnit): ProductSearchItem {
    if (unit) {
        // Calculate stock with decimals (up to 3 decimal places)
        const rawStock = product.current_stock / unit.conversion_rate;
        // Use unit_name as fallback ID when unit.id is empty
        const unitIdentifier = unit.id || unit.unit_name || `unit-${unit.conversion_rate}`;
        return {
            id: `${product.id}-${unitIdentifier}`,
            product_id: product.id,
            name: `${product.name} (${unit.unit_name})`,
            unit_name: unit.unit_name,
            barcode: unit.barcode,
            sku: (unit.barcode || product.sku) || undefined,
            price: unit.selling_price || (product.selling_price * unit.conversion_rate),
            cost_price: product.cost_price * unit.conversion_rate,
            purchase_price: product.purchase_price ? product.purchase_price * unit.conversion_rate : undefined,
            stock: formatStock(rawStock),
            image_url: product.image_url || undefined,
            type: 'unit',
            product: product,
            unit: unit
        };
    } else {
        return {
            id: product.id,
            product_id: product.id,
            name: `${product.name} (${product.base_unit})`,
            unit_name: product.base_unit,
            barcode: product.barcode || undefined,
            sku: product.sku || undefined,
            price: product.selling_price,
            cost_price: product.cost_price,
            purchase_price: product.purchase_price,
            stock: formatStock(product.current_stock),
            image_url: product.image_url || undefined,
            type: 'product',
            product: product,
            unit: undefined
        };
    }
}

/**
 * Search products and return expanded results (Base + Units)
 * Supports Vietnamese diacritics, flexible word order
 * Uses Set to prevent duplicates
 */
export function searchProducts(products: Product[], query: string, expandAll = false): ProductSearchItem[] {
    const resultMap = new Map<string, ProductSearchItem>();
    const trimmedQuery = query.trim();

    console.log(`[SEARCH] Query: "${trimmedQuery}", Products count: ${products.length}`);

    for (const product of products) {
        // 1. If no query, return base products (and units if expandAll)
        if (!trimmedQuery) {
            const baseItem = toSearchItem(product);
            resultMap.set(baseItem.id, baseItem);
            if (expandAll) {
                product.units?.forEach(u => {
                    const unitItem = toSearchItem(product, u);
                    resultMap.set(unitItem.id, unitItem);
                });
            }
            continue;
        }

        // 2. Check if product name/sku/barcode/code matches
        const productSearchable = [
            product.name,
            product.sku || '',
            product.barcode || '',
            product.code || ''
        ].join(' ');

        const productMatches = fuzzyMatch(productSearchable, trimmedQuery);

        if (productMatches) {
            console.log(`[SEARCH] ✓ Match: "${product.name}" has ${product.units?.length || 0} units`);
            // Add base product
            const baseItem = toSearchItem(product);
            console.log(`[SEARCH]   + Base: "${baseItem.name}" id=${baseItem.id}`);
            resultMap.set(baseItem.id, baseItem);

            // Add all units
            product.units?.forEach((u, idx) => {
                console.log(`[SEARCH]   RAW Unit[${idx}]: name="${u.unit_name}" u.id="${u.id}" typeof=${typeof u.id}`);
                const unitItem = toSearchItem(product, u);
                console.log(`[SEARCH]   + Unit: "${u.unit_name}" id=${unitItem.id}`);
                resultMap.set(unitItem.id, unitItem);
            });
            continue; // Already added all, skip unit-specific check
        }

        // 3. Check if specific units match (only if product didn't match)
        if (product.units) {
            for (const unit of product.units) {
                const unitSearchable = [
                    unit.unit_name,
                    unit.barcode || ''
                ].join(' ');

                if (fuzzyMatch(unitSearchable, trimmedQuery)) {
                    const unitItem = toSearchItem(product, unit);
                    resultMap.set(unitItem.id, unitItem);
                }
            }
        }

        // 4. Check base unit name match
        if (fuzzyMatch(product.base_unit, trimmedQuery)) {
            const baseItem = toSearchItem(product);
            resultMap.set(baseItem.id, baseItem);
        }
    }

    const results = Array.from(resultMap.values());
    console.log(`[SEARCH] FINAL: Returning ${results.length} items`, results.map(r => r.name));
    return results;
}

/**
 * Get recently created products (sorted by created_at DESC)
 * Returns base products only, limited to specified count
 */
export function getRecentProducts(products: Product[], limit = 10): ProductSearchItem[] {
    // Sort by created_at descending
    const sorted = [...products]
        .filter(p => p.is_active !== false)
        .sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA;
        })
        .slice(0, limit);

    return sorted.map(p => toSearchItem(p));
}
