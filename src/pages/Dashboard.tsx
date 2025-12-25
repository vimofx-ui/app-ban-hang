// =============================================================================
// DASHBOARD PAGE
// =============================================================================

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatVND } from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';
import { useReportStore } from '@/stores/reportStore';
import { useProductStore } from '@/stores/productStore';
import { useOrderStore } from '@/stores/orderStore';
import { supabase } from '@/lib/supabase';
import type { Product, Order } from '@/types';
import { ProductDetailsModal } from '@/components/products/ProductDetailsModal';
import { OrderDetailsModal } from '@/components/orders/OrderDetailsModal';

export function Dashboard() {
    const navigate = useNavigate();
    const {
        fetchReports,
        totalRevenue,
        totalOrders,
        topProducts,
        recentOrders,
        loading
    } = useReportStore();

    // Order store for counts
    const { orders, loadOrders } = useOrderStore();

    // Calculate order counts by status
    const orderCounts = useMemo(() => {
        const pending = orders.filter(o => o.status === 'pending_approval').length;
        const approved = orders.filter(o => o.status === 'approved').length;
        const packing = orders.filter(o => ['packing', 'packed'].includes(o.status)).length;
        const shipping = orders.filter(o => o.status === 'shipping').length;
        const cancelled = orders.filter(o => o.status === 'cancelled').length;
        const debt = orders.filter(o => o.payment_status === 'unpaid' || o.payment_status === 'partially_paid').length;
        return { pending, approved, packing, shipping, cancelled, debt };
    }, [orders]);

    // Local state for modals
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // Date filter state
    const [dateFilter, setDateFilter] = useState<string>('today');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    // Date filter options
    const dateOptions = [
        { id: 'today', label: 'Hôm nay' },
        { id: 'yesterday', label: 'Hôm qua' },
        { id: 'week', label: '7 ngày qua' },
        { id: 'month', label: 'Tháng này' },
        { id: 'last_month', label: 'Tháng trước' },
        { id: 'custom', label: 'Tùy chọn...' },
    ];

    // Initial load and reload on filter change
    useEffect(() => {
        if (dateFilter === 'custom' && (!customFrom || !customTo)) return;
        fetchReports(dateFilter as any);
        loadOrders(); // Load orders for status counts
    }, [fetchReports, dateFilter, customFrom, customTo, loadOrders]);

    const handleDateChange = (filterId: string) => {
        setDateFilter(filterId);
        if (filterId === 'custom') {
            setShowDatePicker(true);
        } else {
            setShowDatePicker(false);
        }
    };

    const getDateLabel = () => {
        if (dateFilter === 'custom' && customFrom && customTo) {
            return `${customFrom} → ${customTo}`;
        }
        return dateOptions.find(d => d.id === dateFilter)?.label || 'Hôm nay';
    };

    const handleProductClick = async (productId: string) => {
        setIsLoadingDetails(true);
        try {
            // Fetch full product details
            if (!supabase) {
                // Fallback to store if no supabase
                const { products } = useProductStore.getState();
                const product = products.find(p => p.id === productId);
                if (product) setSelectedProduct(product);
                return;
            }
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', productId)
                .single();

            if (error) throw error;
            if (data) setSelectedProduct(data as Product);
        } catch (error) {
            console.error('Error loading product details:', error);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="bg-white border-b border-gray-200">
                <div className="container-app py-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Xin chào! 👋</h1>
                            <p className="text-gray-500">Tổng quan cửa hàng • {getDateLabel()}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Date Filter Buttons */}
                            <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-xl">
                                {dateOptions.map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => handleDateChange(option.id)}
                                        className={cn(
                                            'px-3 py-1.5 text-sm font-medium rounded-lg transition-all',
                                            dateFilter === option.id
                                                ? 'bg-white text-gray-900 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>

                            {/* Custom Date Picker */}
                            {showDatePicker && (
                                <div className="flex items-center gap-2 bg-white border rounded-lg p-1">
                                    <input
                                        type="date"
                                        value={customFrom}
                                        onChange={(e) => setCustomFrom(e.target.value)}
                                        className="px-2 py-1 text-sm border-0 rounded"
                                    />
                                    <span className="text-gray-400">→</span>
                                    <input
                                        type="date"
                                        value={customTo}
                                        onChange={(e) => setCustomTo(e.target.value)}
                                        className="px-2 py-1 text-sm border-0 rounded"
                                    />
                                </div>
                            )}

                            <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-xl">
                                <span className="text-sm text-green-700 font-medium">
                                    ● Đang mở cửa
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container-app py-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <StatCard
                        title="Doanh thu"
                        value={loading ? '...' : formatVND(totalRevenue)}
                        icon={<RevenueIcon />}
                        trend={getDateLabel()}
                        trendUp={true}
                        onClick={() => navigate('/reports')}
                    />
                    <StatCard
                        title="Số đơn hàng"
                        value={loading ? '...' : totalOrders.toString()}
                        icon={<OrdersIcon />}
                        trend={getDateLabel()}
                        trendUp={true}
                        onClick={() => navigate('/orders')}
                    />
                    <StatCard
                        title="Giá trị TB/đơn"
                        value={loading ? '...' : formatVND(avgOrderValue)}
                        icon={<AvgIcon />}
                        trend="Trung bình"
                        trendUp={false}
                        onClick={() => navigate('/reports?tab=profit')}
                    />
                </div>

                {/* Order Management Summary Panel */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Đơn hàng chờ xử lý
                        </h3>
                        <button
                            onClick={() => navigate('/orders')}
                            className="text-sm text-primary hover:underline"
                        >
                            Xem tất cả
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {/* Pending Approval */}
                        <div
                            onClick={() => navigate('/orders?status=pending_approval')}
                            className="flex flex-col items-center p-4 bg-yellow-50 rounded-xl border border-yellow-100 hover:bg-yellow-100 cursor-pointer transition-colors"
                        >
                            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center mb-2">
                                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <span className="text-xs text-gray-600 text-center">Chờ duyệt</span>
                            <span className="text-xl font-bold text-yellow-600">{orderCounts.pending}</span>
                        </div>

                        {/* Approved - Waiting Pack */}
                        <div
                            onClick={() => navigate('/orders?status=approved')}
                            className="flex flex-col items-center p-4 bg-blue-50 rounded-xl border border-blue-100 hover:bg-blue-100 cursor-pointer transition-colors"
                        >
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                            </div>
                            <span className="text-xs text-gray-600 text-center">Chờ đóng gói</span>
                            <span className="text-xl font-bold text-blue-600">{orderCounts.approved}</span>
                        </div>

                        {/* Packing */}
                        <div
                            onClick={() => navigate('/orders?status=packing')}
                            className="flex flex-col items-center p-4 bg-purple-50 rounded-xl border border-purple-100 hover:bg-purple-100 cursor-pointer transition-colors"
                        >
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                            </div>
                            <span className="text-xs text-gray-600 text-center">Chờ lấy hàng</span>
                            <span className="text-xl font-bold text-purple-600">{orderCounts.packing}</span>
                        </div>

                        {/* Shipping */}
                        <div
                            onClick={() => navigate('/orders?status=shipping')}
                            className="flex flex-col items-center p-4 bg-cyan-50 rounded-xl border border-cyan-100 hover:bg-cyan-100 cursor-pointer transition-colors"
                        >
                            <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center mb-2">
                                <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a3 3 0 11-6 0" />
                                </svg>
                            </div>
                            <span className="text-xs text-gray-600 text-center">Đang giao</span>
                            <span className="text-xl font-bold text-cyan-600">{orderCounts.shipping}</span>
                        </div>

                        {/* Debt */}
                        <div
                            onClick={() => navigate('/orders?payment=unpaid')}
                            className="flex flex-col items-center p-4 bg-orange-50 rounded-xl border border-orange-100 hover:bg-orange-100 cursor-pointer transition-colors"
                        >
                            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mb-2">
                                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <span className="text-xs text-gray-600 text-center">Đơn nợ</span>
                            <span className="text-xl font-bold text-orange-600">{orderCounts.debt}</span>
                        </div>

                        {/* Cancelled */}
                        <div
                            onClick={() => navigate('/orders?status=cancelled')}
                            className="flex flex-col items-center p-4 bg-red-50 rounded-xl border border-red-100 hover:bg-red-100 cursor-pointer transition-colors"
                        >
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mb-2">
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <span className="text-xs text-gray-600 text-center">Đã hủy</span>
                            <span className="text-xl font-bold text-red-600">{orderCounts.cancelled}</span>
                        </div>
                    </div>
                </div>

                {/* Two column layout */}
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Top Products */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Top sản phẩm bán chạy
                            </h3>
                            <button
                                onClick={() => navigate('/products?sort=sales_desc')}
                                className="text-sm text-primary hover:underline"
                            >
                                Xem tất cả
                            </button>
                        </div>
                        <div className="space-y-3 flex-1">
                            {topProducts.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">Chưa có dữ liệu bán hàng hôm nay</p>
                            ) : (
                                topProducts.slice(0, 5).map((product, idx) => (
                                    <div
                                        key={product.id}
                                        onClick={() => handleProductClick(product.id)}
                                        className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                                    >
                                        <div className={cn(
                                            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                                            idx === 0 && 'bg-yellow-100 text-yellow-700',
                                            idx === 1 && 'bg-gray-100 text-gray-600',
                                            idx === 2 && 'bg-orange-100 text-orange-700',
                                            idx > 2 && 'bg-gray-50 text-gray-500'
                                        )}>
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 truncate hover:text-primary transition-colors">{product.name}</p>
                                            <p className="text-sm text-gray-500">{product.quantity} đã bán</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-gray-900">{formatVND(product.revenue)}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Recent Orders */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Đơn hàng gần đây
                            </h3>
                            <button
                                onClick={() => navigate('/orders')}
                                className="text-sm text-primary hover:underline"
                            >
                                Xem tất cả
                            </button>
                        </div>
                        <div className="space-y-3 flex-1">
                            {recentOrders.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">Chưa có đơn hàng nào</p>
                            ) : (
                                recentOrders.map((order) => (
                                    <div
                                        key={order.id}
                                        onClick={() => setSelectedOrder(order)}
                                        className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <ReceiptIcon className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-mono text-sm font-medium text-gray-900 hover:text-primary transition-colors">{order.order_number}</p>
                                            <p className="text-sm text-gray-500">
                                                {order.order_items?.length || 0} sản phẩm • {new Date(order.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-gray-900">{formatVND(order.total_amount)}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <button
                            onClick={() => navigate('/orders')}
                            className="w-full mt-4 py-3 text-sm font-medium text-primary hover:bg-primary/5 rounded-xl transition-colors"
                        >
                            Xem tất cả đơn hàng →
                        </button>
                    </div>
                </div>
            </main>

            {/* Modals */}
            {(selectedProduct || isLoadingDetails) && (
                isLoadingDetails ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                        <div className="bg-white p-4 rounded-lg shadow-lg">Đang tải thông tin sản phẩm...</div>
                    </div>
                ) : selectedProduct && (
                    <ProductDetailsModal
                        product={selectedProduct}
                        onClose={() => setSelectedProduct(null)}
                        onEdit={() => {
                            setSelectedProduct(null);
                            navigate('/products'); // Or open edit modal directly if possible
                        }}
                    />
                )
            )}

            {selectedOrder && (
                <OrderDetailsModal
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                />
            )}
        </div>
    );
}

// =============================================================================
// Helper Components
// =============================================================================

interface StatCardProps {
    title: string;
    value: string;
    icon: React.ReactNode;
    trend: string;
    trendUp: boolean;
    onClick?: () => void;
}

function StatCard({ title, value, icon, trend, trendUp, onClick }: StatCardProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-all",
                onClick && "cursor-pointer hover:border-primary/50"
            )}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-gray-500">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    {icon}
                </div>
            </div>
            <div className="mt-4 flex items-center gap-1">
                <span className={cn(
                    'text-sm font-medium',
                    trendUp ? 'text-green-600' : 'text-gray-500'
                )}>
                    {trend}
                </span>
            </div>
        </div>
    );
}


// =============================================================================
// Icons
// =============================================================================

function RevenueIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
    );
}

function OrdersIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
    );
}

function AvgIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
            <path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
    );
}

function ReceiptIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
            <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
            <path d="M12 17V7" />
        </svg>
    );
}

function AlertIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    );
}

export default Dashboard;
