// =============================================================================
// STOCK AUDIT DETAIL PAGE
// =============================================================================

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle, AlertTriangle, ScanBarcode, Search, Trash2, Plus, Minus, X } from 'lucide-react';
import { useStockAuditStore, type StockAuditItem } from '@/stores/stockAuditStore';
import { useProductStore } from '@/stores/productStore';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Loading } from '@/components/common/Loading';
import { BarcodeScannerModal } from '@/components/common/BarcodeScannerModal';
import { POSAudio } from '@/lib/posAudio';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function StockAuditDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isMobile } = useBreakpoint();

    const {
        getAudit,
        currentAudit,
        addItem,
        updateItem,
        deleteItem,
        applyAudit,
        cancelAudit,
        isLoading
    } = useStockAuditStore();

    const { products, loadProducts } = useProductStore();

    const [searchTerm, setSearchTerm] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // Initial load
    useEffect(() => {
        if (id) {
            getAudit(id);
            loadProducts(); // Load products for search/add
        }
    }, [id]);

    // Search logic
    useEffect(() => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            return;
        }

        const term = searchTerm.toLowerCase();
        const results = products.filter(p =>
            p.name.toLowerCase().includes(term) ||
            p.sku?.toLowerCase().includes(term) ||
            p.barcode?.includes(term)
        ).slice(0, 10); // Limit results

        setSearchResults(results);
    }, [searchTerm, products]);

    const handleBarcodeScan = async (code: string) => {
        if (!currentAudit || currentAudit.status !== 'draft') return;

        const product = products.find(p => p.barcode === code || p.sku === code);

        if (product) {
            POSAudio.playAddItem();

            // Generate sound feedback and add item
            const existingItem = currentAudit.items?.find(i => i.product_id === product.id);

            if (existingItem) {
                // If exists, increment actual qty
                await updateItem(existingItem.id, existingItem.actual_qty + 1);
                toast.success(`Đã tăng số lượng: ${product.name}`);
            } else {
                // Add new item
                await addItem(currentAudit.id, product.id, product.current_stock, 1);
                toast.success(`Đã thêm: ${product.name}`);
            }

            // Refresh audit data
            getAudit(id!);
            setShowScanner(false);
        } else {
            POSAudio.playError();
            toast.error(`Không tìm thấy sản phẩm mã "${code}"`);
        }
    };

    const handleAddProduct = async (product: any) => {
        if (!currentAudit || currentAudit.status !== 'draft') return;

        const existingItem = currentAudit.items?.find(i => i.product_id === product.id);

        if (existingItem) {
            toast.info(`Sản phẩm ${product.name} đã có trong danh sách`);
        } else {
            await addItem(currentAudit.id, product.id, product.current_stock, 0); // Start with 0 actual
            toast.success(`Đã thêm ${product.name}`);
            getAudit(id!);
        }
        setSearchTerm('');
        setSearchResults([]);
    };

    const handleQuantityChange = async (itemId: string, newQty: number) => {
        if (newQty < 0) return;
        await updateItem(itemId, newQty);
        // Optimistic update locally could be done here, but for safety we refresh or rely on store
        useStockAuditStore.setState(state => ({
            currentAudit: state.currentAudit ? {
                ...state.currentAudit,
                items: state.currentAudit.items?.map(i =>
                    i.id === itemId ? { ...i, actual_qty: newQty, difference: newQty - i.system_qty } : i
                )
            } : null
        }));
    };

    const handleComplete = async () => {
        if (!currentAudit) return;

        const uncounted = currentAudit.items?.filter(i => i.actual_qty === 0).length || 0;
        if (uncounted > 0) {
            if (!confirm(`Có ${uncounted} sản phẩm có số lượng thực tế = 0. Bạn có chắc chắn muốn hoàn tất?`)) return;
        } else {
            if (!confirm('Hệ thống sẽ cập nhật tồn kho theo số lượng thực tế. Bạn có chắc chắn?')) return;
        }

        setIsProcessing(true);
        const success = await applyAudit(currentAudit.id);
        setIsProcessing(false);

        if (success) {
            toast.success('Đã hoàn tất kiểm kê và cập nhật kho!');
            navigate('/inventory/audits');
        } else {
            toast.error('Có lỗi xảy ra khi hoàn tất kiểm kê.');
        }
    };

    if (isLoading && !currentAudit) return <Loading />;
    if (!currentAudit) return <div className="p-8 text-center">Không tìm thấy phiếu kiểm kê</div>;

    const isDraft = currentAudit.status === 'draft';
    const totalDiff = currentAudit.items?.reduce((sum, i) => sum + Math.abs(i.difference), 0) || 0;

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
                <div className="container-app py-4">
                    <div className="flex items-center gap-3 mb-2">
                        <button onClick={() => navigate('/inventory/audits')} className="p-1 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                {currentAudit.code}
                                <span className={cn(
                                    "text-xs px-2 py-0.5 rounded-full border font-normal",
                                    currentAudit.status === 'completed' ? "bg-green-100 text-green-700 border-green-200" :
                                        currentAudit.status === 'cancelled' ? "bg-red-100 text-red-700 border-red-200" :
                                            "bg-amber-100 text-amber-700 border-amber-200"
                                )}>
                                    {currentAudit.status === 'completed' ? 'Hoàn thành' :
                                        currentAudit.status === 'cancelled' ? 'Đã hủy' : 'Bản nháp'}
                                </span>
                            </h1>
                            <p className="text-sm text-gray-500">
                                {currentAudit.items?.length || 0} sản phẩm • Chênh lệch tổng: {totalDiff}
                            </p>
                        </div>
                    </div>

                    {/* Search / Scan Bar (Only in Draft) */}
                    {isDraft && (
                        <div className="relative mt-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Tìm thêm sản phẩm vào phiếu..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-12 py-3 bg-gray-100 border-transparent focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all outline-none font-medium text-lg" // Larger text for mobile
                                />
                                <button
                                    onClick={() => setShowScanner(true)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white text-gray-600 rounded-lg shadow-sm border border-gray-200 hover:text-primary active:bg-gray-50"
                                >
                                    <ScanBarcode className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Search Dropdown */}
                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto z-30 divide-y divide-gray-50">
                                    {searchResults.map(product => (
                                        <div
                                            key={product.id}
                                            onClick={() => handleAddProduct(product)}
                                            className="p-3 hover:bg-gray-50 active:bg-blue-50 cursor-pointer flex items-center justify-between"
                                        >
                                            <div>
                                                <div className="font-medium text-gray-900">{product.name}</div>
                                                <div className="text-xs text-gray-500">{product.sku}</div>
                                            </div>
                                            <Plus className="w-5 h-5 text-primary" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Content Items */}
            <main className="container-app py-4 space-y-4">
                {currentAudit.items?.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                        <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <p>Chưa có sản phẩm nào trong phiếu kiểm kê.</p>
                        <p className="text-sm mt-1">Tìm kiếm hoặc quét mã để thêm sản phẩm.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {currentAudit.items?.map((item) => (
                            <div
                                key={item.id}
                                className={cn(
                                    "bg-white rounded-xl border p-4 shadow-sm relative overflow-hidden transition-all",
                                    item.difference !== 0 ? "border-amber-200 ring-1 ring-amber-100" : "border-gray-200",
                                    "hover:shadow-md"
                                )}
                            >
                                {/* Status Indicator Strip */}
                                <div className={cn(
                                    "absolute top-0 left-0 bottom-0 w-1",
                                    item.difference === 0 ? "bg-green-500" :
                                        item.difference > 0 ? "bg-blue-500" : "bg-red-500"
                                )} />

                                <div className="pl-3">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1 min-w-0 pr-2">
                                            <h3 className="font-bold text-gray-900 truncate text-lg leading-tight">
                                                {item.product_name}
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                                                <span className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">{item.product_sku}</span>
                                            </p>
                                        </div>
                                        {isDraft && (
                                            <button
                                                onClick={() => {
                                                    if (confirm('Xóa sản phẩm này khỏi phiếu?')) deleteItem(item.id);
                                                }}
                                                className="text-gray-400 hover:text-red-500 p-1"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex items-end justify-between gap-4">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-gray-500">Hệ thống</span>
                                            <span className="text-lg font-semibold text-gray-700">{item.system_qty}</span>
                                        </div>

                                        <div className="flex-1 flex flex-col items-center">
                                            <span className="text-xs text-gray-500 mb-1 font-medium text-primary">Thực tế</span>
                                            {isDraft ? (
                                                <div className="flex items-center gap-1 w-full max-w-[140px]">
                                                    <button
                                                        onClick={() => handleQuantityChange(item.id, Math.max(0, item.actual_qty - 1))}
                                                        className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-600 active:bg-gray-200"
                                                    >
                                                        <Minus className="w-5 h-5" />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={item.actual_qty}
                                                        onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                                                        className="flex-1 h-10 text-center border px-1 border-gray-300 rounded-lg font-bold text-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                                        onClick={(e) => e.currentTarget.select()}
                                                    />
                                                    <button
                                                        onClick={() => handleQuantityChange(item.id, item.actual_qty + 1)}
                                                        className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-600 active:bg-gray-200"
                                                    >
                                                        <Plus className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-2xl font-bold text-gray-900">{item.actual_qty}</span>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-end">
                                            <span className="text-xs text-gray-500">Chênh lệch</span>
                                            <span className={cn(
                                                "text-lg font-bold",
                                                item.difference > 0 ? "text-blue-600" :
                                                    item.difference < 0 ? "text-red-600" : "text-green-600"
                                            )}>
                                                {item.difference > 0 ? '+' : ''}{item.difference}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Floating Action Bar (Sticky Footer) */}
            {isDraft && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
                    <div className="container-app flex items-center justify-between gap-4">
                        <div className="hidden md:block">
                            <p className="text-sm text-gray-500">
                                Đã đếm {currentAudit.items?.filter(i => i.actual_qty > 0).length || 0} sản phẩm
                            </p>
                        </div>
                        <div className="flex-1 flex gap-3 md:flex-none md:ml-auto w-full md:w-auto">
                            <button
                                onClick={() => {
                                    if (confirm('Hủy phiếu kiểm kê này?')) {
                                        cancelAudit(currentAudit.id);
                                        navigate('/inventory/audits');
                                    }
                                }}
                                className="flex-1 md:flex-none px-6 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleComplete}
                                disabled={isProcessing}
                                className="flex-[2] md:flex-none px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
                            >
                                {isProcessing ? 'Đang xử lý...' : (
                                    <>
                                        <CheckCircle className="w-5 h-5" />
                                        Hoàn tất & Cập nhật kho
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Scanner Modal */}
            {showScanner && (
                <BarcodeScannerModal
                    onScan={handleBarcodeScan}
                    onClose={() => setShowScanner(false)}
                    title="Quét sản phẩm thêm vào phiếu"
                />
            )}
        </div>
    );
}
