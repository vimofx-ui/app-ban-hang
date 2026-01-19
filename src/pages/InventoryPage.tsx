// =============================================================================
// INVENTORY PAGE - Quản lý tồn kho
// Tabs: Tổng quan tồn kho | Kiểm kê kho | Phiếu kiểm kho | Chuyển kho
// =============================================================================

import { useState, useEffect, useMemo, useRef } from 'react';
import { useProductStore } from '@/stores/productStore';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useStockTransferStore, type StockTransfer } from '@/stores/stockTransferStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatVND } from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';
import { generateId } from '@/lib/utils';
import type { Product } from '@/types';
import { ProductLink } from '@/components/products/ProductLink';
import { generateTransferReceiptHTML, type TransferReceiptData, type TransferItem } from '@/components/print';
import { BarcodeScannerModal } from '@/components/common/BarcodeScannerModal';
import { BarcodeSelectionModal, findProductsByBarcode, type BarcodeMatch } from '@/components/common/BarcodeSelectionModal';
import { POSAudio } from '@/lib/posAudio';
import { toast } from 'sonner';
import { ScanBarcode } from 'lucide-react';

type TabId = 'overview' | 'stock-take' | 'sheets' | 'transfers';

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
    const { branchId, brandId } = useAuthStore();
    const { branches, fetchBranches } = useBranchStore();
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [searchQuery, setSearchQuery] = useState('');

    // Lấy tên chi nhánh hiện tại
    const currentBranchName = useMemo(() => {
        const branch = branches.find(b => b.id === branchId);
        return branch?.name || 'Tất cả chi nhánh';
    }, [branches, branchId]);

    useEffect(() => {
        loadProducts();
        if (brandId) {
            fetchBranches(brandId);
        }
    }, [loadProducts, brandId, fetchBranches]);

    const tabs = [
        { id: 'overview' as TabId, label: '📦 Tổng quan tồn kho', icon: '📦' },
        { id: 'stock-take' as TabId, label: '📋 Kiểm kê kho', icon: '📋' },
        { id: 'sheets' as TabId, label: '📄 Phiếu kiểm kho', icon: '📄' },
        { id: 'transfers' as TabId, label: '🔄 Chuyển kho', icon: '🔄' },
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
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                                    📍 {currentBranchName}
                                </span>
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

                {activeTab === 'transfers' && (
                    <StockTransferTab branches={branches} currentBranchId={branchId} brandId={brandId} products={products} />
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

    // Scanner states
    const [showScanner, setShowScanner] = useState(false);
    const [barcodeMatches, setBarcodeMatches] = useState<BarcodeMatch[]>([]);

    // Handle barcode scan
    const handleBarcodeScan = (code: string) => {
        const matches = findProductsByBarcode(products, code);

        if (matches.length === 0) {
            POSAudio.playError();
            toast.error(`Mã "${code}" không tồn tại trong kho!`);
        } else if (matches.length === 1) {
            setShowScanner(false);
            selectProductForSearch(matches[0].product);
            POSAudio.playAddItem();
        } else {
            // Multiple matches - show selection modal
            setShowScanner(false);
            setBarcodeMatches(matches);
        }
    };

    // Handle selection from modal
    const handleBarcodeSelect = (match: BarcodeMatch) => {
        setBarcodeMatches([]);
        selectProductForSearch(match.product);
        POSAudio.playAddItem();
    };

    // Helper: Set search to show queried product
    const selectProductForSearch = (product: Product) => {
        setSearchQuery(product.sku || product.barcode || product.name);
        setFilter('all');
        toast.success(`Đã tìm: ${product.name}`);
        // Scroll to product after a short delay
        setTimeout(() => {
            const el = document.getElementById(`inventory-${product.id}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                setTimeout(() => el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
            }
        }, 100);
    };

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
            <div className="flex overflow-x-auto pb-4 -mx-4 px-4 gap-4 snap-x md:grid md:grid-cols-4 lg:grid-cols-6 md:pb-0 md:mx-0 md:px-0 scrollbar-hide">
                <div className="min-w-[140px] snap-start bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl text-white shadow-lg flex-shrink-0">
                    <span className="text-xs font-semibold uppercase opacity-80">Tổng SP</span>
                    <p className="text-2xl font-bold mt-1">{stats.total}</p>
                </div>
                <div className="min-w-[140px] snap-start bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl text-white shadow-lg flex-shrink-0">
                    <span className="text-xs font-semibold uppercase opacity-80">Đủ hàng</span>
                    <p className="text-2xl font-bold mt-1">{stats.ok}</p>
                </div>
                <div className="min-w-[140px] snap-start bg-gradient-to-br from-amber-500 to-orange-500 p-4 rounded-xl text-white shadow-lg flex-shrink-0">
                    <span className="text-xs font-semibold uppercase opacity-80">Sắp hết</span>
                    <p className="text-2xl font-bold mt-1">{stats.lowStock}</p>
                </div>
                <div className="min-w-[140px] snap-start bg-gradient-to-br from-red-500 to-red-600 p-4 rounded-xl text-white shadow-lg flex-shrink-0">
                    <span className="text-xs font-semibold uppercase opacity-80">Hết hàng</span>
                    <p className="text-2xl font-bold mt-1">{stats.outOfStock}</p>
                </div>
                <div className="min-w-[160px] snap-start bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-xl text-white shadow-lg flex-shrink-0">
                    <span className="text-xs font-semibold uppercase opacity-80">Tổng đơn vị</span>
                    <p className="text-2xl font-bold mt-1">{stats.totalUnits.toLocaleString()}</p>
                </div>
                <div className="min-w-[160px] snap-start bg-gradient-to-br from-indigo-500 to-indigo-600 p-4 rounded-xl text-white shadow-lg flex-shrink-0">
                    <span className="text-xs font-semibold uppercase opacity-80">Giá trị tồn</span>
                    <p className="text-xl font-bold mt-1 break-words">{formatVND(stats.totalValue)}</p>
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
                        className="w-full pl-10 pr-12 py-2.5 rounded-lg border focus:ring-2 focus:ring-primary"
                    />
                    <button
                        onClick={() => setShowScanner(true)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                        title="Quét mã vạch"
                    >
                        <ScanBarcode className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar md:flex-wrap md:pb-0 md:mx-0 md:px-0">
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
                                'px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0',
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



            {/* Products Table - Responsive Scrollable */}
            <div className="-mx-4 md:mx-0 overflow-x-auto bg-white md:rounded-xl shadow-sm border-y md:border border-gray-200">
                <table className="w-full text-sm min-w-max md:min-w-0">
                    <thead className="bg-white border-b border-gray-100">
                        <tr>
                            <th className="px-2 py-3 text-left w-8">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                            </th>
                            <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sản phẩm</th>
                            <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Tồn</th>
                            <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Tối thiểu</th>
                            <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Giá vốn</th>
                            <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Giá trị</th>
                            <th className="px-2 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">TT</th>
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
                                    id={`inventory-${product.id}`}
                                    className={cn(
                                        "hover:bg-gray-50/80 cursor-pointer border-b border-gray-50 last:border-0 transition-all",
                                        isOut && "bg-red-50/50",
                                        isLow && "bg-amber-50/50",
                                        isSelected && "bg-blue-50/50"
                                    )}
                                    onClick={() => toggleSelect(product.id)}
                                >
                                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelect(product.id)}
                                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <div className="flex items-center gap-2">
                                            {/* Product Image */}
                                            <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden shrink-0 border">
                                                {product.image_url ? (
                                                    <img
                                                        src={product.image_url}
                                                        alt={product.name}
                                                        className="w-full h-full object-cover"
                                                        style={{ imageRendering: 'crisp-edges' }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-base">
                                                        📦
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 max-w-[120px] md:max-w-xs">
                                                <ProductLink
                                                    productId={product.id}
                                                    productName={product.name}
                                                    style={{ fontWeight: 500 }}
                                                    className="truncate block text-sm"
                                                />
                                                <div className="text-[11px] text-gray-400 truncate">{product.sku}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-2 py-2 text-right font-medium">
                                        <span className={cn(
                                            isOut ? "text-red-600" : isLow ? "text-amber-600" : "text-gray-900"
                                        )}>
                                            {product.current_stock}
                                        </span>
                                    </td>
                                    <td className="px-2 py-2 text-right text-gray-500">
                                        {product.min_stock || 10}
                                    </td>
                                    <td className="px-2 py-2 text-right text-gray-600 whitespace-nowrap">
                                        {formatVND(product.cost_price)}
                                    </td>
                                    <td className="px-2 py-2 text-right font-medium whitespace-nowrap">
                                        {formatVND(stockValue)}
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                        <span className={cn(
                                            "px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap",
                                            isOut ? "bg-red-50 text-red-700 border border-red-100" :
                                                isLow ? "bg-amber-50 text-amber-700 border border-amber-100" :
                                                    "bg-green-50 text-green-700 border border-green-100"
                                        )}>
                                            {isOut ? 'Hết' : isLow ? 'Sắp hết' : 'Đủ'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Barcode Scanner Modal */}
            {showScanner && (
                <BarcodeScannerModal
                    onScan={handleBarcodeScan}
                    onClose={() => setShowScanner(false)}
                    title="Quét sản phẩm tồn kho"
                />
            )}

            {/* Product Selection Modal for duplicate barcodes */}
            {barcodeMatches.length > 0 && (
                <BarcodeSelectionModal
                    matches={barcodeMatches}
                    onSelect={handleBarcodeSelect}
                    onClose={() => setBarcodeMatches([])}
                />
            )}
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

    // Scanner states
    const [showScanner, setShowScanner] = useState(false);
    const [barcodeMatches, setBarcodeMatches] = useState<BarcodeMatch[]>([]);

    // Handle barcode scan
    const handleBarcodeScan = (code: string) => {
        const matches = findProductsByBarcode(products, code);

        if (matches.length === 0) {
            POSAudio.playError();
            toast.error(`Mã "${code}" không tồn tại!`);
        } else if (matches.length === 1) {
            setShowScanner(false);
            selectProductForCounting(matches[0].product.id);
            POSAudio.playAddItem();
        } else {
            setShowScanner(false);
            setBarcodeMatches(matches);
        }
    };

    // Handle selection from modal
    const handleBarcodeSelect = (match: BarcodeMatch) => {
        setBarcodeMatches([]);
        selectProductForCounting(match.product.id);
        POSAudio.playAddItem();
    };

    // Helper: Jump to product
    const selectProductForCounting = (productId: string) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            setSearchQuery(product.sku || product.barcode || product.name);
            setFilter('all');
            toast.success(`Đã chọn: ${product.name}`);
            setTimeout(() => {
                const el = document.getElementById(`stocktake-${productId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                    setTimeout(() => el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
                }
            }, 100);
        }
    };

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
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm theo tên, SKU, barcode..."
                        className="w-full px-4 pr-12 py-2.5 rounded-lg border focus:ring-2 focus:ring-primary"
                    />
                    <button
                        onClick={() => setShowScanner(true)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                        title="Quét mã vạch"
                    >
                        <ScanBarcode className="w-5 h-5" />
                    </button>
                </div>
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
                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-gray-100">
                    {filteredItems.map((item) => (
                        <div key={item.product_id} className="p-4 space-y-3">
                            <div className="flex gap-3">
                                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0 border">
                                    {item.product.image_url ? (
                                        <img src={item.product.image_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 truncate">{item.product.name}</div>
                                    <div className="text-xs text-gray-500">{item.product.sku}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-sm bg-gray-50 p-2 rounded-lg">
                                <div className="text-center">
                                    <div className="text-xs text-gray-500 mb-1">Hệ thống</div>
                                    <div className="font-medium">{item.system_stock}</div>
                                </div>
                                <div className="text-center border-l border-gray-200 pl-2">
                                    <div className="text-xs text-gray-500 mb-1">Thực tế</div>
                                    <input
                                        type="number"
                                        placeholder="-"
                                        className="w-full text-center border-b border-gray-300 focus:border-primary focus:outline-none bg-transparent font-medium py-1 text-lg"
                                        value={item.actual_stock?.toString() || ''}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? null : Number(e.target.value);
                                            handleActualStockChange(item.product_id, val);
                                        }}
                                    />
                                </div>
                                <div className="text-center border-l border-gray-200">
                                    <div className="text-xs text-gray-500 mb-1">Chênh lệch</div>
                                    <div className={cn(
                                        "font-medium",
                                        item.difference > 0 ? "text-green-600" : item.difference < 0 ? "text-red-600" : "text-gray-400"
                                    )}>
                                        {item.difference > 0 ? '+' : ''}{item.difference !== 0 ? item.difference : '-'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop Table */}
                <table className="hidden md:table w-full">
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

            {/* Barcode Scanner Modal */}
            {showScanner && (
                <BarcodeScannerModal
                    onScan={handleBarcodeScan}
                    onClose={() => setShowScanner(false)}
                    title="Quét sản phẩm kiểm kê"
                />
            )}

            {/* Product Selection Modal for duplicate barcodes */}
            {barcodeMatches.length > 0 && (
                <BarcodeSelectionModal
                    matches={barcodeMatches}
                    onSelect={handleBarcodeSelect}
                    onClose={() => setBarcodeMatches([])}
                />
            )}
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
                    {/* Mobile Cards */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {sheets.map(sheet => (
                            <div key={sheet.id} className="p-4 space-y-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-medium text-gray-900">{sheet.name}</div>
                                        <div className="text-xs text-gray-500">
                                            {new Date(sheet.created_at).toLocaleDateString('vi-VN')} • {sheet.created_by}
                                        </div>
                                    </div>
                                    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", getStatusColor(sheet.status))}>
                                        {getStatusLabel(sheet.status)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-50 mt-2">
                                    <div className="flex gap-4">
                                        <div>
                                            <span className="text-gray-500 text-xs">Số SP:</span> <span className="font-medium">{sheet.items_count}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 text-xs">Chênh lệch:</span>
                                            <span className={cn("font-medium ml-1", sheet.difference_count > 0 ? "text-amber-600" : "")}>
                                                {sheet.difference_count}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button className="text-blue-600 font-medium text-xs">Xem</button>
                                        {sheet.status === 'draft' && (
                                            <button className="text-red-600 font-medium text-xs">Hủy</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table */}
                    <table className="hidden md:table w-full text-sm">
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

// =============================================================================
// Stock Transfer Tab - Chuyển kho giữa các chi nhánh (Enhanced v2.0)
// =============================================================================

interface StockTransferTabProps {
    branches: Array<{ id: string; name: string; status?: string }>;
    currentBranchId: string | null;
    brandId: string | null;
    products: Product[];
}

function StockTransferTab({ branches, currentBranchId, brandId, products }: StockTransferTabProps) {
    const { transfers, fetchTransfers, fetchTransferById, createTransfer, shipTransfer, completeTransfer, cancelTransfer, isLoading, generateDemoTransfers } = useStockTransferStore();
    const { user } = useAuthStore();
    const { printSettings } = useSettingsStore();

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

    // Create form states
    const [selectedToBranch, setSelectedToBranch] = useState<string>('');
    const [transferItems, setTransferItems] = useState<Array<{ product_id: string; quantity: number; name: string; stock: number }>>([]);
    const [productSearch, setProductSearch] = useState('');
    const [notes, setNotes] = useState('');

    // Filter states
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_transit' | 'completed' | 'cancelled'>('all');
    const [codeSearch, setCodeSearch] = useState('');

    // Date filter states
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

    // Scanner states
    const [showScanner, setShowScanner] = useState(false);
    const [barcodeMatches, setBarcodeMatches] = useState<BarcodeMatch[]>([]);

    // Handle barcode scan
    const handleBarcodeScan = (code: string) => {
        const matches = findProductsByBarcode(products, code);

        if (matches.length === 0) {
            POSAudio.playError();
            toast.error(`Mã "${code}" không tồn tại!`);
        } else if (matches.length === 1) {
            setShowScanner(false);
            addProductToTransfer(matches[0].product);
            POSAudio.playAddItem();
            toast.success(`Đã thêm: ${matches[0].displayName}`);
        } else {
            setShowScanner(false);
            setBarcodeMatches(matches);
        }
    };

    // Handle selection from modal
    const handleBarcodeSelect = (match: BarcodeMatch) => {
        setBarcodeMatches([]);
        addProductToTransfer(match.product);
        POSAudio.playAddItem();
        toast.success(`Đã thêm: ${match.displayName}`);
    };

    // Fetch transfers on mount
    useEffect(() => {
        if (brandId) {
            fetchTransfers(brandId);
        }
    }, [brandId, fetchTransfers]);

    // Generate demo data if needed (only in demo mode when no transfers exist)
    useEffect(() => {
        if (transfers.length === 0 && branches.length >= 2 && products.length > 0 && brandId) {
            // Check if we're in demo mode (no supabase)
            const isDemoMode = !localStorage.getItem('supabase.auth.token');
            if (isDemoMode) {
                generateDemoTransfers(
                    brandId,
                    branches.map(b => ({ id: b.id, name: b.name })),
                    products.slice(0, 5).map(p => ({ id: p.id, name: p.name }))
                );
            }
        }
    }, [transfers.length, branches, products, brandId, generateDemoTransfers]);

    // Export to CSV function
    const exportTransfersToCSV = () => {
        const dataToExport = filteredTransfers.map(t => ({
            'Mã phiếu': t.transfer_code,
            'Từ chi nhánh': t.from_branch?.name || '',
            'Đến chi nhánh': t.to_branch?.name || '',
            'Trạng thái': t.status === 'pending' ? 'Chờ xuất' :
                t.status === 'in_transit' ? 'Đang chuyển' :
                    t.status === 'completed' ? 'Hoàn thành' : 'Đã hủy',
            'Ngày tạo': new Date(t.created_at).toLocaleDateString('vi-VN'),
            'Số SP': t.items?.length || 0,
            'Ghi chú': t.notes || ''
        }));

        const headers = Object.keys(dataToExport[0] || {});
        const csvContent = [
            headers.join(','),
            ...dataToExport.map(row => headers.map(h => `"${(row as any)[h]}"`).join(','))
        ].join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `chuyen-kho-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    // Statistics
    const stats = useMemo(() => ({
        total: transfers.length,
        pending: transfers.filter(t => t.status === 'pending').length,
        inTransit: transfers.filter(t => t.status === 'in_transit').length,
        completed: transfers.filter(t => t.status === 'completed').length,
        cancelled: transfers.filter(t => t.status === 'cancelled').length,
    }), [transfers]);

    // Filtered transfers
    const filteredTransfers = useMemo(() => {
        return transfers.filter(t => {
            if (statusFilter !== 'all' && t.status !== statusFilter) return false;
            if (codeSearch && !t.transfer_code?.toLowerCase().includes(codeSearch.toLowerCase())) return false;

            // Date filter
            if (dateFrom) {
                const transferDate = new Date(t.created_at);
                const fromDate = new Date(dateFrom);
                if (transferDate < fromDate) return false;
            }
            if (dateTo) {
                const transferDate = new Date(t.created_at);
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59);
                if (transferDate > toDate) return false;
            }

            return true;
        });
    }, [transfers, statusFilter, codeSearch, dateFrom, dateTo]);

    // Available branches for transfer (exclude current branch)
    const otherBranches = branches.filter(b => b.id !== currentBranchId && b.status === 'active');

    // Filter products for search
    const searchResults = useMemo(() => {
        if (!productSearch.trim()) return [];
        const query = productSearch.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.barcode?.includes(productSearch)
        ).slice(0, 5);
    }, [productSearch, products]);

    const addProductToTransfer = (product: Product) => {
        if (transferItems.some(i => i.product_id === product.id)) return;
        setTransferItems([...transferItems, {
            product_id: product.id,
            quantity: 1,
            name: product.name,
            stock: product.current_stock
        }]);
        setProductSearch('');
    };

    const updateQuantity = (productId: string, qty: number) => {
        setTransferItems(items => items.map(i =>
            i.product_id === productId ? { ...i, quantity: Math.max(1, Math.min(qty, i.stock)) } : i
        ));
    };

    const removeItem = (productId: string) => {
        setTransferItems(items => items.filter(i => i.product_id !== productId));
    };

    const handleCreateTransfer = async () => {
        if (!currentBranchId || !brandId || !selectedToBranch || transferItems.length === 0) return;

        const result = await createTransfer({
            brand_id: brandId,
            from_branch_id: currentBranchId,
            to_branch_id: selectedToBranch,
            notes,
            items: transferItems.map(i => ({ product_id: i.product_id, quantity: i.quantity }))
        }, user?.id || '');

        if (result) {
            setShowCreateModal(false);
            setTransferItems([]);
            setSelectedToBranch('');
            setNotes('');
            alert('Đã tạo phiếu chuyển kho thành công!');
        }
    };

    const handleShip = async (transferId: string) => {
        if (!confirm('Xác nhận xuất kho? Hàng sẽ được trừ khỏi kho chi nhánh gửi.')) return;
        await shipTransfer(transferId, user?.id || '');
        setShowDetailModal(false);
    };

    const handleComplete = async (transferId: string) => {
        if (!confirm('Xác nhận đã nhận hàng? Hàng sẽ được cộng vào kho chi nhánh nhận.')) return;
        await completeTransfer(transferId, user?.id || '');
        setShowDetailModal(false);
    };

    const handleCancel = async (transferId: string) => {
        const reason = prompt('Nhập lý do hủy phiếu:');
        if (!reason) return;
        await cancelTransfer(transferId, user?.id || '', reason);
        setShowDetailModal(false);
    };

    const openDetail = async (transfer: StockTransfer) => {
        // Lấy chi tiết đầy đủ bao gồm items từ database
        const fullTransfer = await fetchTransferById(transfer.id);
        setSelectedTransfer(fullTransfer || transfer); // Fallback nếu fetch fail
        setShowDetailModal(true);
    };

    const getStatusBadge = (status: StockTransfer['status']) => {
        switch (status) {
            case 'pending': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">📝 Chờ xuất</span>;
            case 'in_transit': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">🚚 Đang vận chuyển</span>;
            case 'completed': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">✅ Hoàn thành</span>;
            case 'cancelled': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500">❌ Đã hủy</span>;
        }
    };

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header - Responsive */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white p-4 rounded-xl border">
                <div>
                    <h3 className="font-semibold text-gray-900 text-base md:text-lg">🔄 Chuyển kho giữa các chi nhánh</h3>
                    <p className="text-xs md:text-sm text-gray-500">
                        Quản lý phiếu chuyển hàng giữa các chi nhánh
                        {(dateFrom || dateTo) && (
                            <span className="ml-2 text-primary">• Đang lọc theo ngày</span>
                        )}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={exportTransfersToCSV}
                        disabled={filteredTransfers.length === 0}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-1"
                    >
                        📥 Xuất CSV
                    </button>
                    <button
                        onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                        className={cn(
                            "px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-1",
                            showAdvancedFilter
                                ? "bg-primary text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        )}
                    >
                        🔍 Lọc nâng cao
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        disabled={otherBranches.length === 0}
                        className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                    >
                        ➕ Tạo phiếu
                    </button>
                </div>
            </div>

            {/* Advanced Filter Panel */}
            {showAdvancedFilter && (
                <div className="bg-white p-4 rounded-xl border space-y-3 animate-in slide-in-from-top">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Từ ngày</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Đến ngày</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => { setDateFrom(''); setDateTo(''); }}
                                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                            >
                                Xóa bộ lọc
                            </button>
                        </div>
                    </div>
                    <div className="text-xs text-gray-500">
                        Đang hiển thị {filteredTransfers.length} / {transfers.length} phiếu
                    </div>
                </div>
            )}

            {/* Stats Cards - Responsive Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-4">
                <div className="bg-white p-3 md:p-4 rounded-xl border hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => setStatusFilter('all')}>
                    <div className="text-xs md:text-sm text-gray-500">Tổng phiếu</div>
                    <div className="text-lg md:text-2xl font-bold text-gray-900">{stats.total}</div>
                </div>
                <div className={cn("bg-white p-3 md:p-4 rounded-xl border hover:shadow-sm transition-shadow cursor-pointer",
                    statusFilter === 'pending' && "ring-2 ring-amber-400")}
                    onClick={() => setStatusFilter('pending')}>
                    <div className="text-xs md:text-sm text-amber-600">📝 Chờ xuất</div>
                    <div className="text-lg md:text-2xl font-bold text-amber-600">{stats.pending}</div>
                </div>
                <div className={cn("bg-white p-3 md:p-4 rounded-xl border hover:shadow-sm transition-shadow cursor-pointer",
                    statusFilter === 'in_transit' && "ring-2 ring-blue-400")}
                    onClick={() => setStatusFilter('in_transit')}>
                    <div className="text-xs md:text-sm text-blue-600">🚚 Đang chuyển</div>
                    <div className="text-lg md:text-2xl font-bold text-blue-600">{stats.inTransit}</div>
                </div>
                <div className={cn("bg-white p-3 md:p-4 rounded-xl border hover:shadow-sm transition-shadow cursor-pointer",
                    statusFilter === 'completed' && "ring-2 ring-green-400")}
                    onClick={() => setStatusFilter('completed')}>
                    <div className="text-xs md:text-sm text-green-600">✅ Hoàn thành</div>
                    <div className="text-lg md:text-2xl font-bold text-green-600">{stats.completed}</div>
                </div>
                <div className={cn("bg-white p-3 md:p-4 rounded-xl border hover:shadow-sm transition-shadow cursor-pointer col-span-2 sm:col-span-1",
                    statusFilter === 'cancelled' && "ring-2 ring-gray-400")}
                    onClick={() => setStatusFilter('cancelled')}>
                    <div className="text-xs md:text-sm text-gray-500">❌ Đã hủy</div>
                    <div className="text-lg md:text-2xl font-bold text-gray-500">{stats.cancelled}</div>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 md:p-4 rounded-xl border">
                <div className="flex-1 relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                    <input
                        type="text"
                        value={codeSearch}
                        onChange={(e) => setCodeSearch(e.target.value)}
                        placeholder="Tìm theo mã phiếu..."
                        className="w-full pl-9 md:pl-10 pr-4 py-2 md:py-2.5 rounded-lg border focus:ring-2 focus:ring-primary text-sm"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="px-3 md:px-4 py-2 md:py-2.5 rounded-lg border focus:ring-2 focus:ring-primary text-sm"
                >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="pending">📝 Chờ xuất</option>
                    <option value="in_transit">🚚 Đang vận chuyển</option>
                    <option value="completed">✅ Hoàn thành</option>
                    <option value="cancelled">❌ Đã hủy</option>
                </select>
            </div>

            {/* Create Transfer Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex flex-col md:flex-row md:items-center md:justify-center bg-gray-50 md:bg-black/50 md:backdrop-blur-sm md:p-4">
                    <div className="flex-1 flex flex-col bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-2xl shadow-xl overflow-hidden">
                        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 md:p-6 flex justify-between items-center shrink-0">
                            <h4 className="font-bold text-gray-900 text-lg md:text-xl">➕ Tạo phiếu chuyển kho</h4>
                            <button onClick={() => { setShowCreateModal(false); setTransferItems([]); }}
                                className="p-2 -mr-2 text-gray-500 hover:bg-gray-100 rounded-lg">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
                            {/* Select destination branch */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Chi nhánh nhận *</label>
                                <select
                                    value={selectedToBranch}
                                    onChange={(e) => setSelectedToBranch(e.target.value)}
                                    className="w-full px-4 py-3 md:py-2.5 border rounded-lg focus:ring-2 focus:ring-primary text-sm bg-white"
                                >
                                    <option value="">-- Chọn chi nhánh --</option>
                                    {otherBranches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Add products */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Thêm sản phẩm *</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        placeholder="🔍 Tìm tên hoặc barcode..."
                                        className="w-full px-4 pr-12 py-3 md:py-2.5 border rounded-lg focus:ring-2 focus:ring-primary text-sm"
                                    />
                                    <button
                                        onClick={() => setShowScanner(true)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                                        title="Quét mã vạch"
                                    >
                                        <ScanBarcode className="w-5 h-5" />
                                    </button>
                                    {searchResults.length > 0 && (
                                        <div className="absolute z-20 w-full bg-white border rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto divide-y">
                                            {searchResults.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => addProductToTransfer(p)}
                                                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex justify-between items-center active:bg-gray-100"
                                                >
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{p.name}</div>
                                                        <div className="text-xs text-gray-500">{p.sku}</div>
                                                    </div>
                                                    <span className="text-xs px-2 py-1 bg-gray-100 rounded-md whitespace-nowrap ml-2">Tồn: {p.current_stock}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Transfer items */}
                            {transferItems.length > 0 && (
                                <div className="space-y-3">
                                    <label className="block text-sm font-medium text-gray-700">Sản phẩm đã chọn ({transferItems.length})</label>
                                    <div className="space-y-3">
                                        {transferItems.map(item => (
                                            <div key={item.product_id}
                                                className="flex flex-col gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 shadow-sm">
                                                <div className="flex justify-between items-start">
                                                    <div className="min-w-0 pr-2">
                                                        <div className="font-medium text-sm text-gray-900 line-clamp-2">{item.name}</div>
                                                        <div className="text-xs text-gray-500 mt-0.5">Tồn kho hiện tại: {item.stock}</div>
                                                    </div>
                                                    <button onClick={() => removeItem(item.product_id)}
                                                        className="text-gray-400 hover:text-red-500 p-1 -mr-1">✕</button>
                                                </div>
                                                <div className="flex items-center justify-between border-t border-gray-200 pt-2 mt-1">
                                                    <span className="text-xs font-medium text-gray-500">Số lượng chuyển:</span>
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                                                            className="w-9 h-9 rounded-lg bg-white border shadow-sm hover:bg-gray-50 text-gray-700 flex items-center justify-center font-bold text-lg active:scale-95 transition-transform">
                                                            −
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max={item.stock}
                                                            value={item.quantity}
                                                            onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 1)}
                                                            className="w-16 px-1 py-1 text-center font-bold text-gray-900 bg-transparent focus:outline-none"
                                                        />
                                                        <button
                                                            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                                                            className="w-9 h-9 rounded-lg bg-white border shadow-sm hover:bg-gray-50 text-gray-700 flex items-center justify-center font-bold text-lg active:scale-95 transition-transform">
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ghi chú</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Ghi chú thêm..."
                                    rows={3}
                                    className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary text-sm"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="sticky bottom-0 bg-white border-t p-4 md:p-6 flex gap-3 shrink-0 pb-safe">
                            <button
                                onClick={handleCreateTransfer}
                                disabled={!selectedToBranch || transferItems.length === 0 || isLoading}
                                className="flex-1 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark disabled:opacity-50 text-base shadow-sm active:scale-[0.98] transition-transform"
                            >
                                {isLoading ? 'Đang tạo...' : '✅ Tạo phiếu'}
                            </button>
                            <button
                                onClick={() => { setShowCreateModal(false); setTransferItems([]); }}
                                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 text-base"
                            >
                                Hủy
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transfer Detail Modal */}
            {showDetailModal && selectedTransfer && (
                <div className="fixed inset-0 z-50 flex flex-col md:flex-row md:items-center md:justify-center bg-gray-50 md:bg-black/50 md:backdrop-blur-sm md:p-4">
                    <div className="flex-1 flex flex-col bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-2xl shadow-xl overflow-hidden">
                        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 md:p-6 flex justify-between items-center shrink-0">
                            <div>
                                <h4 className="font-bold text-gray-900 text-lg md:text-xl">📋 Chi tiết phiếu</h4>
                                <p className="text-primary font-mono font-medium text-sm">{selectedTransfer.transfer_code}</p>
                            </div>
                            <button onClick={() => setShowDetailModal(false)}
                                className="p-2 -mr-2 text-gray-500 hover:bg-gray-100 rounded-lg">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
                            {/* Status */}
                            <div className="flex justify-center pb-2">
                                {getStatusBadge(selectedTransfer.status)}
                            </div>

                            {/* Transfer Info */}
                            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Từ chi nhánh</div>
                                    <div className="font-medium text-sm text-gray-900 line-clamp-2">{selectedTransfer.from_branch?.name || '—'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Đến chi nhánh</div>
                                    <div className="font-medium text-sm text-gray-900 line-clamp-2">{selectedTransfer.to_branch?.name || '—'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Ngày tạo</div>
                                    <div className="font-medium text-sm text-gray-900">{new Date(selectedTransfer.created_at).toLocaleString('vi-VN')}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Số sản phẩm</div>
                                    <div className="font-medium text-sm text-gray-900">{selectedTransfer.items?.length || 0} loại</div>
                                </div>
                            </div>

                            {/* Items List */}
                            {selectedTransfer.items && selectedTransfer.items.length > 0 && (
                                <div className="space-y-3">
                                    <div className="text-sm font-bold text-gray-900">Danh sách sản phẩm</div>
                                    <div className="border rounded-xl overflow-hidden shadow-sm">
                                        <div className="max-h-60 overflow-y-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 sticky top-0 z-10">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50">Sản phẩm</th>
                                                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50">SL</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 bg-white">
                                                    {selectedTransfer.items.map(item => (
                                                        <tr key={item.id}>
                                                            <td className="px-4 py-3">
                                                                <div className="font-medium text-gray-900 line-clamp-2">{item.product?.name || item.product_id}</div>
                                                                <div className="text-xs text-gray-400 mt-0.5">{item.product?.sku}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">{item.quantity}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            {selectedTransfer.notes && (
                                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 shadow-sm">
                                    <div className="text-xs text-amber-700 font-bold mb-1 uppercase tracking-wide">📝 Ghi chú</div>
                                    <div className="text-sm text-gray-800 italic">{selectedTransfer.notes}</div>
                                </div>
                            )}

                            {/* Timeline */}
                            <div className="space-y-3 pt-2">
                                <div className="text-sm font-bold text-gray-900">Lịch sử xử lý</div>
                                <div className="pl-2 border-l-2 border-gray-200 ml-2 space-y-4">
                                    <div className="relative pl-6">
                                        <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-white"></div>
                                        <div className="text-sm">
                                            <span className="font-bold text-gray-900 block">Tạo phiếu</span>
                                            <span className="text-xs text-gray-500 block mt-0.5">{new Date(selectedTransfer.created_at).toLocaleString('vi-VN')}</span>
                                        </div>
                                    </div>
                                    {selectedTransfer.shipped_at && (
                                        <div className="relative pl-6">
                                            <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-white"></div>
                                            <div className="text-sm">
                                                <span className="font-bold text-gray-900 block">Đã xuất kho</span>
                                                <span className="text-xs text-gray-500 block mt-0.5">{new Date(selectedTransfer.shipped_at).toLocaleString('vi-VN')}</span>
                                            </div>
                                        </div>
                                    )}
                                    {selectedTransfer.completed_at && (
                                        <div className="relative pl-6">
                                            <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-white"></div>
                                            <div className="text-sm">
                                                <span className="font-bold text-gray-900 block">Đã nhận hàng</span>
                                                <span className="text-xs text-gray-500 block mt-0.5">{new Date(selectedTransfer.completed_at).toLocaleString('vi-VN')}</span>
                                            </div>
                                        </div>
                                    )}
                                    {selectedTransfer.cancelled_at && (
                                        <div className="relative pl-6">
                                            <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-4 ring-white"></div>
                                            <div className="text-sm">
                                                <span className="font-bold text-gray-900 block">Đã hủy</span>
                                                <span className="text-xs text-gray-500 block mt-0.5">{new Date(selectedTransfer.cancelled_at).toLocaleString('vi-VN')}</span>
                                                {selectedTransfer.cancel_reason && (
                                                    <div className="text-xs text-red-600 mt-1 bg-red-50 p-2 rounded border border-red-100">Lý do: {selectedTransfer.cancel_reason}</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="sticky bottom-0 bg-white border-t p-4 md:p-6 flex flex-col md:flex-row gap-3 shrink-0 pb-safe">
                            <div className="grid grid-cols-2 gap-3 w-full">
                                {selectedTransfer.status === 'pending' && selectedTransfer.from_branch_id === currentBranchId && (
                                    <>
                                        <button onClick={() => handleShip(selectedTransfer.id)}
                                            className="col-span-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 text-sm shadow-sm active:scale-[0.98] transition-transform">
                                            📤 Xuất kho
                                        </button>
                                        <button onClick={() => handleCancel(selectedTransfer.id)}
                                            className="col-span-1 px-4 py-3 bg-red-100 text-red-600 rounded-xl font-bold hover:bg-red-200 text-sm active:scale-[0.98] transition-transform">
                                            ❌ Hủy phiếu
                                        </button>
                                    </>
                                )}
                                {selectedTransfer.status === 'in_transit' && selectedTransfer.to_branch_id === currentBranchId && (
                                    <button onClick={() => handleComplete(selectedTransfer.id)}
                                        className="col-span-2 px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 text-sm shadow-sm active:scale-[0.98] transition-transform">
                                        📥 Xác nhận đã nhận hàng
                                    </button>
                                )}

                                <button
                                    onClick={() => {
                                        if (!selectedTransfer) return;

                                        // Prepare data for template from Settings
                                        const transferData: TransferReceiptData = {
                                            transferNumber: selectedTransfer.transfer_code,
                                            date: new Date(selectedTransfer.created_at),
                                            fromWarehouse: selectedTransfer.from_branch?.name || 'N/A',
                                            toWarehouse: selectedTransfer.to_branch?.name || 'N/A',
                                            items: selectedTransfer.items?.map(item => ({
                                                name: item.product?.name || 'Sản phẩm',
                                                sku: item.product?.sku,
                                                quantity: item.quantity,
                                                unitName: 'cái',
                                                value: item.product?.price ? item.quantity * item.product.price : undefined
                                            })) || [],
                                            totalItems: selectedTransfer.items?.reduce((sum, i) => sum + i.quantity, 0) || 0,
                                            notes: selectedTransfer.notes,
                                            createdBy: user?.name || 'Nhân viên',
                                            storeName: printSettings.storeName || 'Cửa hàng',
                                            storeAddress: printSettings.storeAddress || ''
                                        };

                                        // Get config from Settings
                                        const templateConfig = printSettings.templates?.transfer_receipt || {
                                            showFromWarehouse: true,
                                            showToWarehouse: true
                                        };

                                        // Generate HTML from template
                                        const html = generateTransferReceiptHTML(transferData, templateConfig);

                                        // Open print window
                                        const printWindow = window.open('', '_blank');
                                        if (printWindow) {
                                            printWindow.document.write(html);
                                            printWindow.document.close();
                                            printWindow.print();
                                        }
                                    }}
                                    className="col-span-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
                                >
                                    🖨️ In phiếu
                                </button>
                                <button onClick={() => setShowDetailModal(false)}
                                    className="col-span-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 text-sm active:scale-[0.98]">
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Transfers List */}
            {filteredTransfers.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">🔄</span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">
                        {transfers.length === 0 ? 'Chưa có phiếu chuyển kho' : 'Không tìm thấy phiếu'}
                    </h3>
                    <p className="text-gray-500 mt-1">
                        {transfers.length === 0
                            ? 'Bấm "Tạo phiếu chuyển kho" để bắt đầu'
                            : 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm'}
                    </p>
                </div>
            ) : (
                <>
                    {/* Mobile Cards View */}
                    <div className="md:hidden space-y-3">
                        {filteredTransfers.map(transfer => (
                            <div key={transfer.id}
                                className="bg-white p-4 rounded-xl border shadow-sm active:bg-gray-50 transition-colors"
                                onClick={() => openDetail(transfer)}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex flex-col">
                                        <div className="font-bold text-gray-900 text-base">{transfer.transfer_code}</div>
                                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                            📅 {new Date(transfer.created_at).toLocaleDateString('vi-VN')}
                                            <span className="text-gray-300">|</span>
                                            📦 {transfer.items?.length || 0} SP
                                        </div>
                                    </div>
                                    {getStatusBadge(transfer.status)}
                                </div>

                                <div className="flex items-center gap-2 text-sm bg-gray-50 p-2.5 rounded-lg border border-gray-100 mb-3">
                                    <span className="font-medium text-gray-700 truncate max-w-[40%]">{transfer.from_branch?.name}</span>
                                    <span className="text-gray-400">➡️</span>
                                    <span className="font-medium text-gray-900 truncate max-w-[40%]">{transfer.to_branch?.name}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-3" onClick={(e) => e.stopPropagation()}>
                                    {transfer.status === 'pending' && transfer.from_branch_id === currentBranchId ? (
                                        <button onClick={() => handleShip(transfer.id)}
                                            className="col-span-2 w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                            📤 Xuất kho ngay
                                        </button>
                                    ) : transfer.status === 'in_transit' && transfer.to_branch_id === currentBranchId ? (
                                        <button onClick={() => handleComplete(transfer.id)}
                                            className="col-span-2 w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-green-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                            📥 Nhận hàng ngay
                                        </button>
                                    ) : (
                                        <button className="col-span-2 w-full py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">
                                            Xem chi tiết
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Mã phiếu</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Từ → Đến</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Ngày tạo</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase">Số SP</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase">Trạng thái</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredTransfers.map(transfer => (
                                    <tr key={transfer.id} className="hover:bg-gray-50 cursor-pointer"
                                        onClick={() => openDetail(transfer)}>
                                        <td className="px-6 py-4 font-medium text-primary">{transfer.transfer_code}</td>
                                        <td className="px-6 py-4">
                                            <span className="text-gray-600">{transfer.from_branch?.name}</span>
                                            <span className="mx-2 text-gray-400">→</span>
                                            <span className="text-gray-900 font-medium">{transfer.to_branch?.name}</span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {new Date(transfer.created_at).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="px-6 py-4 text-center">{transfer.items?.length || 0}</td>
                                        <td className="px-6 py-4 text-center">{getStatusBadge(transfer.status)}</td>
                                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            {transfer.status === 'pending' && transfer.from_branch_id === currentBranchId && (
                                                <button onClick={() => handleShip(transfer.id)}
                                                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200">
                                                    📤 Xuất kho
                                                </button>
                                            )}
                                            {transfer.status === 'in_transit' && transfer.to_branch_id === currentBranchId && (
                                                <button onClick={() => handleComplete(transfer.id)}
                                                    className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200">
                                                    📥 Nhận hàng
                                                </button>
                                            )}
                                            {['completed', 'cancelled'].includes(transfer.status) && (
                                                <button className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200">
                                                    👁️ Xem
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>


                </>
            )}

            {/* Barcode Scanner Modal */}
            {showScanner && (
                <BarcodeScannerModal
                    onScan={handleBarcodeScan}
                    onClose={() => setShowScanner(false)}
                    title="Quét sản phẩm chuyển kho"
                />
            )}

            {/* Product Selection Modal for duplicate barcodes */}
            {barcodeMatches.length > 0 && (
                <BarcodeSelectionModal
                    matches={barcodeMatches}
                    onSelect={handleBarcodeSelect}
                    onClose={() => setBarcodeMatches([])}
                />
            )}
        </div>
    );
}

export default InventoryPage;
