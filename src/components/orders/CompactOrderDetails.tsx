import { formatVND } from '@/lib/cashReconciliation';
import type { Order } from '@/types';
import { ProductLink } from '@/components/products/ProductLink';

interface CompactOrderDetailsProps {
    order: Order;
    onClose?: () => void;
    onEdit?: () => void;
    onReturn?: () => void;
    onPrint?: () => void;
    onPrintShippingLabel?: (order: Order) => void;
}

export function CompactOrderDetails({ order, onClose, onEdit, onReturn, onPrint, onPrintShippingLabel }: CompactOrderDetailsProps) {
    return (
        <div className="bg-gray-50/50 p-6 border-t border-b border-gray-100 shadow-inner">
            {/* Header Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
                {/* Column 1: Order Info */}
                <div className="space-y-3">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <span className="w-1 h-4 bg-green-500 rounded-full"></span>
                        Thông tin đơn hàng
                    </h3>
                    <div className="grid grid-cols-[100px_1fr] text-sm gap-y-1">
                        <span className="text-gray-500">Mã đơn hàng:</span>
                        <span className="font-medium text-gray-900">{order.order_number}</span>

                        <span className="text-gray-500">Ngày tạo:</span>
                        <span className="font-medium text-gray-900">{new Date(order.created_at).toLocaleString('vi-VN')}</span>

                        <span className="text-gray-500">Nguồn:</span>
                        <span className="font-medium capitalize text-gray-900">{order.source || 'POS'}</span>

                        <span className="text-gray-500">Người bán:</span>
                        <span className="font-medium text-gray-900">{order.seller_name || 'Admin'}</span>
                    </div>
                </div>

                {/* Column 2: Customer Info */}
                <div className="space-y-3">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                        Khách hàng
                    </h3>
                    <div className="text-sm">
                        <div className="font-bold text-gray-900 text-lg mb-1">{order.customer?.name || 'Khách lẻ'}</div>
                        {order.customer?.phone && <div className="text-gray-600 flex items-center gap-2">📞 {order.customer.phone}</div>}
                        {order.delivery_info && (
                            <div className="mt-3 text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                <p className="font-medium text-gray-800 mb-1">📍 Địa chỉ giao hàng:</p>
                                <p>{order.delivery_info.shipping_address}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 3: Notes & Tags */}
                <div className="space-y-3">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                        Ghi chú & Tags
                    </h3>
                    <div className="text-sm space-y-3">
                        <div>
                            <p className="text-gray-500 mb-1 text-xs uppercase">Ghi chú:</p>
                            <p className="italic text-gray-600 bg-white p-2.5 border rounded-lg min-h-[40px] text-xs">
                                {order.notes || 'Đơn hàng chưa có ghi chú'}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-500 mb-1 text-xs uppercase">Tags:</p>
                            <div className="flex flex-wrap gap-1">
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs italic">Chưa có tag</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Items Table - Clean Style */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50/80 text-gray-500 font-medium border-b border-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-center w-12 text-xs uppercase tracking-wider">STT</th>
                            <th className="px-4 py-3 text-center w-16 text-xs uppercase tracking-wider">Ảnh</th>
                            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider">Tên sản phẩm</th>
                            <th className="px-4 py-3 text-center text-xs uppercase tracking-wider">SL</th>
                            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider">Đơn giá</th>
                            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {order.order_items?.map((item, index) => (
                            <tr key={item.id} className="hover:bg-green-50/30 transition-colors">
                                <td className="px-4 py-3 text-center text-gray-400 font-medium">{index + 1}</td>
                                <td className="px-4 py-3 text-center">
                                    <div className="w-10 h-10 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden mx-auto">
                                        {item.product?.image_url ? (
                                            <img src={item.product.image_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xs">IMG</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="text-gray-800 font-medium">{item.product?.name}</div>
                                    <div className="text-xs text-gray-400 mt-0.5">{item.product?.sku}</div>
                                </td>
                                <td className="px-4 py-3 text-center font-semibold text-gray-700">
                                    {item.quantity}
                                    {item.returned_quantity > 0 && <span className="block text-xs text-red-500">(-{item.returned_quantity})</span>}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-600">{formatVND(item.unit_price)}</td>
                                <td className="px-4 py-3 text-right font-bold text-gray-900">{formatVND(item.total_price)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer Summary & Actions */}
            <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
                {/* Empty space or left footer content */}
                <div className="flex-1"></div>

                {/* Right side summary */}
                <div className="w-full lg:w-1/3 bg-white p-5 rounded-xl border border-green-100 shadow-sm space-y-3 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-600">Tổng tiền ({order.order_items?.length} sản phẩm)</span>
                        <span className="font-medium text-gray-900">{formatVND(order.subtotal)}</span>
                    </div>
                    {order.discount_amount > 0 && (
                        <div className="flex justify-between text-orange-600">
                            <span>Chiết khấu</span>
                            <span>-{formatVND(order.discount_amount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-3 border-t border-gray-100">
                        <span className="text-gray-800">Khách phải trả</span>
                        <span className="text-green-600">{formatVND(order.total_amount)}</span>
                    </div>
                </div>
            </div>

            {/* Action Buttons Bar */}
            <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gray-200">
                {onClose && (
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors">
                        Đóng
                    </button>
                )}
                {onEdit && (
                    <button onClick={onEdit} className="px-4 py-2 bg-white border border-green-500 text-green-600 rounded-lg hover:bg-green-50 font-medium text-sm transition-colors cursor-pointer">
                        Sửa đơn hàng
                    </button>
                )}
                {onReturn && order.status === 'completed' && (
                    <button onClick={onReturn} className="px-4 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 font-medium text-sm transition-colors">
                        Trả hàng
                    </button>
                )}
                {onPrint && (
                    <button onClick={onPrint} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm shadow-sm flex items-center gap-2 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        In hóa đơn
                    </button>
                )}
                {onPrintShippingLabel && order.is_delivery && (
                    <button onClick={() => onPrintShippingLabel(order)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm shadow-sm flex items-center gap-2 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 012-2v0m2 0a2 2 0 012 2l0 0m-6 0a2 2 0 012 2h2a2 2 0 012-2m0 0h2a2 2 0 012 2v0m-6 0a2 2 0 012-2h2a2 2 0 012 2v0" />
                        </svg>
                        In vận đơn
                    </button>
                )}
            </div>
        </div>
    );
}
