// =============================================================================
// STOCK TAKE PAGE - Inventory Count
// =============================================================================

import { useState, useEffect } from 'react';
import { useProductStore } from '@/stores/productStore';
import { formatVND } from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';
import type { Product } from '@/types';
import { ProductLink } from '@/components/products/ProductLink';

interface StockTakeItem {
    product_id: string;
    product: Product;
    system_stock: number;
    actual_stock: number | null;
    difference: number;
}

export function StockTakePage() {
    const { products, loadProducts, updateStock } = useProductStore();
    const [items, setItems] = useState<StockTakeItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'counted' | 'uncounted' | 'difference'>('all');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    useEffect(() => {
        // Initialize stock take items from products
        setItems(products.map((p) => ({
            product_id: p.id,
            product: p,
            system_stock: p.current_stock,
            actual_stock: null,
            difference: 0,
        })));
    }, [products]);

    const filteredItems = items.filter((item) => {
        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (!item.product.name.toLowerCase().includes(query) &&
                !item.product.barcode?.includes(searchQuery) &&
                !item.product.sku?.toLowerCase().includes(query)) {
                return false;
            }
        }
        // Filter by status
        if (filter === 'counted') return item.actual_stock !== null;
        if (filter === 'uncounted') return item.actual_stock === null;
        if (filter === 'difference') return item.actual_stock !== null && item.difference !== 0;
        return true;
    });

    const countedCount = items.filter((i) => i.actual_stock !== null).length;
    const differenceCount = items.filter((i) => i.actual_stock !== null && i.difference !== 0).length;

    const handleActualStockChange = (productId: string, value: number | null) => {
        setItems((prev) => prev.map((item) => {
            if (item.product_id !== productId) return item;
            const difference = value !== null ? value - item.system_stock : 0;
            return { ...item, actual_stock: value, difference };
        }));
    };

    const handleApplyAdjustments = async () => {
        const itemsToAdjust = items.filter((i) => i.actual_stock !== null && i.difference !== 0);
        if (itemsToAdjust.length === 0) return;

        if (!confirm(`Điều chỉnh tồn kho cho ${itemsToAdjust.length} sản phẩm?`)) return;

        setIsSaving(true);

        for (const item of itemsToAdjust) {
            try {
                await updateStock(
                    item.product_id,
                    item.difference,
                    `Kiểm kê - Điều chỉnh từ ${item.system_stock} thành ${item.actual_stock}`,
                    'stock_take'
                );
            } catch (err) {
                console.error(`Failed to adjust stock for ${item.product.name}:`, err);
            }
        }

        // Reload products and reset
        await loadProducts();
        setIsSaving(false);
        alert('Đã điều chỉnh tồn kho thành công!');
    };

    const totalDifferenceValue = items
        .filter((i) => i.actual_stock !== null && i.difference !== 0)
        .reduce((sum, i) => sum + (i.difference * i.product.cost_price), 0);

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200">
                <div className="container-app py-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Kiểm kê kho</h1>
                            <p className="text-sm text-gray-500">
                                Đã đếm: {countedCount}/{items.length} • Chênh lệch: {differenceCount}
                            </p>
                        </div>
                        <button
                            onClick={handleApplyAdjustments}
                            disabled={differenceCount === 0 || isSaving}
                            className={cn(
                                'px-4 py-2 rounded-lg font-medium text-white',
                                'bg-gradient-to-r from-primary to-primary-dark',
                                'disabled:opacity-50'
                            )}
                        >
                            {isSaving ? 'Đang lưu...' : `Áp dụng điều chỉnh (${differenceCount})`}
                        </button>
                    </div>
                </div>
            </header>

            <div className="container-app py-4 flex flex-col md:flex-row gap-4">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên, SKU, barcode..."
                    className="flex-1 px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary"
                />
                <div className="flex gap-2 flex-wrap">
                    {[
                        { value: 'all', label: 'Tất cả' },
                        { value: 'uncounted', label: `❓ Chưa đếm (${items.length - countedCount})` },
                        { value: 'counted', label: `✅ Đã đếm (${countedCount})` },
                        { value: 'difference', label: `⚠️ Chênh lệch (${differenceCount})` },
                    ].map((f) => (
                        <button
                            key={f.value}
                            onClick={() => setFilter(f.value as typeof filter)}
                            className={cn(
                                'px-3 py-2 rounded-lg text-sm font-medium',
                                filter === f.value ? 'bg-primary text-white' : 'bg-white border text-gray-700'
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {totalDifferenceValue !== 0 && (
                <div className="container-app pb-4">
                    <div className={cn(
                        'p-4 rounded-xl border',
                        totalDifferenceValue > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    )}>
                        <span className={totalDifferenceValue > 0 ? 'text-green-700' : 'text-red-700'}>
                            Tổng chênh lệch giá trị: <strong>{formatVND(Math.abs(totalDifferenceValue))}</strong>
                            {totalDifferenceValue > 0 ? ' (thừa)' : ' (thiếu)'}
                        </span>
                    </div>
                </div>
            )}

            <main className="container-app pb-6">
                <div className="bg-white rounded-xl border overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Sản phẩm</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 w-28">Hệ thống</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 w-32">Thực tế</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 w-24">Chênh lệch</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredItems.map((item) => (
                                <StockTakeRow
                                    key={item.product_id}
                                    item={item}
                                    onActualChange={(value) => handleActualStockChange(item.product_id, value)}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}

function StockTakeRow({ item, onActualChange }: { item: StockTakeItem; onActualChange: (value: number | null) => void }) {
    const [inputValue, setInputValue] = useState<string>(item.actual_stock?.toString() || '');

    const handleBlur = () => {
        if (inputValue === '') {
            onActualChange(null);
        } else {
            onActualChange(Number(inputValue));
        }
    };

    return (
        <tr className={cn(
            'hover:bg-gray-50',
            item.difference !== 0 && 'bg-amber-50'
        )}>
            <td className="px-4 py-3">
                <ProductLink
                    productId={item.product_id}
                    productName={item.product.name}
                    style={{ fontWeight: 500, display: 'block' }}
                />
                <div className="text-xs text-gray-400">
                    {item.product.sku} • {item.product.barcode}
                </div>
            </td>
            <td className="px-4 py-3 text-right font-medium text-gray-900">
                {item.system_stock}
            </td>
            <td className="px-4 py-3">
                <input
                    type="number"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onBlur={handleBlur}
                    placeholder="-"
                    className="w-full px-3 py-2 rounded-lg border text-right focus:ring-2 focus:ring-primary"
                />
            </td>
            <td className="px-4 py-3 text-right">
                {item.actual_stock !== null && (
                    <span className={cn(
                        'font-medium',
                        item.difference > 0 ? 'text-green-600' : item.difference < 0 ? 'text-red-600' : 'text-gray-400'
                    )}>
                        {item.difference > 0 ? '+' : ''}{item.difference}
                    </span>
                )}
            </td>
        </tr>
    );
}

export default StockTakePage;
