import { useEffect, useState, useMemo } from 'react';
import { useReportStore } from '@/stores/reportStore';
import { useStockTransferStore } from '@/stores/stockTransferStore';
import { formatVND } from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useUserStore } from '@/stores/userStore';
import { useAuthStore } from '@/stores/authStore';

// =============================================================================
// ICONS
// =============================================================================

function TrendingUpIcon({ className }: { className?: string }) {
    return <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" /></svg>;
}

function DollarIcon({ className }: { className?: string }) {
    return <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>;
}

function ShoppingBagIcon({ className }: { className?: string }) {
    return <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>;
}

function DownloadIcon({ className }: { className?: string }) {
    return <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>;
}

// =============================================================================
// EXPORT FUNCTION
// =============================================================================

function exportToCSV(data: any[], filename: string) {
    const headers = Object.keys(data[0] || {});
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(h => row[h]).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ReportsPage() {
    const {
        dailyRevenue, topProducts, totalRevenue, totalProfit, totalOrders,
        grossProfit, totalExpenses, netProfit, paymentBreakdown,
        loading, fetchReports, dateRange, setDateRange
    } = useReportStore();

    const [activeTab, setActiveTab] = useState<'dashboard' | 'profit' | 'inventory' | 'payment' | 'transfer'>('dashboard');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'cash' | 'transfer' | 'card' | 'debt' | 'points'>('all');

    const { user: authUser, brandId } = useAuthStore();
    const hasPermission = useUserStore(s => s.hasPermission);
    const { transfers, fetchTransfers } = useStockTransferStore();

    // Transfer statistics
    const transferStats = useMemo(() => {
        const now = new Date();
        const thisMonth = transfers.filter(t => {
            const d = new Date(t.created_at);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        return {
            total: transfers.length,
            pending: transfers.filter(t => t.status === 'pending').length,
            inTransit: transfers.filter(t => t.status === 'in_transit').length,
            completed: transfers.filter(t => t.status === 'completed').length,
            cancelled: transfers.filter(t => t.status === 'cancelled').length,
            thisMonth: thisMonth.length,
            completedThisMonth: thisMonth.filter(t => t.status === 'completed').length,
        };
    }, [transfers]);

    // Transfer chart data
    const transferChartData = useMemo(() => [
        { name: 'Chờ xuất', value: transferStats.pending, color: '#f59e0b' },
        { name: 'Đang chuyển', value: transferStats.inTransit, color: '#3b82f6' },
        { name: 'Hoàn thành', value: transferStats.completed, color: '#10b981' },
        { name: 'Đã hủy', value: transferStats.cancelled, color: '#6b7280' },
    ], [transferStats]);

    if (!hasPermission(authUser as any, 'report_sales')) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Không có quyền truy cập</h2>
                    <p className="text-gray-500 mb-6">Tài khoản của bạn không được cấp quyền xem báo cáo bán hàng.</p>
                </div>
            </div>
        );
    }

    useEffect(() => {
        fetchReports(dateRange);
        if (brandId) {
            fetchTransfers(brandId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRange, brandId]);

    const handleExport = () => {
        const filename = `report-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
        exportToCSV(dailyRevenue, filename);
    };

    // Calculate derived metrics
    const totalCOGS = totalRevenue - grossProfit;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0';

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col h-screen overflow-hidden">

            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Báo cáo & Thống kê</h1>
                        <p className="text-sm text-gray-500">Xem tổng quan tình hình kinh doanh</p>
                    </div>

                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Xuất báo cáo
                    </button>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'dashboard' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            📊 Tổng quan
                        </button>
                        <button
                            onClick={() => setActiveTab('profit')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'profit' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            💰 Lợi nhuận
                        </button>
                        <button
                            onClick={() => setActiveTab('inventory')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'inventory' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            📦 Tồn kho
                        </button>
                        <button
                            onClick={() => setActiveTab('payment')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'payment' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            💳 Thanh toán
                        </button>
                        <button
                            onClick={() => setActiveTab('transfer')}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'transfer' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            🔄 Chuyển kho
                        </button>
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-xl ml-auto">
                        {(['today', 'week', 'month', 'year'] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setDateRange(range)}
                                className={cn(
                                    "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                    dateRange === range ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                {range === 'today' ? 'Hôm nay' : range === 'week' ? '7 ngày' : range === 'month' ? '30 ngày' : 'Năm'}
                            </button>
                        ))}
                    </div>

                    {/* Custom date range */}
                    <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
                        <input
                            type="date"
                            value={customFrom}
                            onChange={(e) => setCustomFrom(e.target.value)}
                            className="px-3 py-1.5 rounded-lg text-sm border-0 bg-white"
                        />
                        <span className="text-gray-400">→</span>
                        <input
                            type="date"
                            value={customTo}
                            onChange={(e) => setCustomTo(e.target.value)}
                            className="px-3 py-1.5 rounded-lg text-sm border-0 bg-white"
                        />
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto p-6">
                <div className="max-w-7xl mx-auto space-y-6">

                    {activeTab === 'dashboard' ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                            <DollarIcon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Tổng doanh thu</p>
                                            <h3 className="text-2xl font-bold text-gray-900 mt-1">
                                                {loading ? "..." : formatVND(totalRevenue)}
                                            </h3>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                                            <TrendingUpIcon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Lợi nhuận ước tính</p>
                                            <h3 className="text-2xl font-bold text-gray-900 mt-1">
                                                {loading ? "..." : formatVND(totalProfit)}
                                            </h3>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                                            <ShoppingBagIcon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Tổng đơn hàng</p>
                                            <h3 className="text-2xl font-bold text-gray-900 mt-1">
                                                {loading ? "..." : totalOrders}
                                            </h3>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-[400px]">
                                    <h3 className="text-lg font-bold text-gray-900 mb-6">Biểu đồ doanh thu</h3>
                                    <ResponsiveContainer width="100%" height="90%">
                                        <AreaChart data={dailyRevenue}>
                                            <defs>
                                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} />
                                            <YAxis hide />
                                            <Tooltip
                                                formatter={(value: number) => formatVND(value)}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="revenue"
                                                stroke="#0ea5e9"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorRevenue)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <h3 className="text-lg font-bold text-gray-900 mb-6">Top sản phẩm</h3>
                                    <div className="space-y-4">
                                        {topProducts.map((product, idx) => (
                                            <div key={product.id} className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-xs text-gray-600">
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                                                    <p className="text-xs text-gray-500">{product.quantity} đã bán</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold text-gray-900">{formatVND(product.revenue)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Payment Breakdown */}
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">💳 Thanh toán theo phương thức</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                        <span className="flex items-center gap-2 text-green-700">💵 Tiền mặt</span>
                                        <span className="font-bold">{formatVND(paymentBreakdown.cash)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                        <span className="flex items-center gap-2 text-blue-700">🏦 Chuyển khoản</span>
                                        <span className="font-bold">{formatVND(paymentBreakdown.transfer)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                        <span className="flex items-center gap-2 text-purple-700">💳 Thẻ</span>
                                        <span className="font-bold">{formatVND(paymentBreakdown.card)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                        <span className="flex items-center gap-2 text-red-700">📝 Ghi nợ</span>
                                        <span className="font-bold">{formatVND(paymentBreakdown.debt)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                        <span className="flex items-center gap-2 text-orange-700">⭐ Điểm</span>
                                        <span className="font-bold">{formatVND(paymentBreakdown.points)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 font-bold text-gray-900">
                                        <span>Tổng</span>
                                        <span className="text-green-600">
                                            {formatVND(
                                                paymentBreakdown.cash +
                                                paymentBreakdown.transfer +
                                                paymentBreakdown.card +
                                                paymentBreakdown.debt +
                                                paymentBreakdown.points
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : activeTab === 'profit' ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <p className="text-sm font-medium text-gray-500 mb-2">Doanh thu</p>
                                    <h3 className="text-2xl font-bold text-blue-600">{formatVND(totalRevenue)}</h3>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <p className="text-sm font-medium text-gray-500 mb-2">Giá vốn (COGS)</p>
                                    <h3 className="text-2xl font-bold text-orange-600">-{formatVND(totalCOGS)}</h3>
                                    <p className="text-xs text-gray-400 mt-1">~65% doanh thu</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <p className="text-sm font-medium text-gray-500 mb-2">Chi phí</p>
                                    <h3 className="text-2xl font-bold text-red-600">-{formatVND(totalExpenses)}</h3>
                                    <p className="text-xs text-gray-400 mt-1">~10% doanh thu</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <p className="text-sm font-medium text-gray-500 mb-2">Lợi nhuận ròng</p>
                                    <h3 className="text-2xl font-bold text-green-600">{formatVND(netProfit)}</h3>
                                    <p className="text-xs text-gray-400 mt-1">Tỷ suất: {profitMargin}%</p>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-6">Phân tích lợi nhuận theo thời gian</h3>
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart data={dailyRevenue}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} />
                                        <YAxis />
                                        <Tooltip
                                            formatter={(value: number) => formatVND(value)}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Legend />
                                        <Bar dataKey="revenue" fill="#3b82f6" name="Doanh thu" radius={[8, 8, 0, 0]} />
                                        <Bar dataKey="profit" fill="#10b981" name="Lợi nhuận" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </>
                    ) : activeTab === 'inventory' ? (
                        <>
                            {/* Inventory Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <p className="text-sm font-medium text-gray-500 mb-2">Tổng sản phẩm</p>
                                    <h3 className="text-2xl font-bold text-blue-600">--</h3>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <p className="text-sm font-medium text-gray-500 mb-2">Giá trị tồn kho</p>
                                    <h3 className="text-2xl font-bold text-green-600">--</h3>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-red-200 shadow-sm bg-red-50">
                                    <p className="text-sm font-medium text-red-600 mb-2">⚠️ Sắp hết hàng</p>
                                    <h3 className="text-2xl font-bold text-red-600">--</h3>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-orange-200 shadow-sm bg-orange-50">
                                    <p className="text-sm font-medium text-orange-600 mb-2">📦 Hết hàng</p>
                                    <h3 className="text-2xl font-bold text-orange-600">--</h3>
                                </div>
                            </div>

                            {/* Inventory Table */}
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Tồn kho theo sản phẩm</h3>
                                <>
                                    {/* Mobile Cards */}
                                    <div className="md:hidden space-y-3">
                                        {topProducts.slice(0, 10).map((p, idx) => (
                                            <div key={p.id || idx} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-2">
                                                <div className="flex items-start justify-between">
                                                    <div className="font-medium text-gray-900 line-clamp-2 pr-2">{p.name}</div>
                                                    <span className={cn(
                                                        "px-2 py-1 rounded-full text-xs font-medium shrink-0",
                                                        (p.quantity || 0) > 10 ? "bg-green-100 text-green-700" :
                                                            (p.quantity || 0) > 0 ? "bg-yellow-100 text-yellow-700" :
                                                                "bg-red-100 text-red-700"
                                                    )}>
                                                        {(p.quantity || 0) > 10 ? 'Còn hàng' : (p.quantity || 0) > 0 ? 'Sắp hết' : 'Hết hàng'}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-gray-50">
                                                    <div>
                                                        <div className="text-gray-500 text-xs text-center">Tồn kho</div>
                                                        <div className="font-medium text-center">{p.quantity || '--'}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-500 text-xs text-center">Giá trị</div>
                                                        <div className="font-medium text-center">{formatVND(p.revenue)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Desktop Table */}
                                    <div className="overflow-x-auto hidden md:block">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-gray-200">
                                                    <th className="text-left py-3 px-4 font-medium text-gray-500">Sản phẩm</th>
                                                    <th className="text-right py-3 px-4 font-medium text-gray-500">Tồn kho</th>
                                                    <th className="text-right py-3 px-4 font-medium text-gray-500">Giá vốn</th>
                                                    <th className="text-right py-3 px-4 font-medium text-gray-500">Giá trị</th>
                                                    <th className="text-center py-3 px-4 font-medium text-gray-500">Trạng thái</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {topProducts.slice(0, 10).map((p, idx) => (
                                                    <tr key={p.id || idx} className="border-b border-gray-100 hover:bg-gray-50">
                                                        <td className="py-3 px-4 font-medium">{p.name}</td>
                                                        <td className="py-3 px-4 text-right">{p.quantity || '--'}</td>
                                                        <td className="py-3 px-4 text-right">{formatVND(p.revenue / (p.quantity || 1))}</td>
                                                        <td className="py-3 px-4 text-right font-medium">{formatVND(p.revenue)}</td>
                                                        <td className="py-3 px-4 text-center">
                                                            <span className={cn(
                                                                "px-2 py-1 rounded-full text-xs font-medium",
                                                                (p.quantity || 0) > 10 ? "bg-green-100 text-green-700" :
                                                                    (p.quantity || 0) > 0 ? "bg-yellow-100 text-yellow-700" :
                                                                        "bg-red-100 text-red-700"
                                                            )}>
                                                                {(p.quantity || 0) > 10 ? 'Còn hàng' : (p.quantity || 0) > 0 ? 'Sắp hết' : 'Hết hàng'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            </div>
                        </>
                    ) : activeTab === 'payment' ? (
                        <>
                            {/* Payment Method Filter */}
                            <div className="flex items-center gap-4 mb-6">
                                <span className="text-sm font-medium text-gray-700">Lọc theo:</span>
                                <select
                                    value={paymentMethodFilter}
                                    onChange={(e) => setPaymentMethodFilter(e.target.value as any)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="all">Tất cả phương thức</option>
                                    <option value="cash">💵 Tiền mặt</option>
                                    <option value="transfer">🏦 Chuyển khoản</option>
                                    <option value="card">💳 Thẻ</option>
                                    <option value="debt">📝 Ghi nợ</option>
                                    <option value="points">⭐ Điểm</option>
                                </select>
                                <button
                                    onClick={() => {
                                        const data = [
                                            { 'Phương thức': 'Tiền mặt', 'Số tiền': paymentBreakdown.cash },
                                            { 'Phương thức': 'Chuyển khoản', 'Số tiền': paymentBreakdown.transfer },
                                            { 'Phương thức': 'Thẻ', 'Số tiền': paymentBreakdown.card },
                                            { 'Phương thức': 'Ghi nợ', 'Số tiền': paymentBreakdown.debt },
                                            { 'Phương thức': 'Điểm', 'Số tiền': paymentBreakdown.points },
                                        ].filter(d => paymentMethodFilter === 'all' ||
                                            (paymentMethodFilter === 'cash' && d['Phương thức'] === 'Tiền mặt') ||
                                            (paymentMethodFilter === 'transfer' && d['Phương thức'] === 'Chuyển khoản') ||
                                            (paymentMethodFilter === 'card' && d['Phương thức'] === 'Thẻ') ||
                                            (paymentMethodFilter === 'debt' && d['Phương thức'] === 'Ghi nợ') ||
                                            (paymentMethodFilter === 'points' && d['Phương thức'] === 'Điểm')
                                        );
                                        exportToCSV(data, `payment-report-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors text-sm"
                                >
                                    <DownloadIcon className="w-4 h-4" />
                                    Xuất báo cáo
                                </button>
                            </div>

                            {/* Payment Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                                <div className={cn("bg-white p-4 rounded-2xl border shadow-sm", paymentMethodFilter === 'all' || paymentMethodFilter === 'cash' ? "border-green-200" : "border-gray-100 opacity-50")}>
                                    <p className="text-sm font-medium text-green-600 mb-1">💵 Tiền mặt</p>
                                    <h3 className="text-xl font-bold text-gray-900">{formatVND(paymentBreakdown.cash)}</h3>
                                </div>
                                <div className={cn("bg-white p-4 rounded-2xl border shadow-sm", paymentMethodFilter === 'all' || paymentMethodFilter === 'transfer' ? "border-blue-200" : "border-gray-100 opacity-50")}>
                                    <p className="text-sm font-medium text-blue-600 mb-1">🏦 Chuyển khoản</p>
                                    <h3 className="text-xl font-bold text-gray-900">{formatVND(paymentBreakdown.transfer)}</h3>
                                </div>
                                <div className={cn("bg-white p-4 rounded-2xl border shadow-sm", paymentMethodFilter === 'all' || paymentMethodFilter === 'card' ? "border-purple-200" : "border-gray-100 opacity-50")}>
                                    <p className="text-sm font-medium text-purple-600 mb-1">💳 Thẻ</p>
                                    <h3 className="text-xl font-bold text-gray-900">{formatVND(paymentBreakdown.card)}</h3>
                                </div>
                                <div className={cn("bg-white p-4 rounded-2xl border shadow-sm", paymentMethodFilter === 'all' || paymentMethodFilter === 'debt' ? "border-red-200" : "border-gray-100 opacity-50")}>
                                    <p className="text-sm font-medium text-red-600 mb-1">📝 Ghi nợ</p>
                                    <h3 className="text-xl font-bold text-gray-900">{formatVND(paymentBreakdown.debt)}</h3>
                                </div>
                                <div className={cn("bg-white p-4 rounded-2xl border shadow-sm", paymentMethodFilter === 'all' || paymentMethodFilter === 'points' ? "border-orange-200" : "border-gray-100 opacity-50")}>
                                    <p className="text-sm font-medium text-orange-600 mb-1">⭐ Điểm</p>
                                    <h3 className="text-xl font-bold text-gray-900">{formatVND(paymentBreakdown.points)}</h3>
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Tổng hợp thanh toán</h3>
                                <div className="space-y-3">
                                    {(paymentMethodFilter === 'all' || paymentMethodFilter === 'cash') && (
                                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                            <span className="text-green-700">💵 Tiền mặt</span>
                                            <span className="font-bold">{formatVND(paymentBreakdown.cash)}</span>
                                        </div>
                                    )}
                                    {(paymentMethodFilter === 'all' || paymentMethodFilter === 'transfer') && (
                                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                            <span className="text-blue-700">🏦 Chuyển khoản</span>
                                            <span className="font-bold">{formatVND(paymentBreakdown.transfer)}</span>
                                        </div>
                                    )}
                                    {(paymentMethodFilter === 'all' || paymentMethodFilter === 'card') && (
                                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                            <span className="text-purple-700">💳 Thẻ</span>
                                            <span className="font-bold">{formatVND(paymentBreakdown.card)}</span>
                                        </div>
                                    )}
                                    {(paymentMethodFilter === 'all' || paymentMethodFilter === 'debt') && (
                                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                            <span className="text-red-700">📝 Ghi nợ</span>
                                            <span className="font-bold">{formatVND(paymentBreakdown.debt)}</span>
                                        </div>
                                    )}
                                    {(paymentMethodFilter === 'all' || paymentMethodFilter === 'points') && (
                                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                            <span className="text-orange-700">⭐ Điểm</span>
                                            <span className="font-bold">{formatVND(paymentBreakdown.points)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-3 text-lg">
                                        <span className="font-bold text-gray-900">Tổng doanh thu</span>
                                        <span className="font-black text-green-600">{formatVND(totalRevenue)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm text-gray-500">
                                        <span>Tổng các phương thức</span>
                                        <span className={cn(
                                            "font-bold",
                                            (paymentBreakdown.cash + paymentBreakdown.transfer + paymentBreakdown.card + paymentBreakdown.debt + paymentBreakdown.points) === totalRevenue
                                                ? "text-green-600" : "text-red-500"
                                        )}>
                                            {formatVND(paymentBreakdown.cash + paymentBreakdown.transfer + paymentBreakdown.card + paymentBreakdown.debt + paymentBreakdown.points)}
                                            {(paymentBreakdown.cash + paymentBreakdown.transfer + paymentBreakdown.card + paymentBreakdown.debt + paymentBreakdown.points) === totalRevenue ? " ✓" : " ≠"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : activeTab === 'transfer' ? (
                        <>
                            {/* Transfer Header with Export */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">📦 Báo cáo chuyển kho</h3>
                                    <p className="text-sm text-gray-500">Thống kê phiếu chuyển kho giữa các chi nhánh</p>
                                </div>
                                <button
                                    onClick={() => {
                                        const dataToExport = transfers.map(t => ({
                                            'Mã phiếu': t.transfer_code,
                                            'Từ chi nhánh': t.from_branch?.name || '',
                                            'Đến chi nhánh': t.to_branch?.name || '',
                                            'Trạng thái': t.status === 'pending' ? 'Chờ xuất' :
                                                t.status === 'in_transit' ? 'Đang chuyển' :
                                                    t.status === 'completed' ? 'Hoàn thành' : 'Đã hủy',
                                            'Ngày tạo': new Date(t.created_at).toLocaleDateString('vi-VN'),
                                            'Số SP': t.items?.length || 0,
                                        }));
                                        const headers = Object.keys(dataToExport[0] || {});
                                        const csvContent = [
                                            headers.join(','),
                                            ...dataToExport.map(row => headers.map(h => `"${(row as any)[h]}"`).join(','))
                                        ].join('\n');
                                        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                                        const link = document.createElement('a');
                                        link.href = URL.createObjectURL(blob);
                                        link.download = `bao-cao-chuyen-kho-${new Date().toISOString().split('T')[0]}.csv`;
                                        link.click();
                                    }}
                                    disabled={transfers.length === 0}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                                >
                                    📥 Xuất CSV ({transfers.length} phiếu)
                                </button>
                            </div>

                            {/* Transfer Stats Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <p className="text-xs md:text-sm font-medium text-gray-500 mb-2">Tổng phiếu</p>
                                    <h3 className="text-xl md:text-2xl font-bold text-gray-900">{transferStats.total}</h3>
                                </div>
                                <div className="bg-white p-4 md:p-6 rounded-2xl border border-amber-200 shadow-sm bg-amber-50">
                                    <p className="text-xs md:text-sm font-medium text-amber-600 mb-2">📝 Chờ xuất</p>
                                    <h3 className="text-xl md:text-2xl font-bold text-amber-600">{transferStats.pending}</h3>
                                </div>
                                <div className="bg-white p-4 md:p-6 rounded-2xl border border-blue-200 shadow-sm bg-blue-50">
                                    <p className="text-xs md:text-sm font-medium text-blue-600 mb-2">🚚 Đang chuyển</p>
                                    <h3 className="text-xl md:text-2xl font-bold text-blue-600">{transferStats.inTransit}</h3>
                                </div>
                                <div className="bg-white p-4 md:p-6 rounded-2xl border border-green-200 shadow-sm bg-green-50">
                                    <p className="text-xs md:text-sm font-medium text-green-600 mb-2">✅ Hoàn thành</p>
                                    <h3 className="text-xl md:text-2xl font-bold text-green-600">{transferStats.completed}</h3>
                                </div>
                                <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm col-span-2 md:col-span-1">
                                    <p className="text-xs md:text-sm font-medium text-gray-500 mb-2">❌ Đã hủy</p>
                                    <h3 className="text-xl md:text-2xl font-bold text-gray-500">{transferStats.cancelled}</h3>
                                </div>
                            </div>

                            {/* Charts Section */}
                            <div className="grid lg:grid-cols-2 gap-6">
                                {/* Pie Chart */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">Phân bố theo trạng thái</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={transferChartData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={2}
                                                dataKey="value"
                                                label={({ name, value }) => `${name}: ${value}`}
                                            >
                                                {transferChartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value: number) => `${value} phiếu`} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Summary Cards */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">Thống kê tháng này</h3>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                                            <span className="text-gray-600">Tổng phiếu tạo trong tháng</span>
                                            <span className="text-2xl font-bold text-gray-900">{transferStats.thisMonth}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-4 bg-green-50 rounded-xl">
                                            <span className="text-green-700">Đã hoàn thành trong tháng</span>
                                            <span className="text-2xl font-bold text-green-600">{transferStats.completedThisMonth}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-4 bg-blue-50 rounded-xl">
                                            <span className="text-blue-700">Tỷ lệ hoàn thành</span>
                                            <span className="text-2xl font-bold text-blue-600">
                                                {transferStats.total > 0
                                                    ? Math.round((transferStats.completed / transferStats.total) * 100)
                                                    : 0}%
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center p-4 bg-amber-50 rounded-xl">
                                            <span className="text-amber-700">Đang chờ xử lý</span>
                                            <span className="text-2xl font-bold text-amber-600">
                                                {transferStats.pending + transferStats.inTransit}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Transfers List */}
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-gray-900">Phiếu chuyển kho gần đây</h3>
                                    <a href="/ton-kho" className="text-sm text-primary hover:underline">
                                        Xem tất cả →
                                    </a>
                                </div>
                                {transfers.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">Chưa có phiếu chuyển kho nào</div>
                                ) : (
                                    <>
                                        {/* Mobile Cards */}
                                        <div className="md:hidden space-y-3">
                                            {transfers.slice(0, 10).map((t) => (
                                                <div key={t.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-2">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="font-medium text-primary">{t.transfer_code}</div>
                                                            <div className="text-xs text-gray-500">{new Date(t.created_at).toLocaleDateString('vi-VN')}</div>
                                                        </div>
                                                        <span className={cn(
                                                            "px-2 py-1 rounded-full text-xs font-medium",
                                                            t.status === 'pending' && "bg-amber-100 text-amber-700",
                                                            t.status === 'in_transit' && "bg-blue-100 text-blue-700",
                                                            t.status === 'completed' && "bg-green-100 text-green-700",
                                                            t.status === 'cancelled' && "bg-gray-100 text-gray-500"
                                                        )}>
                                                            {t.status === 'pending' && 'Chờ xuất'}
                                                            {t.status === 'in_transit' && 'Đang chuyển'}
                                                            {t.status === 'completed' && 'Hoàn thành'}
                                                            {t.status === 'cancelled' && 'Đã hủy'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm pt-2 border-t border-gray-50">
                                                        <span className="text-gray-600 truncate max-w-[40%]">{t.from_branch?.name}</span>
                                                        <span className="text-gray-400">→</span>
                                                        <span className="font-medium truncate max-w-[40%]">{t.to_branch?.name}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Desktop Table */}
                                        <div className="overflow-x-auto hidden md:block">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-gray-200">
                                                        <th className="text-left py-3 px-4 font-medium text-gray-500">Mã phiếu</th>
                                                        <th className="text-left py-3 px-4 font-medium text-gray-500 hidden md:table-cell">Từ → Đến</th>
                                                        <th className="text-left py-3 px-4 font-medium text-gray-500 hidden sm:table-cell">Ngày tạo</th>
                                                        <th className="text-center py-3 px-4 font-medium text-gray-500">Trạng thái</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {transfers.slice(0, 10).map((t) => (
                                                        <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                            <td className="py-3 px-4 font-medium text-primary">{t.transfer_code}</td>
                                                            <td className="py-3 px-4 hidden md:table-cell">
                                                                <span className="text-gray-600">{t.from_branch?.name}</span>
                                                                <span className="mx-2 text-gray-400">→</span>
                                                                <span className="font-medium">{t.to_branch?.name}</span>
                                                            </td>
                                                            <td className="py-3 px-4 text-gray-600 hidden sm:table-cell">
                                                                {new Date(t.created_at).toLocaleDateString('vi-VN')}
                                                            </td>
                                                            <td className="py-3 px-4 text-center">
                                                                <span className={cn(
                                                                    "px-2 py-1 rounded-full text-xs font-medium",
                                                                    t.status === 'pending' && "bg-amber-100 text-amber-700",
                                                                    t.status === 'in_transit' && "bg-blue-100 text-blue-700",
                                                                    t.status === 'completed' && "bg-green-100 text-green-700",
                                                                    t.status === 'cancelled' && "bg-gray-100 text-gray-500"
                                                                )}>
                                                                    {t.status === 'pending' && '📝 Chờ xuất'}
                                                                    {t.status === 'in_transit' && '🚚 Đang chuyển'}
                                                                    {t.status === 'completed' && '✅ Hoàn thành'}
                                                                    {t.status === 'cancelled' && '❌ Đã hủy'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    ) : null}
                </div>
            </main>
        </div>
    );
}

export default ReportsPage;
