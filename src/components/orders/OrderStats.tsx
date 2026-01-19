import type { Order } from "@/types";
import { formatVND } from "@/lib/cashReconciliation";

interface OrderStatsProps {
    orders: Order[];
}

export function OrderStats({ orders }: OrderStatsProps) {
    // Calculate stats
    const stats = {
        pending_approval: orders.filter(o => o.status === 'pending_approval').length,

        waiting_payment: {
            count: orders.filter(o => o.payment_status !== 'paid' && o.status !== 'cancelled').length,
            amount: orders.filter(o => o.payment_status !== 'paid' && o.status !== 'cancelled')
                .reduce((sum, o) => sum + (o.remaining_debt ?? o.debt_amount ?? 0), 0)
        },

        waiting_packing: {
            count: orders.filter(o => o.status === 'approved').length,
            amount: orders.filter(o => o.status === 'approved').reduce((sum, o) => sum + o.total_amount, 0)
        },

        waiting_ship: {
            count: orders.filter(o => o.status === 'packing' || o.status === 'packed').length,
            amount: orders.filter(o => o.status === 'packing' || o.status === 'packed').reduce((sum, o) => sum + o.total_amount, 0)
        },

        shipping: {
            count: orders.filter(o => o.status === 'shipping').length,
            amount: orders.filter(o => o.status === 'shipping').reduce((sum, o) => sum + o.total_amount, 0)
        },

        completed_today: {
            count: 0,
        }
    };

    return (
        <>
            {/* Mobile: Horizontal Scroll */}
            <div className="md:hidden overflow-x-auto -mx-4 px-4 pb-2 scrollbar-hide">
                <div className="flex gap-2 min-w-min">
                    <div className="bg-white p-3 rounded-xl border shadow-sm min-w-[100px] flex-shrink-0">
                        <div className="text-gray-500 text-[10px] uppercase font-bold mb-1">Chờ duyệt</div>
                        <div className="text-xl font-bold text-blue-600">{stats.pending_approval}</div>
                        <div className="text-[10px] text-gray-400">đơn hàng</div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border shadow-sm min-w-[100px] flex-shrink-0">
                        <div className="text-gray-500 text-[10px] uppercase font-bold mb-1">Chờ TT</div>
                        <div className="text-xl font-bold text-red-600">{stats.waiting_payment.count}</div>
                        <div className="text-[10px] text-gray-600 font-medium">{formatVND(stats.waiting_payment.amount)}</div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border shadow-sm min-w-[100px] flex-shrink-0">
                        <div className="text-gray-500 text-[10px] uppercase font-bold mb-1">Chờ gói</div>
                        <div className="text-xl font-bold text-orange-600">{stats.waiting_packing.count}</div>
                        <div className="text-[10px] text-gray-600 font-medium">{formatVND(stats.waiting_packing.amount)}</div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border shadow-sm min-w-[100px] flex-shrink-0">
                        <div className="text-gray-500 text-[10px] uppercase font-bold mb-1">Chờ lấy</div>
                        <div className="text-xl font-bold text-yellow-600">{stats.waiting_ship.count}</div>
                        <div className="text-[10px] text-gray-600 font-medium">{formatVND(stats.waiting_ship.amount)}</div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border shadow-sm min-w-[100px] flex-shrink-0">
                        <div className="text-gray-500 text-[10px] uppercase font-bold mb-1">Đang giao</div>
                        <div className="text-xl font-bold text-purple-600">{stats.shipping.count}</div>
                        <div className="text-[10px] text-gray-600 font-medium">{formatVND(stats.shipping.amount)}</div>
                    </div>
                </div>
            </div>

            {/* Desktop: Grid 5 columns */}
            <div className="hidden md:grid grid-cols-5 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="text-gray-500 text-xs uppercase font-bold mb-0.5">Chờ duyệt</div>
                        <div className="text-2xl font-bold text-blue-600">{stats.pending_approval}</div>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">đơn hàng</div>
                </div>

                <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="text-gray-500 text-xs uppercase font-bold mb-0.5">Chờ thanh toán</div>
                        <div className="text-2xl font-bold text-red-600">{stats.waiting_payment.count}</div>
                    </div>
                    <div className="text-sm font-medium text-gray-700 mt-0.5">{formatVND(stats.waiting_payment.amount)}</div>
                </div>

                <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="text-gray-500 text-xs uppercase font-bold mb-0.5">Chờ đóng gói</div>
                        <div className="text-2xl font-bold text-orange-600">{stats.waiting_packing.count}</div>
                    </div>
                    <div className="text-sm font-medium text-gray-700 mt-0.5">{formatVND(stats.waiting_packing.amount)}</div>
                </div>

                <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="text-gray-500 text-xs uppercase font-bold mb-0.5">Chờ lấy</div>
                        <div className="text-2xl font-bold text-yellow-600">{stats.waiting_ship.count}</div>
                    </div>
                    <div className="text-sm font-medium text-gray-700 mt-0.5">{formatVND(stats.waiting_ship.amount)}</div>
                </div>

                <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="text-gray-500 text-xs uppercase font-bold mb-0.5">Đang giao</div>
                        <div className="text-2xl font-bold text-purple-600">{stats.shipping.count}</div>
                    </div>
                    <div className="text-sm font-medium text-gray-700 mt-0.5">{formatVND(stats.shipping.amount)}</div>
                </div>
            </div>
        </>
    );
}

