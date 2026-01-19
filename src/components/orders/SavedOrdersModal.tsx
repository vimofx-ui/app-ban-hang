import React, { useState } from 'react';
import { usePOSStore } from "@/stores/posStore";
import { useAuthStore } from "@/stores/authStore";
import { formatVND } from "@/lib/cashReconciliation";
import { X, Clock, User, FileText, Trash2, ArrowRight, AlertTriangle, Package } from "lucide-react";

interface SavedOrdersModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SavedOrdersModal({ open, onOpenChange }: SavedOrdersModalProps) {
    const { draftOrders, resumeOrder, deleteDraftOrder } = usePOSStore();
    const { branchId } = useAuthStore();
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    if (!open) return null;

    // Filter drafts by branch
    const filteredDrafts = draftOrders.filter(d => {
        if (d.branchId && branchId) {
            return d.branchId === branchId;
        }
        return true;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const handleResume = (id: string) => {
        resumeOrder(id);
        onOpenChange(false);
    };

    const handleDeleteClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteConfirm(id);
    };

    const confirmDelete = () => {
        if (deleteConfirm) {
            deleteDraftOrder(deleteConfirm, 'Xóa thủ công từ danh sách đơn lưu');
            setDeleteConfirm(null);
        }
    };

    const draftToDelete = deleteConfirm ? filteredDrafts.find(d => d.id === deleteConfirm) : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 md:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-orange-50 to-amber-50">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                            <Clock className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div>
                            <h2 className="text-base md:text-xl font-bold text-gray-900">Đơn hàng đang treo</h2>
                            <p className="text-xs md:text-sm text-gray-500">{filteredDrafts.length} đơn hàng chưa thanh toán</p>
                        </div>
                    </div>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-3 md:p-4">
                    {filteredDrafts.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FileText className="w-8 h-8 opacity-50" />
                            </div>
                            <p className="font-medium">Không có đơn hàng nào đang treo</p>
                            <p className="text-sm mt-1">Đơn đã lưu sẽ xuất hiện ở đây</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                            {filteredDrafts.map((draft) => (
                                <div
                                    key={draft.id}
                                    onClick={() => handleResume(draft.id)}
                                    className="group relative bg-white border border-gray-200 rounded-xl p-3 md:p-4 hover:border-orange-300 hover:shadow-md hover:bg-orange-50/30 cursor-pointer transition-all"
                                >
                                    {/* Header with time and amount */}
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2 text-xs md:text-sm text-gray-500">
                                            <Clock className="w-3 h-3 md:w-4 md:h-4" />
                                            <span>{new Date(draft.timestamp).toLocaleString('vi-VN')}</span>
                                        </div>
                                        <span className="font-bold text-base md:text-lg text-orange-600">
                                            {formatVND(draft.order.total_amount || 0)}
                                        </span>
                                    </div>

                                    {/* Customer */}
                                    <div className="flex items-center gap-2 mb-2 md:mb-3">
                                        <User className="w-4 h-4 text-gray-400" />
                                        <span className="font-medium text-gray-900 text-sm md:text-base">
                                            {draft.customer ? draft.customer.name : 'Khách lẻ'}
                                        </span>
                                    </div>

                                    {/* Note */}
                                    {draft.note && (
                                        <div className="bg-gray-50 text-gray-600 text-xs md:text-sm p-2 rounded-lg mb-2 md:mb-3 italic line-clamp-1">
                                            "{draft.note}"
                                        </div>
                                    )}

                                    {/* Products */}
                                    <div className="flex items-center gap-2 text-xs md:text-sm text-gray-500 mb-2 md:mb-3">
                                        <Package className="w-3 h-3 md:w-4 md:h-4" />
                                        <span className="truncate">
                                            {draft.items.length} sản phẩm: {draft.items.map(i => i.product?.name || 'SP').join(', ').slice(0, 40)}...
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-between mt-3 md:mt-4 pt-2 md:pt-3 border-t border-gray-100">
                                        <button
                                            onClick={(e) => handleDeleteClick(draft.id, e)}
                                            className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors z-10 text-xs md:text-sm font-medium"
                                            title="Xóa đơn hàng"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            <span className="hidden md:inline">Xóa</span>
                                        </button>

                                        <span className="flex items-center gap-1 text-orange-600 text-xs md:text-sm font-semibold group-hover:gap-2 transition-all">
                                            Tiếp tục <ArrowRight className="w-4 h-4" />
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 md:p-4 border-t border-gray-100 bg-gray-50">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="w-full py-2.5 md:py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm md:text-base"
                    >
                        Đóng
                    </button>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && draftToDelete && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-150"
                    onClick={() => setDeleteConfirm(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Icon & Header */}
                        <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 text-center">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                <AlertTriangle className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Xác nhận xóa đơn?</h3>
                            <p className="text-red-100 text-sm mt-1">Hành động này không thể hoàn tác</p>
                        </div>

                        {/* Content */}
                        <div className="p-4 md:p-6">
                            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-gray-600">Khách hàng:</span>
                                    <span className="font-semibold text-gray-900">
                                        {draftToDelete.customer?.name || 'Khách lẻ'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-gray-600">Số sản phẩm:</span>
                                    <span className="font-semibold text-gray-900">{draftToDelete.items.length}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Giá trị đơn:</span>
                                    <span className="font-bold text-red-600 text-lg">
                                        {formatVND(draftToDelete.order.total_amount || 0)}
                                    </span>
                                </div>
                            </div>

                            {/* Products List */}
                            {draftToDelete.items.length > 0 && (
                                <div className="mb-4">
                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Sản phẩm trong đơn:</p>
                                    <div className="max-h-32 overflow-y-auto bg-gray-50 rounded-lg p-2 space-y-1">
                                        {draftToDelete.items.slice(0, 5).map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-sm">
                                                <span className="text-gray-700 truncate flex-1">{item.product?.name || 'Sản phẩm'}</span>
                                                <span className="text-gray-500 ml-2">x{item.quantity}</span>
                                            </div>
                                        ))}
                                        {draftToDelete.items.length > 5 && (
                                            <p className="text-xs text-gray-400 text-center pt-1">
                                                +{draftToDelete.items.length - 5} sản phẩm khác...
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="px-4 md:px-6 pb-4 md:pb-6 flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-red-200"
                            >
                                Xóa đơn
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
