// =============================================================================
// STOCK TAKE PAGE - Inventory Count
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { useProductStore } from '@/stores/productStore';
import { formatVND } from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';
import type { Product } from '@/types';
import { ProductLink } from '@/components/products/ProductLink';
import { BarcodeScannerModal } from '@/components/common/BarcodeScannerModal';
import { BarcodeSelectionModal, findProductsByBarcode, type BarcodeMatch } from '@/components/common/BarcodeSelectionModal';
import { POSAudio } from '@/lib/posAudio';
import { toast } from 'sonner';
import { ScanBarcode } from 'lucide-react';

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

    // Scanner states
    const [showScanner, setShowScanner] = useState(false);
    const [barcodeMatches, setBarcodeMatches] = useState<BarcodeMatch[]>([]);

    // Handle barcode scan - find product and highlight it
    const handleBarcodeScan = (code: string) => {
        const matches = findProductsByBarcode(products, code);

        if (matches.length === 0) {
            POSAudio.playError();
            toast.error(`Mã "${code}" không tồn tại trong kho!`);
        } else if (matches.length === 1) {
            // Single match - jump to that product
            setShowScanner(false);
            selectProductForCounting(matches[0].product.id);
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
        selectProductForCounting(match.product.id);
        POSAudio.playAddItem();
    };

    // Helper: Jump to product and focus its input
    const selectProductForCounting = (productId: string) => {
        // Set search to highlight the product
        const product = products.find(p => p.id === productId);
        if (product) {
            setSearchQuery(product.sku || product.barcode || product.name);
            setFilter('all');
            toast.success(`Đã chọn: ${product.name}`);
            // Scroll to product after a short delay
            setTimeout(() => {
                const el = document.getElementById(`stock-take-${productId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                    setTimeout(() => el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
                }
            }, 100);
        }
    };

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
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {filteredItems.map((item) => (
                            <div
                                key={item.product_id}
                                id={`stock-take-${item.product_id}`}
                                className={cn("p-4 transition-all", item.actual_stock !== null && item.difference !== 0 ? "bg-yellow-50/50" : "")}
                            >
                                <div className="mb-3">
                                    <div className="font-bold text-gray-900 text-base">{item.product.name}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-mono">{item.product.sku || '---'}</span>
                                        {item.product.barcode && (
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                <span className="text-[10px]">║█║</span> {item.product.barcode}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4 items-end">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 mb-1">Hệ thống</span>
                                        <div className="font-medium text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 text-center">
                                            {item.system_stock}
                                        </div>
                                    </div>

                                    <div className="flex flex-col">
                                        <span className="text-xs text-blue-600 font-medium mb-1">Thực tế</span>
                                        <StockTakeInput
                                            value={item.actual_stock}
                                            onChange={(val) => handleActualStockChange(item.product_id, val)}
                                        />
                                    </div>

                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 mb-1">Chênh lệch</span>
                                        <div className={cn(
                                            "font-bold px-3 py-2 rounded-lg border text-center",
                                            item.actual_stock === null ? "bg-gray-50 border-gray-200 text-gray-400" :
                                                item.difference === 0 ? "bg-green-50 border-green-200 text-green-600" :
                                                    item.difference > 0 ? "bg-blue-50 border-blue-200 text-blue-600" :
                                                        "bg-red-50 border-red-200 text-red-600"
                                        )}>
                                            {item.actual_stock === null ? '-' : (item.difference > 0 ? `+${item.difference}` : item.difference)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredItems.length === 0 && (
                            <div className="py-12 text-center text-gray-500">Không tìm thấy sản phẩm nào</div>
                        )}
                    </div>

                    {/* Desktop Table */}
                    <table className="hidden md:table w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sản phẩm</th>
                                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Hệ thống</th>
                                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Thực tế</th>
                                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Chênh lệch</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredItems.map((item) => (
                                <StockTakeRow
                                    key={item.product_id}
                                    item={item}
                                    onActualChange={(value) => handleActualStockChange(item.product_id, value)}
                                />
                            ))}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">Không tìm thấy sản phẩm nào</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </main>

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
    return (
        <tr
            id={`stock-take-${item.product_id}`}
            className={cn(
                'hover:bg-gray-50 transition-all',
                item.difference !== 0 && 'bg-amber-50'
            )}
        >
            <td className="px-6 py-4">
                <ProductLink
                    productId={item.product_id}
                    productName={item.product.name}
                    style={{ fontWeight: 500, display: 'block', fontSize: '0.875rem' }}
                />
                <div className="text-xs text-gray-500 mt-1">
                    {item.product.sku} {item.product.barcode && `• ${item.product.barcode}`}
                </div>
            </td>
            <td className="px-6 py-4 text-center font-medium text-gray-700">
                {item.system_stock}
            </td>
            <td className="px-6 py-4">
                <StockTakeInput
                    value={item.actual_stock}
                    onChange={onActualChange}
                />
            </td>
            <td className="px-6 py-4 text-center">
                {item.actual_stock !== null && (
                    <span className={cn(
                        'font-bold text-sm',
                        item.difference > 0 ? 'text-blue-600' : item.difference < 0 ? 'text-red-600' : 'text-green-600'
                    )}>
                        {item.difference > 0 ? '+' : ''}{item.difference}
                    </span>
                )}
            </td>
        </tr>
    );
}

function StockTakeInput({ value, onChange }: { value: number | null; onChange: (val: number | null) => void }) {
    const [inputValue, setInputValue] = useState<string>(value?.toString() || '');

    useEffect(() => {
        setInputValue(value?.toString() || '');
    }, [value]);

    const handleBlur = () => {
        if (inputValue === '' || inputValue === null) {
            onChange(null);
        } else {
            const num = Number(inputValue);
            if (!isNaN(num)) onChange(num);
        }
    };

    return (
        <input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.currentTarget.blur();
                }
            }}
            placeholder="-"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-gray-900 placeholder-gray-400"
        />
    );
}

export default StockTakePage;
