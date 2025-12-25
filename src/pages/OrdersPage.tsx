import { useState, useEffect } from 'react';
import { useOrderStore } from '@/stores/orderStore';
import { formatVND } from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';
import type { Order, OrderItem, OrderStatus } from '@/types';
import { ProductLink } from '@/components/products/ProductLink';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { OrderDetailsModal } from '@/components/orders/OrderDetailsModal';
import { Pagination } from '@/components/common/Pagination';

// ... imports
import { usePrint } from '@/hooks/usePrint';
import { useSettingsStore } from '@/stores/settingsStore';
import { generateShippingLabelHTML } from '@/utils/shippingLabelGenerator';
import { printViaDriver } from '@/lib/printService';
import { DEFAULT_SHIPPING_LABEL_CONFIG, type ShippingLabelConfig as TemplateConfig } from '@/components/print/ShippingLabelTemplate';

import { OrderStats } from '@/components/orders/OrderStats';
import { CompactOrderDetails } from '@/components/orders/CompactOrderDetails';
import { ChevronRight, ChevronDown } from 'lucide-react';

export function OrdersPage() {
    const { orders, isLoading, loadOrders, processReturn, updateOrder, finalizeDeliveryOrder } = useOrderStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeStatus, setActiveStatus] = useState<OrderStatus | 'all'>('all');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [returnOrder, setReturnOrder] = useState<Order | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const { printReturnReceipt, printSalesReceipt } = usePrint();
    const { printSettings, shippingLabelConfig } = useSettingsStore();

    // Sync selectedOrder with orders list to ensure UI updates when status changes
    useEffect(() => {
        if (selectedOrder) {
            const updatedOrder = orders.find(o => o.id === selectedOrder.id);
            if (updatedOrder && updatedOrder !== selectedOrder) {
                setSelectedOrder(updatedOrder);
            }
        }
    }, [orders, selectedOrder]);

    const handlePrintShippingLabel = (order: Order) => {
        const senderInfo = {
            name: printSettings?.storeName || 'Cửa hàng',
            phone: printSettings?.storePhone || '0123456789',
            address: printSettings?.storeAddress || 'Địa chỉ cửa hàng'
        };

        const storeConfig = shippingLabelConfig; // Config from settings store

        // Map store config to template config
        const templateConfig: TemplateConfig = {
            carrier: 'generic', // Default value
            showSender: storeConfig?.showSender ?? true,
            showReceiver: storeConfig?.showRecipient ?? true,
            showItems: storeConfig?.showItems ?? true,
            showCOD: storeConfig?.showCod ?? true,
            showWeight: true,
            showNote: storeConfig?.showNote ?? true,
            paperSize: 'A6',
        };

        // If store config has compatible paper size, use it
        if (storeConfig?.paperSize === '100x150') templateConfig.paperSize = '10x15';

        const html = generateShippingLabelHTML(
            {
                order,
                trackingNumber: `${templateConfig.carrier}-${order.order_number}`,
                weight: 500, // Placeholder weight
                carrier: templateConfig.carrier,
                senderInfo
            },
            templateConfig
        );
        printViaDriver(html);
    };

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    const filteredOrders = orders.filter(o =>
        (activeStatus === 'all' || o.status === activeStatus) &&
        (o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.customer?.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const paginatedOrders = filteredOrders.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    const handleReturn = async (items: { itemId: string; quantity: number }[], reason: string) => {
        if (!returnOrder) return;
        const success = await processReturn(returnOrder, items, reason);
        if (success) {
            alert('Đã tạo đơn trả hàng thành công!');
            setReturnOrder(null);
            // Dont close selected order if open
        } else {
            alert('Có lỗi xảy ra khi trả hàng.');
        }
    };

    const toggleExpand = (orderId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setExpandedOrderId(prev => prev === orderId ? null : orderId);
    };

    const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
        if (!confirm('Bạn có chắc chắn muốn cập nhật trạng thái đơn hàng?')) return;
        await updateOrder(orderId, { status: newStatus });
    };

    const handleFinalize = async (orderId: string) => {
        if (!confirm('Xác nhận hoàn tất đơn hàng? Hành động này sẽ xuất kho và ghi nhận doanh thu.')) return;
        const success = await finalizeDeliveryOrder(orderId);
        if (success) alert('Đã hoàn tất đơn hàng thành công!');
    };

    const tabs = [
        { id: 'all', label: 'Tất cả' },
        { id: 'pending_approval', label: 'Chờ duyệt' },
        { id: 'approved', label: 'Đã duyệt' },
        { id: 'packing', label: 'Đang đóng gói' },
        { id: 'packed', label: 'Đã đóng gói' },
        { id: 'shipping', label: 'Đang giao' },
        { id: 'completed', label: 'Hoàn thành' },
        { id: 'cancelled', label: 'Đã hủy' },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="container-app py-5">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-teal-600">Quản lý đơn hàng</h1>
                            <p className="text-sm text-gray-500 mt-1">Theo dõi và xử lý các đơn hàng từ mọi kênh bán</p>
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                            <button
                                onClick={() => loadOrders()}
                                className="px-4 py-2 bg-white border border-gray-200 hover:bg-green-50 hover:border-green-200 hover:text-green-700 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center gap-2"
                            >
                                🔄 Làm mới
                            </button>
                            <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium shadow-md transition-all flex items-center gap-2">
                                + Tạo đơn hàng
                            </button>
                        </div>
                    </div>

                    {/* Dashboard Stats */}
                    {!isLoading && (
                        <div className="mb-6">
                            <OrderStats orders={orders} />
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-4 justify-between items-end">
                        {/* Status Tabs */}
                        <div className="flex-1 w-full overflow-x-auto pb-1 scrollbar-hide">
                            <div className="flex gap-2">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => { setActiveStatus(tab.id as any); setCurrentPage(1); }}
                                        className={cn(
                                            "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border",
                                            activeStatus === tab.id
                                                ? "bg-green-600 text-white border-green-600 shadow-md transform scale-105"
                                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Search & Filter */}
                        <div className="relative w-full md:w-80">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                            <input
                                type="text"
                                placeholder="Tìm theo mã đơn, SĐT..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-12 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 bg-white shadow-sm transition-all"
                            />
                            {/* Barcode scan button */}
                            <button
                                type="button"
                                onClick={() => alert('Quét mã vạch - Chức năng đang phát triển')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Quét mã vạch"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container-app py-6">
                {isLoading ? <div className="text-center py-12">Đang tải...</div> : (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <table className="w-full">
                            <thead className="bg-green-50 border-b border-green-100">
                                <tr>
                                    <th className="w-10 px-3 py-3"></th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-green-700 uppercase">Mã đơn hàng</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-green-700 uppercase">Ngày tạo</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-green-700 uppercase">Tên khách hàng</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-green-700 uppercase">Trạng thái đơn hàng</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-green-700 uppercase">Thanh toán</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-green-700 uppercase">Khách phải trả</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-green-700 uppercase">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {paginatedOrders.map((order) => {
                                    const isExpanded = expandedOrderId === order.id;
                                    return (
                                        <>
                                            <tr key={order.id} className={cn("hover:bg-green-50/30 transition-colors cursor-pointer", isExpanded ? "bg-green-50/50" : "")} onClick={() => toggleExpand(order.id)}>
                                                <td className="px-3 py-4 text-center">
                                                    <button onClick={(e) => toggleExpand(order.id, e)} className="p-1 hover:bg-green-200 rounded text-gray-400 hover:text-green-600">
                                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-green-700 hover:underline" onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}>{order.order_number}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString('vi-VN')} {new Date(order.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</td>
                                                <td className="px-6 py-4 text-sm text-gray-900 font-medium">{order.customer?.name || 'Khách lẻ'}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <OrderStatusBadge status={order.status} />
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {/* Payment Status Dot */}
                                                    <div className="flex justify-center">
                                                        {order.payment_status === 'paid' && (
                                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                                                Đã thanh toán
                                                            </span>
                                                        )}
                                                        {order.payment_status === 'partially_paid' && (
                                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                                                                Thanh toán 1 phần
                                                            </span>
                                                        )}
                                                        {order.payment_status !== 'paid' && order.payment_status !== 'partially_paid' && (
                                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                                                Chưa thanh toán
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">{formatVND(order.total_amount)}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3">Chi tiết</button>

                                                    {/* Actions based on Status */}
                                                    {order.status === 'pending_approval' && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order.id, 'approved'); }} className="text-green-600 hover:text-green-800 text-sm font-medium">Duyệt</button>
                                                    )}
                                                    {order.status === 'approved' && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order.id, 'packing'); }} className="text-orange-600 hover:text-orange-800 text-sm font-medium">Đóng gói</button>
                                                    )}
                                                    {order.status === 'packing' && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order.id, 'packed'); }} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Xong</button>
                                                    )}
                                                    {order.status === 'packed' && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order.id, 'shipping'); }} className="text-purple-600 hover:text-purple-800 text-sm font-medium">Giao hàng</button>
                                                    )}
                                                    {order.status === 'shipping' && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleFinalize(order.id); }} className="text-green-600 hover:text-green-800 text-sm font-bold bg-green-50 px-2 py-1 rounded">Hoàn tất</button>
                                                    )}
                                                </td>
                                            </tr >
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={8} className="p-0 border-b border-gray-100">
                                                        <CompactOrderDetails
                                                            order={order}
                                                            onClose={() => setExpandedOrderId(null)}
                                                            onEdit={() => { setSelectedOrder(order); }}
                                                            onReturn={() => setReturnOrder(order)}
                                                            onPrint={() => printSalesReceipt(order, 'Admin')}
                                                            onPrintShippingLabel={handlePrintShippingLabel}
                                                        />
                                                    </td>
                                                </tr>
                                            )
                                            }
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                        {paginatedOrders.length === 0 && <div className="text-center py-12 text-gray-500">Không tìm thấy đơn hàng nào.</div>}
                        {/* Pagination */}
                        <div className="border-t px-4">
                            <Pagination
                                currentPage={currentPage}
                                totalItems={filteredOrders.length}
                                pageSize={pageSize}
                                onPageChange={setCurrentPage}
                                onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                            />
                        </div>
                    </div>
                )
                }
            </main >

            {selectedOrder && (
                <OrderDetailsModal
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    onReturn={() => { setReturnOrder(selectedOrder); setSelectedOrder(null); }}
                    onPrintShippingLabel={handlePrintShippingLabel}
                />
            )}

            {
                returnOrder && (
                    <ReturnOrderModal
                        order={returnOrder}
                        onClose={() => setReturnOrder(null)}
                        onConfirm={handleReturn}
                    />
                )
            }
        </div >
    );
}




function ReturnOrderModal({ order, onClose, onConfirm }: { order: Order; onClose: () => void; onConfirm: (items: any[], reason: string) => void }) {
    const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
    const [reason, setReason] = useState('Khách đổi ý');
    const [customReason, setCustomReason] = useState('');

    const reasons = ['Sản phẩm lỗi', 'Hư hỏng vận chuyển', 'Khách đổi ý', 'Giao sai hàng', 'Khác'];

    const handleToggleItem = (itemId: string, maxQty: number) => {
        if (selectedItems[itemId]) {
            const newItems = { ...selectedItems };
            delete newItems[itemId];
            setSelectedItems(newItems);
        } else {
            setSelectedItems({ ...selectedItems, [itemId]: maxQty }); // Default select max
        }
    };

    const handleQtyChange = (itemId: string, val: number, max: number) => {
        if (val < 0) val = 0;
        if (val > max) val = max;
        setSelectedItems({ ...selectedItems, [itemId]: val });
    };

    const totalRefund = order.order_items?.reduce((sum: number, item: any) => {
        const qty = selectedItems[item.id] || 0;
        return sum + (qty * item.unit_price);
    }, 0) || 0;

    const handleSubmit = () => {
        const items = Object.entries(selectedItems).map(([id, qty]) => ({ itemId: id, quantity: qty }));
        if (items.length === 0) {
            alert('Vui lòng chọn sản phẩm cần trả');
            return;
        }
        const finalReason = reason === 'Khác' ? customReason : reason;
        onConfirm(items, finalReason);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-[90vw] md:w-[600px] transition-all duration-200">
                <div className="p-6 border-b">
                    <h2 className="text-lg font-bold">Trả hàng đơn #{order.order_number}</h2>
                </div>

                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">Lý do trả hàng</label>
                        <div className="flex gap-2 flex-wrap">
                            {reasons.map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setReason(r)}
                                    className={cn('px-3 py-1 rounded-full text-xs font-medium border', reason === r ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-600')}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                        {reason === 'Khác' && (
                            <textarea
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                placeholder="Nhập lý do chi tiết..."
                                className="w-full p-2 border rounded-lg text-sm"
                            />
                        )}
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-700">Chọn sản phẩm trả lại</label>
                            {/* Select All Checkbox */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="selectAll"
                                    checked={(() => {
                                        const availableItems = order.order_items?.filter((item: any) => (item.quantity - (item.returned_quantity || 0)) > 0) || [];
                                        return availableItems.length > 0 && availableItems.every((item: any) => !!selectedItems[item.id]);
                                    })()}
                                    onChange={() => {
                                        const availableItems = order.order_items?.filter((item: any) => (item.quantity - (item.returned_quantity || 0)) > 0) || [];
                                        const isAllSelected = availableItems.length > 0 && availableItems.every((item: any) => !!selectedItems[item.id]);

                                        if (isAllSelected) {
                                            setSelectedItems({});
                                        } else {
                                            const newSelected: Record<string, number> = {};
                                            availableItems.forEach((item: any) => {
                                                const maxReturn = item.quantity - (item.returned_quantity || 0);
                                                newSelected[item.id] = maxReturn;
                                            });
                                            setSelectedItems(newSelected);
                                        }
                                    }}
                                    className="w-4 h-4 rounded text-green-600 cursor-pointer"
                                />
                                <label htmlFor="selectAll" className="text-xs text-gray-500 cursor-pointer select-none">Tất cả</label>
                            </div>
                        </div>
                        <div className="space-y-1">
                            {order.order_items?.map((item: any) => {
                                const maxReturn = item.quantity - (item.returned_quantity || 0);
                                if (maxReturn <= 0) return null; // Fully returned already

                                const isSelected = !!selectedItems[item.id];
                                return (
                                    <div key={item.id} className={cn("flex items-center gap-3 p-2 border rounded-lg transition-colors bg-white hover:bg-gray-50", isSelected ? 'border-green-400 bg-green-50/50' : 'border-gray-100')}>
                                        <input type="checkbox" checked={isSelected} onChange={() => handleToggleItem(item.id, maxReturn)} className="w-4 h-4 rounded text-green-600 flex-shrink-0" />

                                        {/* Product Image */}
                                        <div className="w-10 h-10 rounded border bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                            {item.product?.image_url ? (
                                                <img src={item.product.image_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-xs">📦</span>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium truncate">{item.product?.name}</div>
                                            <div className="text-xs text-gray-500">
                                                {formatVND(item.unit_price)} × {maxReturn} <span className="text-gray-400">(đã mua: {item.quantity})</span>
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleQtyChange(item.id, (selectedItems[item.id] || 0) - 1, maxReturn)}
                                                    className="w-8 h-8 rounded border bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 font-bold"
                                                >
                                                    -
                                                </button>
                                                <input
                                                    type="number"
                                                    value={selectedItems[item.id]}
                                                    onChange={(e) => handleQtyChange(item.id, parseFloat(e.target.value), maxReturn)}
                                                    className="w-12 py-1 text-center border-y border-gray-200 text-sm font-bold focus:outline-none"
                                                    min={1} max={maxReturn}
                                                />
                                                <button
                                                    onClick={() => handleQtyChange(item.id, (selectedItems[item.id] || 0) + 1, maxReturn)}
                                                    className="w-8 h-8 rounded border bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-green-600 font-bold"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
                    <div className="text-sm">
                        <span className="text-gray-500">Hoàn tiền:</span>
                        <span className="ml-2 font-bold text-lg text-green-600">{formatVND(totalRefund)}</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-white text-sm">Hủy</button>
                        <button onClick={handleSubmit} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm">Xác nhận trả</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default OrdersPage;
