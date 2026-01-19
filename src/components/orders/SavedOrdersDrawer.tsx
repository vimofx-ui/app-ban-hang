import React, { useState, useRef, useEffect } from 'react';
import { usePOSStore } from "@/stores/posStore";
import { useAuthStore } from "@/stores/authStore";
import { formatVND } from "@/lib/cashReconciliation";
import { Clock, User, Trash2, ArrowRight, Package, ChevronLeft, AlertTriangle, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DraftOrder } from "@/stores/posStore";

interface SavedOrdersDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SavedOrdersDrawer({ open, onOpenChange }: SavedOrdersDrawerProps) {
    const { draftOrders, resumeOrder, deleteDraftOrder } = usePOSStore();
    const { branchId } = useAuthStore();

    const [selectedDraft, setSelectedDraft] = useState<DraftOrder | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const lastClickTimeRef = useRef<number>(0);
    const lastClickIdRef = useRef<string | null>(null);

    // Reset selected draft when drawer closes
    useEffect(() => {
        if (!open) {
            setSelectedDraft(null);
            setDeleteConfirmId(null);
        }
    }, [open]);

    if (!open) return null;

    // Filter drafts by branch
    const filteredDrafts = draftOrders.filter(d => {
        if (d.branchId && branchId) {
            return d.branchId === branchId;
        }
        return true;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Handle single/double click với logic đơn giản hơn
    const handleDraftClick = (draft: DraftOrder) => {
        const now = Date.now();
        const timeDiff = now - lastClickTimeRef.current;
        const sameId = lastClickIdRef.current === draft.id;

        // Double click detection: same item within 300ms
        if (sameId && timeDiff < 300) {
            // Double click - directly resume
            handleResume(draft.id);
            lastClickTimeRef.current = 0;
            lastClickIdRef.current = null;
        } else {
            // Single click - show detail
            setSelectedDraft(draft);
            lastClickTimeRef.current = now;
            lastClickIdRef.current = draft.id;
        }
    };

    const handleResume = (id: string) => {
        resumeOrder(id);
        onOpenChange(false);
    };

    const handleDeleteClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setDeleteConfirmId(id);
    };

    const confirmDelete = () => {
        if (deleteConfirmId) {
            deleteDraftOrder(deleteConfirmId, 'Xóa thủ công từ danh sách đơn chờ');
            if (selectedDraft?.id === deleteConfirmId) {
                setSelectedDraft(null);
            }
            setDeleteConfirmId(null);
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        // Only close if clicking directly on backdrop, not on children
        if (e.target === e.currentTarget) {
            onOpenChange(false);
        }
    };

    const handleDrawerClick = (e: React.MouseEvent) => {
        // Stop propagation to prevent backdrop click when clicking on drawer
        e.stopPropagation();
    };

    const handleBackToList = () => {
        setSelectedDraft(null);
    };

    const draftToDelete = deleteConfirmId ? filteredDrafts.find(d => d.id === deleteConfirmId) : null;

    return (
        <>
            {/* Backdrop - positioned below header */}
            <div
                className="fixed inset-x-0 bottom-0 z-40 bg-black/40 animate-in fade-in duration-200"
                style={{ top: '52px' }}
                onClick={handleBackdropClick}
            >
                {/* Drawer Container */}
                <div
                    className={cn(
                        "absolute top-0 left-0 h-full bg-white shadow-2xl flex animate-in slide-in-from-left duration-300 rounded-tr-2xl rounded-br-2xl overflow-hidden",
                        "w-full",
                        selectedDraft
                            ? "max-w-[350px] md:max-w-[750px] lg:max-w-[850px]"
                            : "max-w-[350px] md:max-w-[400px]"
                    )}
                    onClick={handleDrawerClick}
                >

                    {/* Panel Trái - Danh sách đơn chờ */}
                    <div className={cn(
                        "flex flex-col bg-white transition-all duration-300",
                        "w-full",
                        "md:w-[350px] lg:w-[380px]",
                        selectedDraft && "hidden md:flex md:border-r md:border-gray-200"
                    )}>
                        {/* Header - Green theme */}
                        <div className="px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white flex items-center gap-3 shrink-0">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold">Đơn đang chờ</h2>
                                <p className="text-xs text-green-100">{filteredDrafts.length} đơn chưa thanh toán</p>
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gray-50">
                            {filteredDrafts.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <ShoppingCart className="w-14 h-14 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm font-medium">Chưa có đơn chờ</p>
                                    <p className="text-xs mt-1">Đơn được lưu lại sẽ hiển thị ở đây</p>
                                </div>
                            ) : (
                                filteredDrafts.map((draft) => (
                                    <div
                                        key={draft.id}
                                        onClick={() => handleDraftClick(draft)}
                                        className={cn(
                                            "relative rounded-xl p-3 cursor-pointer transition-all border-2 bg-white shadow-sm",
                                            selectedDraft?.id === draft.id
                                                ? "border-green-500 bg-green-50 shadow-md ring-2 ring-green-200"
                                                : "border-gray-100 hover:border-green-300 hover:shadow-md"
                                        )}
                                    >
                                        <div className="flex gap-2">
                                            {/* Delete button - LEFT SIDE */}
                                            <button
                                                onClick={(e) => handleDeleteClick(draft.id, e)}
                                                className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Xóa đơn"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>

                                            {/* Main content */}
                                            <div className="flex-1 min-w-0">
                                                {/* Order ID and Amount */}
                                                <div className="flex justify-between items-start mb-1.5">
                                                    <span className="text-xs font-mono text-green-700 font-bold bg-green-100 px-1.5 py-0.5 rounded">
                                                        #{draft.id.slice(0, 6)}
                                                    </span>
                                                    <span className="font-bold text-orange-600 text-base">
                                                        {formatVND(draft.order.total_amount || 0)}
                                                    </span>
                                                </div>

                                                {/* Customer & Time */}
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                                                    <User className="w-3 h-3" />
                                                    <span className="truncate font-medium">{draft.customer?.name || 'Khách lẻ'}</span>
                                                    <span className="text-gray-300">•</span>
                                                    <span>{new Date(draft.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>

                                                {/* Products summary */}
                                                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                    <Package className="w-3 h-3" />
                                                    <span>{draft.items.length} sản phẩm</span>
                                                </div>

                                                {/* Click hint */}
                                                <div className="text-[9px] text-gray-300 mt-2 italic border-t border-gray-100 pt-1.5">
                                                    1-click: xem chi tiết • 2-click: chọn luôn
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Panel Phải - Chi tiết đơn */}
                    {selectedDraft && (
                        <div className="flex-1 flex flex-col bg-white w-full md:w-[400px] lg:w-[470px] animate-in slide-in-from-right duration-200">
                            {/* Header */}
                            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 flex items-center gap-3 shrink-0">
                                <button
                                    onClick={handleBackToList}
                                    className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 text-lg">Chi tiết đơn</h3>
                                    <p className="text-xs text-gray-500">
                                        <span className="font-mono text-green-600">#{selectedDraft.id.slice(0, 8)}</span>
                                        <span className="mx-1.5">•</span>
                                        {selectedDraft.customer?.name || 'Khách lẻ'}
                                    </p>
                                </div>
                            </div>

                            {/* Products List */}
                            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                    <div className="px-4 py-2.5 bg-green-50 border-b border-green-100 text-xs font-bold text-green-700 uppercase flex justify-between">
                                        <span>Sản phẩm ({selectedDraft.items.length})</span>
                                        <span>Thành tiền</span>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {selectedDraft.items.map((item, idx) => (
                                            <div key={idx} className="px-4 py-3 flex justify-between items-center hover:bg-gray-50 transition-colors">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-gray-900 text-sm truncate">
                                                        {item.product?.name || 'Sản phẩm'}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        {formatVND(item.unit_price)} × {item.quantity}
                                                    </p>
                                                </div>
                                                <span className="font-bold text-gray-900 text-sm ml-3 tabular-nums">
                                                    {formatVND(item.total_price)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Note */}
                                {selectedDraft.note && (
                                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 italic">
                                        <span className="font-medium not-italic">Ghi chú:</span> "{selectedDraft.note}"
                                    </div>
                                )}
                            </div>

                            {/* Footer - Totals & Action */}
                            <div className="p-4 bg-white border-t border-gray-200 shrink-0 shadow-lg shadow-gray-100">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-gray-600 font-medium">Tổng cộng:</span>
                                    <span className="text-2xl font-bold text-green-600">
                                        {formatVND(selectedDraft.order.total_amount || 0)}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleResume(selectedDraft.id)}
                                    className="w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-200 transition-all text-base"
                                >
                                    <ArrowRight className="w-5 h-5" />
                                    Tiếp tục bán hàng
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal - MUCH WIDER */}
            {deleteConfirmId && draftToDelete && (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
                    onClick={() => setDeleteConfirmId(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-[95%] sm:w-[500px] md:w-[600px] min-w-[300px] overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-br from-red-500 to-rose-600 p-6 text-center">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                <AlertTriangle className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Xóa đơn chờ này?</h3>
                            <p className="text-red-100 text-sm mt-1">Hành động này không thể hoàn tác</p>
                        </div>
                        <div className="p-6">
                            <div className="bg-red-50 rounded-xl p-4 mb-6 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Mã đơn:</span>
                                    <span className="font-mono font-bold text-gray-900">#{draftToDelete.id.slice(0, 8)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Khách hàng:</span>
                                    <span className="font-semibold text-gray-900">{draftToDelete.customer?.name || 'Khách lẻ'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Số sản phẩm:</span>
                                    <span className="font-semibold text-gray-900">{draftToDelete.items.length}</span>
                                </div>
                                <div className="flex justify-between text-base pt-3 border-t border-red-200">
                                    <span className="text-gray-700 font-medium">Giá trị đơn:</span>
                                    <span className="font-bold text-red-600 text-xl">{formatVND(draftToDelete.order.total_amount || 0)}</span>
                                </div>
                            </div>

                            {/* Product list in delete confirm */}
                            {draftToDelete.items.length > 0 && (
                                <div className="mb-6 max-h-32 overflow-y-auto bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Sản phẩm trong đơn:</p>
                                    {draftToDelete.items.slice(0, 5).map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-sm py-1">
                                            <span className="text-gray-700 truncate">{item.product?.name || 'SP'}</span>
                                            <span className="text-gray-500 ml-2 shrink-0">×{item.quantity}</span>
                                        </div>
                                    ))}
                                    {draftToDelete.items.length > 5 && (
                                        <p className="text-xs text-gray-400 text-center mt-2">
                                            +{draftToDelete.items.length - 5} sản phẩm khác
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors text-base"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-red-200 text-base"
                                >
                                    Xóa đơn
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
