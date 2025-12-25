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
            count: 0, // Need to filter by date if strictly following dashboard
            // Simply showing all completed for now or filtered logic
        }
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border shadow-sm col-span-1">
                <div className="text-gray-500 text-xs uppercase font-bold mb-1">Chờ duyệt</div>
                <div className="text-2xl font-bold text-blue-600">{stats.pending_approval}</div>
                <div className="text-xs text-gray-400 mt-1">đơn hàng</div>
            </div>

            <div className="bg-white p-4 rounded-xl border shadow-sm col-span-1">
                <div className="text-gray-500 text-xs uppercase font-bold mb-1">Chờ thanh toán</div>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-red-600">{stats.waiting_payment.count}</span>
                </div>
                <div className="text-sm font-medium text-gray-700 mt-1">{formatVND(stats.waiting_payment.amount)}</div>
            </div>

            <div className="bg-white p-4 rounded-xl border shadow-sm col-span-1">
                <div className="text-gray-500 text-xs uppercase font-bold mb-1">Chờ đóng gói</div>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-orange-600">{stats.waiting_packing.count}</span>
                </div>
                <div className="text-sm font-medium text-gray-700 mt-1">{formatVND(stats.waiting_packing.amount)}</div>
            </div>

            <div className="bg-white p-4 rounded-xl border shadow-sm col-span-1">
                <div className="text-gray-500 text-xs uppercase font-bold mb-1">Chờ lấy hàng</div>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-yellow-600">{stats.waiting_ship.count}</span>
                </div>
                <div className="text-sm font-medium text-gray-700 mt-1">{formatVND(stats.waiting_ship.amount)}</div>
            </div>

            <div className="bg-white p-4 rounded-xl border shadow-sm col-span-1">
                <div className="text-gray-500 text-xs uppercase font-bold mb-1">Đang giao hàng</div>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-purple-600">{stats.shipping.count}</span>
                </div>
                <div className="text-sm font-medium text-gray-700 mt-1">{formatVND(stats.shipping.amount)}</div>
            </div>
        </div>
    );
}
