import React, { useState, useEffect } from 'react';
import { X, Package, Minus, Plus, AlertTriangle } from 'lucide-react';

interface ReturnItem {
    id: string;
    product_id: string;
    product_name: string;
    sku: string;
    ordered_qty: number;
    unit_price: number;
}

interface ReturnToSupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: ReturnItem[];
    poNumber: string;
    onConfirm: (returnItems: { productId: string; returnQty: number; cost: number }[]) => Promise<void>;
}

export const ReturnToSupplierModal: React.FC<ReturnToSupplierModalProps> = ({
    isOpen,
    onClose,
    items,
    poNumber,
    onConfirm
}) => {
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectAll, setSelectAll] = useState(false);

    // Initialize quantities when modal opens
    useEffect(() => {
        if (isOpen) {
            const initialQtys: Record<string, number> = {};
            items.forEach(item => {
                initialQtys[item.id] = item.ordered_qty;
            });
            setReturnQtys(initialQtys);
            setSelectedItems(new Set());
            setSelectAll(false);
        }
    }, [isOpen, items]);

    // Handle select all toggle
    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(items.map(i => i.id)));
        }
        setSelectAll(!selectAll);
    };

    // Toggle individual item selection
    const toggleItem = (id: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedItems(newSelected);
        setSelectAll(newSelected.size === items.length);
    };

    // Adjust quantity
    const adjustQty = (id: string, delta: number) => {
        const item = items.find(i => i.id === id);
        if (!item) return;

        const current = returnQtys[id] || 0;
        const newQty = Math.max(0, Math.min(item.ordered_qty, current + delta));
        setReturnQtys(prev => ({ ...prev, [id]: newQty }));
    };

    // Handle confirm
    const handleConfirm = async () => {
        if (selectedItems.size === 0) return;

        setIsProcessing(true);
        try {
            const returnData = items
                .filter(item => selectedItems.has(item.id) && (returnQtys[item.id] || 0) > 0)
                .map(item => ({
                    productId: item.product_id,
                    returnQty: returnQtys[item.id] || item.ordered_qty,
                    cost: item.unit_price
                }));

            await onConfirm(returnData);
            onClose();
        } catch (error) {
            console.error('Error processing return:', error);
            alert('Có lỗi xảy ra khi xử lý trả hàng');
        } finally {
            setIsProcessing(false);
        }
    };

    // Calculate totals
    const selectedTotal = items
        .filter(item => selectedItems.has(item.id))
        .reduce((sum, item) => sum + (returnQtys[item.id] || 0) * item.unit_price, 0);

    const selectedQty = items
        .filter(item => selectedItems.has(item.id))
        .reduce((sum, item) => sum + (returnQtys[item.id] || 0), 0);

    if (!isOpen) return null;

    const formatCurrency = (value: number) => {
        return value.toLocaleString('vi-VN');
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop - z-index thấp để không chặn modal */}
            <div className="fixed inset-0 bg-black/50 z-[50]" />

            {/* Modal Container - z-index cao hơn backdrop */}
            <div
                className="fixed inset-0 z-[51] flex items-center justify-center p-2 sm:p-4"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div
                    className="relative bg-white rounded-xl shadow-xl w-[95vw] sm:w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-hidden mx-auto z-[52]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-green-50">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <Package className="text-green-600" size={20} />
                                Trả hàng nhà cung cấp
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">Đơn: {poNumber}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-green-100 rounded-lg text-gray-500"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4 sm:p-6 overflow-y-auto max-h-[60vh]">
                        {/* Select All */}
                        <label className="flex items-center gap-3 mb-4 pb-3 border-b cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={selectAll}
                                onChange={handleSelectAll}
                                className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                            />
                            <span className="font-medium text-gray-900">
                                Chọn tất cả ({items.length} sản phẩm)
                            </span>
                        </label>

                        {/* Items List */}
                        <div className="space-y-3">
                            {items.map(item => {
                                const isSelected = selectedItems.has(item.id);
                                const qty = returnQtys[item.id] || 0;

                                return (
                                    <div
                                        key={item.id}
                                        className={`p-3 rounded-lg border transition-colors ${isSelected
                                            ? 'bg-red-50 border-red-200'
                                            : 'bg-gray-50 border-gray-200'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Checkbox */}
                                            <label className="cursor-pointer mt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleItem(item.id)}
                                                    className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                                />
                                            </label>

                                            {/* Product Icon */}
                                            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0 border">
                                                <Package size={20} className="text-gray-400" />
                                            </div>

                                            {/* Product Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-gray-900 truncate">
                                                    {item.product_name}
                                                </div>
                                                <div className="text-xs text-gray-500">{item.sku}</div>
                                                <div className="flex items-center gap-2 mt-1 text-sm">
                                                    <span className="text-gray-600">
                                                        Đã nhập: <strong>{item.ordered_qty}</strong>
                                                    </span>
                                                    <span className="text-blue-600">
                                                        {formatCurrency(item.unit_price)}đ
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Quantity Control */}
                                            {isSelected && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => adjustQty(item.id, -1)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-100"
                                                    >
                                                        <Minus size={16} />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={qty}
                                                        onChange={(e) => {
                                                            const val = Math.max(0, Math.min(item.ordered_qty, parseInt(e.target.value) || 0));
                                                            setReturnQtys(prev => ({ ...prev, [item.id]: val }));
                                                        }}
                                                        className="w-14 h-8 text-center border border-gray-300 rounded-lg"
                                                    />
                                                    <button
                                                        onClick={() => adjustQty(item.id, 1)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-100"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-4 sm:px-6 py-4 border-t border-gray-200 bg-gray-50">
                        {/* Summary */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <div className="text-sm text-gray-600">
                                Đã chọn: <strong className="text-green-600">{selectedItems.size} sản phẩm</strong>
                                {selectedItems.size > 0 && (
                                    <span> ({selectedQty} đơn vị)</span>
                                )}
                            </div>
                            <div className="text-lg font-semibold text-gray-900">
                                Tổng trả: <span className="text-green-600">{formatCurrency(selectedTotal)}đ</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col-reverse sm:flex-row gap-3">
                            <button
                                onClick={onClose}
                                disabled={isProcessing}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={selectedItems.size === 0 || isProcessing}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                                {isProcessing ? 'Đang xử lý...' : `Xác nhận trả hàng (${selectedItems.size})`}
                            </button>
                        </div>

                        <p className="text-xs text-gray-500 text-center mt-3">
                            ⚠️ Kho sẽ được cập nhật và công nợ sẽ được tính lại sau khi xác nhận
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
