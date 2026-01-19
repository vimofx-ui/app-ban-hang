// =============================================================================
// GOODS RECEIPT PAGE - Receive goods with barcode scanning
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Package, Barcode, AlertTriangle, CheckCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { usePurchaseOrderStore, type GoodsReceiptItem } from '@/stores/purchaseOrderStore';
import { Loading } from '@/components/common/Loading';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export function GoodsReceiptPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentReceipt, getGoodsReceipt, updateReceiptItem, completeReceipt, isLoading } = usePurchaseOrderStore();
    const { isMobile } = useBreakpoint();

    const [barcodeInput, setBarcodeInput] = useState('');
    const [lastScanned, setLastScanned] = useState<string | null>(null);
    const [scanMode, setScanMode] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [pageLoading, setPageLoading] = useState(true);
    const [selectedItemIndex, setSelectedItemIndex] = useState<number>(-1);
    const barcodeRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (id) {
            setPageLoading(true);
            setLoadError(null);
            getGoodsReceipt(id).then((result) => {
                if (!result) {
                    setLoadError('Không tìm thấy phiếu nhập kho. Đơn hàng này có thể chưa được tạo phiếu nhập.');
                }
                setPageLoading(false);
            }).catch((err) => {
                setLoadError('Lỗi khi tải phiếu nhập kho: ' + (err?.message || 'Không xác định'));
                setPageLoading(false);
            });
        }
    }, [id]);

    useEffect(() => {
        // Focus barcode input when in scan mode
        if (scanMode && barcodeRef.current) {
            barcodeRef.current.focus();
        }
    }, [scanMode, currentReceipt]);

    // Keyboard navigation handler
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!currentReceipt?.items || currentReceipt.status !== 'draft') return;

        const items = currentReceipt.items;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedItemIndex(prev => Math.min(prev + 1, items.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedItemIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                // Only handle Enter when an item is selected and barcode input is not focused
                if (selectedItemIndex >= 0 && document.activeElement !== barcodeRef.current) {
                    const item = items[selectedItemIndex];
                    if (item && item.received_qty < item.expected_qty) {
                        handleManualUpdate(item.id, item.expected_qty);
                    }
                }
                break;
            case '+':
            case '=':
                if (selectedItemIndex >= 0 && document.activeElement !== barcodeRef.current) {
                    e.preventDefault();
                    const item = items[selectedItemIndex];
                    if (item) {
                        handleManualUpdate(item.id, item.received_qty + 1);
                    }
                }
                break;
            case '-':
                if (selectedItemIndex >= 0 && document.activeElement !== barcodeRef.current) {
                    e.preventDefault();
                    const item = items[selectedItemIndex];
                    if (item && item.received_qty > 0) {
                        handleManualUpdate(item.id, item.received_qty - 1);
                    }
                }
                break;
            case 'Escape':
                setSelectedItemIndex(-1);
                barcodeRef.current?.focus();
                break;
        }
    }, [currentReceipt, selectedItemIndex]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const handleBarcodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!barcodeInput.trim() || !currentReceipt?.items) return;

        // Find matching item by barcode or SKU
        const item = currentReceipt.items.find(i =>
            i.barcode === barcodeInput || i.sku === barcodeInput
        );

        if (item) {
            // Increment received quantity
            const newQty = (item.received_qty || 0) + 1;
            updateReceiptItem(item.id, newQty);
            setLastScanned(item.product_name);

            // Update local state
            getGoodsReceipt(id!);
        } else {
            setLastScanned(`⚠️ Không tìm thấy: ${barcodeInput}`);
        }

        setBarcodeInput('');
    };

    const handleManualUpdate = async (itemId: string, receivedQty: number, damagedQty: number = 0) => {
        await updateReceiptItem(itemId, receivedQty, damagedQty);
        getGoodsReceipt(id!);
    };

    const handleComplete = async () => {
        if (!id) return;

        const unreceivedItems = currentReceipt?.items?.filter(i => i.received_qty === 0) || [];

        if (unreceivedItems.length > 0) {
            if (!confirm(`Còn ${unreceivedItems.length} sản phẩm chưa nhận. Bạn có chắc muốn hoàn tất?`)) {
                return;
            }
        }

        await completeReceipt(id);
        navigate('/nhap-hang');
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN').format(amount);
    };

    const getItemStatus = (item: GoodsReceiptItem) => {
        if (item.received_qty === 0) return 'pending';
        if (item.received_qty < item.expected_qty) return 'partial';
        if (item.received_qty > item.expected_qty) return 'over';
        return 'complete';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-gray-100 text-gray-600';
            case 'partial': return 'bg-yellow-100 text-yellow-700';
            case 'over': return 'bg-red-100 text-red-700';
            case 'complete': return 'bg-green-100 text-green-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    if (pageLoading) return <Loading />;

    if (loadError || !currentReceipt) {
        return (
            <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md text-center">
                    <AlertTriangle size={48} className="text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Không thể tải phiếu nhập</h2>
                    <p className="text-gray-600 mb-6">{loadError || 'Phiếu nhập không tồn tại.'}</p>
                    <button
                        onClick={() => navigate('/nhap-hang')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Quay lại danh sách
                    </button>
                </div>
            </div>
        );
    }

    const totalExpected = currentReceipt.items?.reduce((sum, i) => sum + i.expected_qty, 0) || 0;
    const totalReceived = currentReceipt.items?.reduce((sum, i) => sum + i.received_qty, 0) || 0;
    const progressPercent = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => navigate('/nhap-hang')}
                        className="p-2 hover:bg-gray-200 rounded-lg"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-gray-900">Nhập Kho</h1>
                        <p className="text-gray-500 text-sm">
                            Phiếu: {currentReceipt.receipt_number} • NCC: {currentReceipt.supplier_name}
                        </p>
                    </div>
                    {currentReceipt.status === 'draft' && (
                        <button
                            onClick={handleComplete}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                        >
                            <CheckCircle size={20} />
                            Hoàn tất nhập kho
                        </button>
                    )}
                </div>

                {/* Progress */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600">Tiến độ nhập kho</span>
                        <span className="font-bold text-gray-900">{totalReceived} / {totalExpected}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                            className={`h-3 rounded-full transition-all ${progressPercent === 100 ? 'bg-green-500' : 'bg-blue-500'
                                }`}
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="text-right text-sm text-gray-500 mt-1">{progressPercent}%</div>
                </div>

                {/* Barcode Scanner */}
                {currentReceipt.status === 'draft' && (
                    <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-6">
                        <div className="flex items-center gap-3 mb-3">
                            <Barcode className="text-blue-600" size={24} />
                            <h3 className="font-semibold text-blue-800">Quét Barcode</h3>
                            <label className="ml-auto flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={scanMode}
                                    onChange={(e) => setScanMode(e.target.checked)}
                                    className="rounded"
                                />
                                <span className="text-blue-600">Chế độ quét liên tục</span>
                            </label>
                        </div>
                        <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                            <input
                                ref={barcodeRef}
                                type="text"
                                value={barcodeInput}
                                onChange={(e) => setBarcodeInput(e.target.value)}
                                placeholder="Quét hoặc nhập mã barcode/SKU..."
                                className="flex-1 px-4 py-3 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                                autoFocus
                            />
                            <button
                                type="submit"
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                            >
                                Nhập
                            </button>
                        </form>
                        {lastScanned && (
                            <div className={`mt-2 text-sm ${lastScanned.startsWith('⚠️') ? 'text-red-600' : 'text-green-600'}`}>
                                {lastScanned.startsWith('⚠️') ? lastScanned : `✓ Đã quét: ${lastScanned}`}
                            </div>
                        )}
                    </div>
                )}

                {/* Items List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <h3 className="font-semibold text-gray-900">Danh sách sản phẩm</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {currentReceipt.items?.map((item, index) => {
                            const status = getItemStatus(item);
                            const isSelected = index === selectedItemIndex;

                            return (
                                <div
                                    key={item.id}
                                    className={`p-4 transition-all duration-200 cursor-pointer ${isSelected
                                        ? 'bg-blue-50 ring-2 ring-blue-500 z-10 relative shadow-md'
                                        : 'hover:bg-gray-50 border-b border-gray-100 last:border-0'
                                        }`}
                                    onClick={() => setSelectedItemIndex(index)}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-gray-900 truncate">{item.product_name}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${getStatusColor(status)}`}>
                                                    {status === 'pending' && 'Chờ nhận'}
                                                    {status === 'partial' && 'Thiếu'}
                                                    {status === 'over' && 'Dư'}
                                                    {status === 'complete' && 'Đủ'}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                                                {item.sku && <span>SKU: {item.sku}</span>}
                                                {item.barcode && <span>Barcode: {item.barcode}</span>}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 bg-gray-50 sm:bg-transparent p-3 sm:p-0 rounded-lg sm:rounded-none">
                                            <div className="text-center min-w-[3rem]">
                                                <div className="text-xs text-gray-500 mb-1">Đặt</div>
                                                <div className="font-bold text-gray-900">{item.expected_qty}</div>
                                            </div>

                                            <div className="text-center min-w-[5rem]">
                                                <div className="text-xs text-gray-500 mb-1">Đã nhận</div>
                                                {currentReceipt.status === 'draft' ? (
                                                    <input
                                                        type="number"
                                                        value={item.received_qty}
                                                        onChange={(e) => handleManualUpdate(item.id, parseInt(e.target.value) || 0)}
                                                        className={`w-20 px-2 py-1 border rounded-lg text-center font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-shadow ${status === 'complete' ? 'border-green-300 bg-green-50' :
                                                            status === 'over' ? 'border-red-300 bg-red-50' :
                                                                'border-gray-200 bg-white'
                                                            }`}
                                                        min="0"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    <div className="font-bold text-gray-900">{item.received_qty}</div>
                                                )}
                                            </div>

                                            {currentReceipt.status === 'draft' && (
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleManualUpdate(item.id, item.received_qty + 1); }}
                                                        className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
                                                        title="+1"
                                                    >
                                                        +1
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleManualUpdate(item.id, item.expected_qty); }}
                                                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                                                        title="Đủ số lượng"
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {item.received_qty > item.expected_qty && (
                                        <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                                            <AlertTriangle size={14} />
                                            Vượt số lượng đặt hàng ({item.received_qty - item.expected_qty} sp)
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Summary */}
                <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-gray-900">{currentReceipt.items?.length || 0}</div>
                            <div className="text-sm text-gray-500">Số mặt hàng</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-green-600">{totalReceived}</div>
                            <div className="text-sm text-gray-500">Đã nhận</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-900">
                                {formatCurrency(currentReceipt.total_amount)}đ
                            </div>
                            <div className="text-sm text-gray-500">Tổng giá trị</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
