import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCustomerStore } from '@/stores/customerStore';
import { useOrderStore } from '@/stores/orderStore';
import { useProductStore } from '@/stores/productStore';
import { useShiftStore } from '@/stores/shiftStore';
import { useUserStore } from '@/stores/userStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { formatVND } from '@/lib/cashReconciliation';
import type { Customer } from '@/types';
import { OrderItemsTable } from '@/components/orders/OrderItemsTable';
import { usePrint } from '@/hooks/usePrint';

// =============================================================================
// PORTAL HELPER
// =============================================================================
export const Portal = ({ children }: { children: React.ReactNode }) => {
    return createPortal(children, document.body);
};

// =============================================================================
// ORDER LOOKUP MODAL
// =============================================================================
// =============================================================================
// ORDER LOOKUP MODAL
// =============================================================================
import { OrderDetailsModal } from '@/components/orders/OrderDetailsModal';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';

interface OrderLookupModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function OrderLookupModal({ isOpen, onClose }: OrderLookupModalProps) {
    // USE STORE INSTEAD OF LOCAL STATE
    const { orders: storeOrders, isLoading: storeLoading, loadOrders, processReturn } = useOrderStore();
    // Local filter state
    const [filteredOrders, setFilteredOrders] = useState<any[]>([]);

    // We keep these for UI state
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [search, setSearch] = useState('');
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [returnOrder, setReturnOrder] = useState<any | null>(null);
    const [returnItems, setReturnItems] = useState<{ [key: string]: number }>({});
    const [returnNote, setReturnNote] = useState('');

    // Print hook for reprinting receipts
    const { printSalesReceipt } = usePrint();

    useEffect(() => {
        if (isOpen) {
            loadOrders();
        }
    }, [isOpen, loadOrders]);

    // Local filtering
    useEffect(() => {
        if (!search) {
            setFilteredOrders(storeOrders);
        } else {
            const lower = search.toLowerCase();
            setFilteredOrders(storeOrders.filter(o =>
                o.order_number.toLowerCase().includes(lower) ||
                o.customer?.name?.toLowerCase().includes(lower)
            ));
        }
    }, [search, storeOrders]);

    // Helper to refresh
    const handleRefresh = () => loadOrders();

    // Handle return order
    const handleStartReturn = (order: any) => {
        setReturnOrder(order);
        // Initialize return items with 0
        const items: { [key: string]: number } = {};
        order.order_items?.forEach((item: any) => {
            items[item.id] = 0;
        });
        setReturnItems(items);
        setReturnNote('');
        setShowReturnModal(true);
        setSelectedOrder(null);
    };

    const handleConfirmReturn = async () => {
        if (!returnOrder) return;

        const itemsToReturn = Object.entries(returnItems)
            .filter(([_, qty]) => qty > 0)
            .map(([itemId, qty]) => ({ itemId, quantity: qty }));

        if (itemsToReturn.length === 0) {
            alert('Vui lòng chọn ít nhất 1 sản phẩm để trả!');
            return;
        }

        const success = await processReturn(returnOrder, itemsToReturn, returnNote || 'Khách trả hàng (POS)');

        if (success) {
            // alert('✅ Đã thực hiện trả hàng thành công!');
            setShowReturnModal(false);
            setReturnOrder(null);
        } else {
            alert('❌ Có lỗi xảy ra khi trả hàng.');
        }
    };


    if (!isOpen) return null;

    return (
        <>
            <Portal>
                <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <header className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">📄 Tra cứu đơn hàng</h2>
                                <p className="text-xs text-gray-500">{storeOrders.length} đơn hàng • Mới nhất → Cũ nhất</p>
                            </div>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                        </header>

                        <div className="p-4 border-b bg-white shrink-0">
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleRefresh()}
                                        placeholder="Nhập mã đơn hàng..."
                                        className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                                        autoFocus
                                    />
                                </div>
                                <button
                                    onClick={handleRefresh}
                                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-medium hover:bg-blue-100 whitespace-nowrap"
                                >
                                    🔄 Làm mới
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
                            {storeLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                                    <span className="ml-3 text-gray-500">Đang tải...</span>
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm overflow-x-auto">
                                    <table className="w-full min-w-[700px]">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã đơn</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày tạo</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Khách hàng</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tổng tiền</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredOrders.map((order) => (
                                                <tr key={order.id} className="hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => setSelectedOrder(order)}>
                                                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{order.order_number}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        {new Date(order.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                        <div className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('vi-VN')}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{order.customer?.name || 'Khách lẻ'}</td>
                                                    <td className="px-6 py-4 text-sm font-bold text-blue-600 text-right">{formatVND(order.total_amount)}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <OrderStatusBadge status={order.status} />
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex gap-2 justify-end">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                                                                className="text-blue-600 hover:text-blue-800 text-sm font-medium bg-blue-50 px-3 py-1 rounded-lg"
                                                            >
                                                                Chi tiết
                                                            </button>
                                                            {order.status === 'completed' && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); printSalesReceipt(order); }}
                                                                    className="text-gray-600 hover:text-gray-800 text-sm font-medium bg-gray-100 px-3 py-1 rounded-lg"
                                                                    title="In lại hóa đơn"
                                                                >
                                                                    🖨️
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredOrders.length === 0 && !storeLoading && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">
                                                        Không tìm thấy đơn hàng nào.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Details Modal overlay */}
                    {selectedOrder && (
                        <div className="absolute inset-0 z-[10000]">
                            <OrderDetailsModal
                                order={selectedOrder}
                                onClose={() => setSelectedOrder(null)}
                                onReturn={() => handleStartReturn(selectedOrder)}
                            />
                        </div>
                    )}

                </div>
            </Portal>

            {/* Return Modal - Enhanced with Checkboxes */}
            {showReturnModal && returnOrder && (
                <Portal>
                    <div className="fixed inset-0 z-[10001] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl animate-in zoom-in-95 duration-200">
                            <header className="px-6 py-4 border-b bg-gradient-to-r from-green-50 to-green-100 flex justify-between items-center rounded-t-2xl">
                                <h2 className="text-lg font-bold text-green-700">↩️ Trả hàng đơn #{returnOrder.order_number}</h2>
                                <button onClick={() => setShowReturnModal(false)} className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 text-lg">×</button>
                            </header>

                            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                                <p className="text-sm text-gray-600 font-medium">Chọn sản phẩm trả lại:</p>

                                {/* Table Header with Select All */}
                                <div className="bg-gray-100 rounded-lg p-3 flex items-center gap-4 text-sm font-medium text-gray-700">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={returnOrder.order_items?.every((item: any) => (returnItems[item.id] || 0) > 0)}
                                            onChange={(e) => {
                                                const newItems: { [key: string]: number } = {};
                                                returnOrder.order_items?.forEach((item: any) => {
                                                    newItems[item.id] = e.target.checked ? item.quantity : 0;
                                                });
                                                setReturnItems(newItems);
                                            }}
                                            className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                                        />
                                        <span>Chọn tất cả</span>
                                    </label>
                                </div>

                                <div className="space-y-2">
                                    {returnOrder.order_items?.map((item: any) => {
                                        const isChecked = (returnItems[item.id] || 0) > 0;
                                        return (
                                            <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isChecked ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                                                {/* Checkbox */}
                                                <label className="flex items-center cursor-pointer shrink-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            // When checked, auto-fill with purchased quantity
                                                            // When unchecked, set to 0
                                                            setReturnItems(prev => ({
                                                                ...prev,
                                                                [item.id]: e.target.checked ? item.quantity : 0
                                                            }));
                                                        }}
                                                        className="w-5 h-5 rounded text-green-600 focus:ring-green-500"
                                                    />
                                                </label>

                                                {/* Product Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900 truncate">{item.product?.name || 'Sản phẩm'}</p>
                                                    <p className="text-xs text-gray-500">Đã mua: {item.quantity} • {formatVND(item.unit_price)}/sp</p>
                                                </div>

                                                {/* Quantity Controls - Only show when checked */}
                                                {isChecked && (
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                            onClick={() => setReturnItems(prev => ({
                                                                ...prev,
                                                                [item.id]: Math.max(1, (prev[item.id] || 0) - 1)
                                                            }))}
                                                            className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold text-gray-700"
                                                        >
                                                            −
                                                        </button>
                                                        <span className="w-8 text-center font-bold text-lg text-green-600">{returnItems[item.id] || 0}</span>
                                                        <button
                                                            onClick={() => setReturnItems(prev => ({
                                                                ...prev,
                                                                [item.id]: Math.min(item.quantity, (prev[item.id] || 0) + 1)
                                                            }))}
                                                            className="w-8 h-8 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center font-bold"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Refund Amount */}
                                                {isChecked && (
                                                    <div className="shrink-0 text-right">
                                                        <div className="font-bold text-green-600">
                                                            {formatVND((returnItems[item.id] || 0) * item.unit_price)}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Lý do trả hàng</label>
                                    <textarea
                                        value={returnNote}
                                        onChange={(e) => setReturnNote(e.target.value)}
                                        placeholder="VD: Khách đổi ý, sản phẩm lỗi..."
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        rows={2}
                                    />
                                </div>

                                {/* Return Total */}
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-green-700 font-medium">Tổng tiền hoàn:</span>
                                        <span className="text-2xl font-bold text-green-600">
                                            {formatVND(
                                                returnOrder.order_items?.reduce((sum: number, item: any) => {
                                                    const qty = returnItems[item.id] || 0;
                                                    return sum + qty * item.unit_price;
                                                }, 0) || 0
                                            )}
                                        </span>
                                    </div>
                                    <p className="text-xs text-green-500 mt-1">Hệ thống sẽ cộng lại kho và trừ doanh thu cho các sản phẩm được trả.</p>
                                </div>
                            </div>

                            <footer className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center rounded-b-2xl">
                                <span className="text-sm text-gray-500">
                                    {Object.values(returnItems).filter(q => q > 0).length} sản phẩm được chọn
                                </span>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowReturnModal(false)}
                                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        onClick={handleConfirmReturn}
                                        disabled={Object.values(returnItems).every(q => q === 0)}
                                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        ✓ Xác nhận trả hàng
                                    </button>
                                </div>
                            </footer>
                        </div>
                    </div>
                </Portal>
            )}
        </>
    );
}

// =============================================================================
// CUSTOMER LOOKUP MODAL
// =============================================================================
interface CustomerLookupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect?: (customer: Customer) => void;
}

export function CustomerLookupModal({ isOpen, onClose, onSelect }: CustomerLookupModalProps) {
    const { customers, loadCustomers } = useCustomerStore();
    const { hasPermission } = useUserStore();
    const { user: authUser } = useAuthStore();
    const [search, setSearch] = useState('');
    const [filtered, setFiltered] = useState<Customer[]>([]);

    // Check if user can view points - admin always can, others need permission
    const canViewPoints = authUser?.role === 'admin' || hasPermission(authUser as any, 'customer_view_points');

    useEffect(() => {
        if (isOpen) {
            loadCustomers();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!search) {
            setFiltered(customers);
        } else {
            const lower = search.toLowerCase();
            setFiltered(customers.filter(c =>
                c.name.toLowerCase().includes(lower) ||
                c.phone?.includes(lower) ||
                c.code?.toLowerCase().includes(lower)
            ));
        }
    }, [search, customers]);

    if (!isOpen) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                        <h2 className="text-xl font-bold text-gray-800">👥 Tra cứu khách hàng</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
                    </div>

                    <div className="p-4 border-b">
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Tìm tên, số điện thoại, mã KH..."
                                className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-0">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Mã KH</th>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Tên</th>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">SĐT</th>
                                    {canViewPoints && (
                                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase text-right">Điểm</th>
                                    )}
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase text-right">Nợ</th>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase text-right">Tổng mua</th>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.map((c) => (
                                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-gray-500 text-sm">{c.code || '--'}</td>
                                        <td className="px-6 py-4 font-medium text-gray-900">{c.name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{c.phone}</td>
                                        {canViewPoints && (
                                            <td className="px-6 py-4 text-right font-bold text-amber-500">{c.points_balance}</td>
                                        )}
                                        <td className="px-6 py-4 text-right font-bold text-red-500">{formatVND(c.debt_balance)}</td>
                                        <td className="px-6 py-4 text-right text-gray-700">{formatVND(c.total_spent)}</td>
                                        <td className="px-6 py-4 text-right">
                                            {onSelect && (
                                                <button
                                                    onClick={() => { onSelect(c); onClose(); }}
                                                    className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-200"
                                                >
                                                    Chọn
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                                            Không tìm thấy khách hàng
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
