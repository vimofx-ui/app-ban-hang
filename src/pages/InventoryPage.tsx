// =============================================================================
// INVENTORY PAGE - Quản lý tồn kho
// Tabs: Tổng quan tồn kho | Kiểm kê kho | Phiếu kiểm kho
// =============================================================================

import { useState, useEffect, useMemo } from 'react';
import { useProductStore } from '@/stores/productStore';
import { formatVND } from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';
import type { Product } from '@/types';
import { ProductLink } from '@/components/products/ProductLink';

type TabId = 'overview' | 'stock-take' | 'sheets';

interface StockTakeItem {
    product_id: string;
    product: Product;
    system_stock: number;
    actual_stock: number | null;
    difference: number;
}

interface StockTakeSheet {
    id: string;
    name: string;
    created_at: string;
    status: 'draft' | 'completed' | 'cancelled';
    items_count: number;
    difference_count: number;
    total_difference_value: number;
    created_by: string;
}

// =============================================================================
// Main Component
// =============================================================================

export function InventoryPage() {
    const { products, loadProducts, updateStock } = useProductStore();
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    const tabs = [
        { id: 'overview' as TabId, label: '📦 Tổng quan tồn kho', icon: '📦' },
        { id: 'stock-take' as TabId, label: '📋 Kiểm kê kho', icon: '📋' },
        { id: 'sheets' as TabId, label: '📄 Phiếu kiểm kho', icon: '📄' },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="container-app py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">📦 Quản lý tồn kho</h1>
                            <p className="text-sm text-gray-500">
                                {products.length} sản phẩm • Tổng tồn: {products.reduce((sum, p) => sum + p.current_stock, 0).toLocaleString()} đơn vị
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container-app py-6">
                {/* Tab Navigation */}
                <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                                activeTab === tab.id
                                    ? "border-primary text-primary"
                                    : "border-transparent text-gray-500 hover:text-gray-700"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <StockOverviewTab products={products} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
                )}

                {activeTab === 'stock-take' && (
                    <StockTakeTab products={products} updateStock={updateStock} loadProducts={loadProducts} />
                )}

                {activeTab === 'sheets' && (
                    <StockTakeSheetsTab />
                )}
            </main>
        </div>
    );
}

// =============================================================================
// Stock Overview Tab
// =============================================================================

interface StockOverviewTabProps {
    products: Product[];
    searchQuery: string;
    setSearchQuery: (query: string) => void;
}

function StockOverviewTab({ products, searchQuery, setSearchQuery }: StockOverviewTabProps) {
    const [filter, setFilter] = useState<'all' | 'low' | 'out' | 'ok'>('all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const stats = useMemo(() => {
        const total = products.length;
        const lowStock = products.filter(p => p.current_stock > 0 && p.current_stock <= (p.min_stock || 10)).length;
        const outOfStock = products.filter(p => p.current_stock <= 0).length;
        const ok = total - lowStock - outOfStock;
        const totalValue = products.reduce((sum, p) => sum + (p.current_stock * p.cost_price), 0);
        const totalUnits = products.reduce((sum, p) => sum + p.current_stock, 0);
        return { total, lowStock, outOfStock, ok, totalValue, totalUnits };
    }, [products]);

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                if (!p.name.toLowerCase().includes(query) &&
                    !p.barcode?.includes(searchQuery) &&
                    !p.sku?.toLowerCase().includes(query)) {
                    return false;
                }
            }
            // Status filter
            if (filter === 'low') return p.current_stock > 0 && p.current_stock <= (p.min_stock || 10);
            if (filter === 'out') return p.current_stock <= 0;
            if (filter === 'ok') return p.current_stock > (p.min_stock || 10);
            return true;
        });
    }, [products, searchQuery, filter]);

    // Select all / deselect all
    const allSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedIds.has(p.id));
    const someSelected = filteredProducts.some(p => selectedIds.has(p.id));

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredProducts.map(p => p.id)));
        }
    };

    const toggleSelect = (productId: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(productId)) {
            newSet.delete(productId);
        } else {
            newSet.add(productId);
        }
        setSelectedIds(newSet);
    };

    // Bulk actions
    const handlePrintBarcodes = () => {
        const selectedProducts = products.filter(p => selectedIds.has(p.id));
        if (selectedProducts.length === 0) return;
        // Store selected products for barcode printing page
        sessionStorage.setItem('barcode_print_products', JSON.stringify(selectedProducts));
        window.open('/products?action=print-barcodes', '_blank');
        alert(`Đang mở trang in mã vạch cho ${selectedProducts.length} sản phẩm`);
    };

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl text-white shadow-lg">
                    <span className="text-xs font-semibold uppercase opacity-80">Tổng SP</span>
                    <p className="text-2xl font-bold mt-1">{stats.total}</p>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl text-white shadow-lg">
                    <span className="text-xs font-semibold uppercase opacity-80">Đủ hàng</span>
                    <p className="text-2xl font-bold mt-1">{stats.ok}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-4 rounded-xl text-white shadow-lg">
                    <span className="text-xs font-semibold uppercase opacity-80">Sắp hết</span>
                    <p className="text-2xl font-bold mt-1">{stats.lowStock}</p>
                </div>
                <div className="bg-gradient-to-br from-red-500 to-red-600 p-4 rounded-xl text-white shadow-lg">
                    <span className="text-xs font-semibold uppercase opacity-80">Hết hàng</span>
                    <p className="text-2xl font-bold mt-1">{stats.outOfStock}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-xl text-white shadow-lg">
                    <span className="text-xs font-semibold uppercase opacity-80">Tổng đơn vị</span>
                    <p className="text-2xl font-bold mt-1">{stats.totalUnits.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-4 rounded-xl text-white shadow-lg">
                    <span className="text-xs font-semibold uppercase opacity-80">Giá trị tồn</span>
                    <p className="text-xl font-bold mt-1">{formatVND(stats.totalValue)}</p>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border">
                <div className="flex-1 relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm theo tên, SKU, barcode..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {[
                        { value: 'all', label: 'Tất cả', count: stats.total },
                        { value: 'ok', label: '✅ Đủ hàng', count: stats.ok },
                        { value: 'low', label: '⚠️ Sắp hết', count: stats.lowStock },
                        { value: 'out', label: '❌ Hết hàng', count: stats.outOfStock },
                    ].map((f) => (
                        <button
                            key={f.value}
                            onClick={() => setFilter(f.value as typeof filter)}
                            className={cn(
                                'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                                filter === f.value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            )}
                        >
                            {f.label} ({f.count})
                        </button>
                    ))}
                </div>
            </div>

            {/* Bulk Actions Toolbar */}
            {selectedIds.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-blue-800 font-medium">
                        ✓ Đã chọn {selectedIds.size} sản phẩm
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrintBarcodes}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
                        >
                            🏷️ In mã vạch
                        </button>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                        >
                            ✕ Bỏ chọn
                        </button>
                    </div>
                </div>
            )}

            {/* Products Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-white border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-left w-10">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sản phẩm</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Tồn kho</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Tồn tối thiểu</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Giá vốn</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Giá trị tồn</th>
                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filteredProducts.map(product => {
                            const stockValue = product.current_stock * product.cost_price;
                            const isLow = product.current_stock > 0 && product.current_stock <= (product.min_stock || 10);
                            const isOut = product.current_stock <= 0;
                            const isSelected = selectedIds.has(product.id);

                            return (
                                <tr
                                    key={product.id}
                                    className={cn(
                                        "hover:bg-gray-50/80 cursor-pointer border-b border-gray-50 last:border-0",
                                        isOut && "bg-red-50/50",
                                        isLow && "bg-amber-50/50",
                                        isSelected && "bg-blue-50/50"
                                    )}
                                    onClick={() => toggleSelect(product.id)}
                                >
                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelect(product.id)}
                                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {/* Product Image */}
                                            <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0 border">
                                                {product.image_url ? (
                                                    <img
                                                        src={product.image_url}
                                                        alt={product.name}
                                                        className="w-full h-full object-cover"
                                                        style={{ imageRendering: 'crisp-edges' }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl">
                                                        📦
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <ProductLink
                                                    productId={product.id}
                                                    productName={product.name}
                                                    style={{ fontWeight: 500 }}
                                                />
                                                <div className="text-xs text-gray-400 truncate">{product.sku} • {product.barcode}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium">
                                        <span className={cn(
                                            isOut ? "text-red-600" : isLow ? "text-amber-600" : "text-gray-900"
                                        )}>
                                            {product.current_stock}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-500">
                                        {product.min_stock || 10}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-600">
                                        {formatVND(product.cost_price)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium">
                                        {formatVND(stockValue)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={cn(
                                            "px-2 py-1 rounded-full text-xs font-medium",
                                            isOut ? "bg-red-100 text-red-700" :
                                                isLow ? "bg-amber-100 text-amber-700" :
                                                    "bg-green-100 text-green-700"
                                        )}>
                                            {isOut ? '❌ Hết hàng' : isLow ? '⚠️ Sắp hết' : '✅ Còn hàng'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// =============================================================================
// Stock Take Tab (from existing StockTakePage)
// =============================================================================

interface StockTakeTabProps {
    products: Product[];
    updateStock: (productId: string, adjustment: number, reason: string) => Promise<void>;
    loadProducts: () => Promise<void>;
}

function StockTakeTab({ products, updateStock, loadProducts }: StockTakeTabProps) {
    const [items, setItems] = useState<StockTakeItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'counted' | 'uncounted' | 'difference'>('all');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setItems(products.map((p) => ({
            product_id: p.id,
            product: p,
            system_stock: p.current_stock,
            actual_stock: null,
            difference: 0,
        })));
    }, [products]);

    const filteredItems = items.filter((item) => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (!item.product.name.toLowerCase().includes(query) &&
                !item.product.barcode?.includes(searchQuery) &&
                !item.product.sku?.toLowerCase().includes(query)) {
                return false;
            }
        }
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
                    `Kiểm kê - Điều chỉnh từ ${item.system_stock} thành ${item.actual_stock}`
                );
            } catch (err) {
                console.error(`Failed to adjust stock for ${item.product.name}:`, err);
            }
        }

        await loadProducts();
        setIsSaving(false);
        alert('Đã điều chỉnh tồn kho thành công!');
    };

    const totalDifferenceValue = items
        .filter((i) => i.actual_stock !== null && i.difference !== 0)
        .reduce((sum, i) => sum + (i.difference * i.product.cost_price), 0);

    return (
        <div className="space-y-4">
            {/* Header Actions */}
            <div className="flex flex-col md:flex-row justify-between gap-4 bg-white p-4 rounded-xl border">
                <div>
                    <h3 className="font-semibold text-gray-900">Kiểm kê kho hàng</h3>
                    <p className="text-sm text-gray-500">
                        Đã đếm: {countedCount}/{items.length} • Chênh lệch: {differenceCount}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setItems(items.map(i => ({ ...i, actual_stock: null, difference: 0 })))}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                    >
                        🔄 Làm mới
                    </button>
                    <button
                        onClick={handleApplyAdjustments}
                        disabled={differenceCount === 0 || isSaving}
                        className={cn(
                            'px-4 py-2 rounded-lg font-medium text-white',
                            'bg-gradient-to-r from-primary to-primary-dark',
                            'disabled:opacity-50'
                        )}
                    >
                        {isSaving ? 'Đang lưu...' : `✅ Áp dụng điều chỉnh (${differenceCount})`}
                    </button>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col md:flex-row gap-4">
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

            {/* Difference Summary */}
            {totalDifferenceValue !== 0 && (
                <div className={cn(
                    'p-4 rounded-xl border',
                    totalDifferenceValue > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                )}>
                    <span className={totalDifferenceValue > 0 ? 'text-green-700' : 'text-red-700'}>
                        Tổng chênh lệch giá trị: <strong>{formatVND(Math.abs(totalDifferenceValue))}</strong>
                        {totalDifferenceValue > 0 ? ' (thừa)' : ' (thiếu)'}
                    </span>
                </div>
            )}

            {/* Stock Take Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-white border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sản phẩm</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Hệ thống</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Thực tế</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Chênh lệch</th>
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
            'hover:bg-gray-50/80 border-b border-gray-50 last:border-0',
            item.difference !== 0 && 'bg-amber-50/50'
        )}>
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    {/* Product Image */}
                    <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0 border">
                        {item.product.image_url ? (
                            <img
                                src={item.product.image_url}
                                alt={item.product.name}
                                className="w-full h-full object-cover"
                                style={{ imageRendering: 'crisp-edges' }}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl">
                                📦
                            </div>
                        )}
                    </div>
                    <div className="min-w-0">
                        <ProductLink
                            productId={item.product_id}
                            productName={item.product.name}
                            style={{ fontWeight: 500, display: 'block' }}
                        />
                        <div className="text-xs text-gray-400">
                            {item.product.sku} • {item.product.barcode}
                        </div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 text-right font-medium text-gray-900">
                {item.system_stock}
            </td>
            <td className="px-6 py-4">
                <input
                    type="number"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onBlur={handleBlur}
                    placeholder="-"
                    className="w-full px-3 py-2 rounded-lg border text-right focus:ring-2 focus:ring-primary"
                />
            </td>
            <td className="px-6 py-4 text-right">
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

// =============================================================================
// Stock Take Sheets Tab
// =============================================================================

function StockTakeSheetsTab() {
    const [sheets, setSheets] = useState<StockTakeSheet[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newSheetName, setNewSheetName] = useState('');

    useEffect(() => {
        // Load sheets from localStorage
        const saved = localStorage.getItem('stock_take_sheets');
        if (saved) {
            setSheets(JSON.parse(saved));
        }
    }, []);

    const saveSheets = (updatedSheets: StockTakeSheet[]) => {
        setSheets(updatedSheets);
        localStorage.setItem('stock_take_sheets', JSON.stringify(updatedSheets));
    };

    const handleCreateSheet = () => {
        if (!newSheetName.trim()) return;

        const newSheet: StockTakeSheet = {
            id: crypto.randomUUID(),
            name: newSheetName.trim(),
            created_at: new Date().toISOString(),
            status: 'draft',
            items_count: 0,
            difference_count: 0,
            total_difference_value: 0,
            created_by: 'Admin'
        };

        saveSheets([newSheet, ...sheets]);
        setNewSheetName('');
        setIsCreating(false);
    };

    const getStatusColor = (status: StockTakeSheet['status']) => {
        switch (status) {
            case 'draft': return 'bg-amber-100 text-amber-700';
            case 'completed': return 'bg-green-100 text-green-700';
            case 'cancelled': return 'bg-gray-100 text-gray-500';
        }
    };

    const getStatusLabel = (status: StockTakeSheet['status']) => {
        switch (status) {
            case 'draft': return '📝 Nháp';
            case 'completed': return '✅ Hoàn thành';
            case 'cancelled': return '❌ Đã hủy';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border">
                <div>
                    <h3 className="font-semibold text-gray-900">📄 Phiếu kiểm kho</h3>
                    <p className="text-sm text-gray-500">Quản lý các phiếu kiểm kê kho hàng</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark"
                >
                    ➕ Tạo phiếu mới
                </button>
            </div>

            {/* Create Sheet Modal */}
            {isCreating && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h4 className="font-semibold text-blue-800 mb-3">Tạo phiếu kiểm kho mới</h4>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={newSheetName}
                            onChange={(e) => setNewSheetName(e.target.value)}
                            placeholder="Tên phiếu (vd: Kiểm kê tuần 50)..."
                            className="flex-1 px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary"
                            autoFocus
                        />
                        <button
                            onClick={handleCreateSheet}
                            disabled={!newSheetName.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                            ✅ Tạo
                        </button>
                        <button
                            onClick={() => { setIsCreating(false); setNewSheetName(''); }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                        >
                            Hủy
                        </button>
                    </div>
                </div>
            )}

            {/* Sheets List */}
            {sheets.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">📄</span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Chưa có phiếu kiểm kho</h3>
                    <p className="text-gray-500 mt-1">Bấm "Tạo phiếu mới" để bắt đầu</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-white border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tên phiếu</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ngày tạo</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Người tạo</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Số SP</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Chênh lệch</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {sheets.map(sheet => (
                                <tr key={sheet.id} className="hover:bg-gray-50/80 border-b border-gray-50 last:border-0">
                                    <td className="px-6 py-4 font-medium text-gray-900">{sheet.name}</td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {new Date(sheet.created_at).toLocaleDateString('vi-VN')}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{sheet.created_by}</td>
                                    <td className="px-6 py-4 text-center">{sheet.items_count}</td>
                                    <td className="px-6 py-4 text-center">
                                        {sheet.difference_count > 0 ? (
                                            <span className="text-amber-600 font-medium">{sheet.difference_count}</span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={cn("px-2 py-1 rounded-full text-xs font-medium", getStatusColor(sheet.status))}>
                                            {getStatusLabel(sheet.status)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button className="text-blue-600 hover:underline text-sm mr-2">
                                            Xem
                                        </button>
                                        {sheet.status === 'draft' && (
                                            <button className="text-red-600 hover:underline text-sm">
                                                Hủy
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// Icons
// =============================================================================

function SearchIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
    );
}

export default InventoryPage;
