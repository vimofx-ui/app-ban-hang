// =============================================================================
// PURCHASE ORDERS PAGE - Danh sách đơn nhập hàng (Restored Full Version)
// =============================================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, FileText, Truck, Check, X, Clock, Search, Filter, Eye, Trash2,
    Download, Upload, Settings, RefreshCw, ChevronDown
} from 'lucide-react';
import { usePurchaseOrderStore, type PurchaseOrder } from '@/stores/purchaseOrderStore';
import { useSupplierStore } from '@/stores/supplierStore';
import { useBrandStore } from '@/stores/brandStore';
import { useAuthStore } from '@/stores/authStore';
import { Loading } from '@/components/common/Loading';

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
    draft: { label: 'Nháp', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: FileText },
    pending: { label: 'Chờ duyệt', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: Clock },
    approved: { label: 'Đã duyệt', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Check },
    ordered: { label: 'Đã đặt', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: FileText },
    delivering: { label: 'Đang giao', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: Truck },
    partial: { label: 'Nhận 1 phần', color: 'text-cyan-700', bgColor: 'bg-cyan-100', icon: Truck },
    received: { label: 'Hoàn thành', color: 'text-green-700', bgColor: 'bg-green-100', icon: Check },
    cancelled: { label: 'Đã huỷ', color: 'text-red-700', bgColor: 'bg-red-100', icon: X },
};

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
    unpaid: { label: 'Chưa thanh toán', color: 'text-red-600 bg-red-50' },
    partial: { label: 'Thanh toán 1 phần', color: 'text-yellow-600 bg-yellow-50' },
    paid: { label: 'Đã thanh toán', color: 'text-green-600 bg-green-50' },
};

type TabType = 'all' | 'processing' | 'completed';

export function PurchaseOrdersPage() {
    const navigate = useNavigate();
    // Get brandId from multiple sources for robustness
    const brandStoreBrandId = useBrandStore(state => state.currentBrand?.id);
    const authStoreBrandId = useAuthStore(state => state.brandId);
    const brandId = brandStoreBrandId || authStoreBrandId;

    const { purchaseOrders, isLoading, fetchPurchaseOrders, deletePurchaseOrder } = usePurchaseOrderStore();
    const { suppliers, fetchSuppliers } = useSupplierStore();

    // Tab & Filters
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [supplierFilter, setSupplierFilter] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        console.log('[PurchaseOrdersPage] useEffect triggered, brandId:', brandId);
        if (brandId) {
            console.log('[PurchaseOrdersPage] Calling fetchPurchaseOrders for brandId:', brandId);
            fetchPurchaseOrders();
            fetchSuppliers();
        } else {
            console.log('[PurchaseOrdersPage] No brandId yet, waiting...');
        }
    }, [brandId, fetchPurchaseOrders, fetchSuppliers]);

    // Filter logic
    const filteredOrders = purchaseOrders.filter(po => {
        // Tab filter
        if (activeTab === 'processing') {
            if (!['draft', 'pending', 'approved', 'ordered', 'delivering', 'partial'].includes(po.status)) return false;
        } else if (activeTab === 'completed') {
            if (!['received', 'cancelled'].includes(po.status)) return false;
        }

        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (!po.po_number.toLowerCase().includes(q) &&
                !po.supplier_name?.toLowerCase().includes(q)) {
                return false;
            }
        }

        // Status filter
        if (statusFilter && po.status !== statusFilter) return false;

        // Supplier filter
        if (supplierFilter && po.supplier_id !== supplierFilter) return false;

        // Date filter
        if (dateFrom) {
            const from = new Date(dateFrom);
            const created = new Date(po.created_at);
            if (created < from) return false;
        }
        if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59);
            const created = new Date(po.created_at);
            if (created > to) return false;
        }

        return true;
    });

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xoá đơn nhập hàng này?')) return;
        await deletePurchaseOrder(id);
    };

    const clearFilters = () => {
        setStatusFilter('');
        setSupplierFilter('');
        setPaymentFilter('');
        setDateFrom('');
        setDateTo('');
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    // Stats
    const stats = {
        all: purchaseOrders.length,
        processing: purchaseOrders.filter(po => ['draft', 'pending', 'approved', 'ordered', 'delivering', 'partial'].includes(po.status)).length,
        completed: purchaseOrders.filter(po => ['received', 'cancelled'].includes(po.status)).length,
    };

    if (isLoading && purchaseOrders.length === 0) return <Loading />;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header - Responsive */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                                Danh sách đơn nhập hàng
                            </h1>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                                <Download size={16} />
                                <span className="hidden sm:inline">Xuất file</span>
                            </button>
                            <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                                <Upload size={16} />
                                <span className="hidden sm:inline">Nhập file</span>
                            </button>
                            <button
                                onClick={() => navigate('/nhap-hang/tao-moi')}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                            >
                                <Plus size={16} />
                                Tạo đơn nhập hàng
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                {/* Tabs */}
                <div className="flex items-center gap-1 mb-4 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${activeTab === 'all'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                    >
                        Tất cả ({stats.all})
                    </button>
                    <button
                        onClick={() => setActiveTab('processing')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${activeTab === 'processing'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                    >
                        Đang giao dịch ({stats.processing})
                    </button>
                    <button
                        onClick={() => setActiveTab('completed')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${activeTab === 'completed'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                    >
                        Hoàn thành ({stats.completed})
                    </button>
                </div>

                {/* Filters Bar */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                    <div className="grid grid-cols-1 md:flex md:flex-wrap items-center gap-3">
                        {/* Search */}
                        <div className="flex-1 min-w-[200px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Tìm kiếm theo mã đơn nhập, tên SDT, mã NCC"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Quick Filters */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Trạng thái ▼</option>
                            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                <option key={key} value={key}>{config.label}</option>
                            ))}
                        </select>

                        <select
                            value={supplierFilter}
                            onChange={(e) => setSupplierFilter(e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Nhà cung cấp ▼</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>

                        <select
                            value={paymentFilter}
                            onChange={(e) => setPaymentFilter(e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">TT Thanh toán ▼</option>
                            <option value="unpaid">Chưa thanh toán</option>
                            <option value="partial">Thanh toán 1 phần</option>
                            <option value="paid">Đã thanh toán</option>
                        </select>

                        {/* Date Range */}
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg w-full md:w-auto"
                            placeholder="dd/mm/yyyy"
                        />
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg w-full md:w-auto"
                            placeholder="dd/mm/yyyy"
                        />

                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            <X size={14} />
                            Xóa bộ lọc
                        </button>

                        <button className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                            <Settings size={14} />
                            Cột hiển thị
                        </button>
                    </div>
                </div>

                {/* Table - Responsive */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="w-10 px-4 py-3">
                                        <input type="checkbox" className="rounded border-gray-300" />
                                    </th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Mã đơn nhập</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Ngày tạo</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Chi nhánh nhập</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Trạng thái</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase">TT Nhập</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Nhà cung cấp</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Nhân viên tạo</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Số lượng</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Giá trị đơn</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredOrders.map(po => {
                                    const statusConfig = STATUS_CONFIG[po.status] || STATUS_CONFIG.draft;
                                    const StatusIcon = statusConfig.icon;

                                    return (
                                        <tr
                                            key={po.id}
                                            className="hover:bg-blue-50 cursor-pointer transition-colors"
                                            onClick={() => navigate(`/nhap-hang/${po.id}`)}
                                        >
                                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                                <input type="checkbox" className="rounded border-gray-300" />
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="font-medium text-blue-600 hover:underline">
                                                    {po.po_number}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {formatDate(po.created_at)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {po.branch_name || 'Cửa hàng chính'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {/* Logic: 
                                                    - received + paid = Hoàn thành (green)
                                                    - received + !paid = Chưa thanh toán (orange)
                                                    - !received + paid = Đã thanh toán (blue)  
                                                    - cancelled = Đã hủy (red)
                                                    - else = status hiện tại
                                                */}
                                                {po.status === 'cancelled' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                                        <X size={12} />
                                                        Đã hủy
                                                    </span>
                                                ) : po.status === 'received' && po.payment_status === 'paid' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                        <Check size={12} />
                                                        Hoàn thành
                                                    </span>
                                                ) : po.status === 'received' && po.payment_status !== 'paid' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                                        <Clock size={12} />
                                                        Chưa thanh toán
                                                    </span>
                                                ) : po.payment_status === 'paid' && po.status !== 'received' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                                        <Check size={12} />
                                                        Đã thanh toán
                                                    </span>
                                                ) : (
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                                                        <StatusIcon size={12} />
                                                        {statusConfig.label}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {po.status === 'received' ? (
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                        Đã nhập
                                                    </span>
                                                ) : po.status === 'cancelled' ? (
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                                        Đã hủy
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                                        Chưa nhập
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {po.supplier_name || '---'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                Admin
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-gray-900">
                                                {po.items_count || 0}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-gray-900">
                                                {formatCurrency(po.total_amount)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {filteredOrders.map(po => {
                            const statusConfig = STATUS_CONFIG[po.status] || STATUS_CONFIG.draft;
                            const StatusIcon = statusConfig.icon;

                            return (
                                <div
                                    key={po.id}
                                    className="p-4 hover:bg-gray-50 active:bg-gray-100"
                                    onClick={() => navigate(`/nhap-hang/${po.id}`)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="font-medium text-blue-600">{po.po_number}</div>
                                            <div className="text-sm text-gray-500">{formatDate(po.created_at)}</div>
                                        </div>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                                            <StatusIcon size={12} />
                                            {statusConfig.label}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600">{po.supplier_name || 'Chưa có NCC'}</span>
                                        <span className="font-semibold text-gray-900">{formatCurrency(po.total_amount)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Empty State */}
                    {filteredOrders.length === 0 && (
                        <div className="text-center py-16 text-gray-500">
                            <FileText size={48} className="mx-auto mb-3 opacity-50" />
                            <p className="text-lg">Chưa có đơn nhập hàng</p>
                            <button
                                onClick={() => navigate('/nhap-hang/tao-moi')}
                                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                                Tạo đơn nhập hàng đầu tiên
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
