import React, { useState } from 'react';
import {
    RefreshCw,
    CheckCircle,
    XCircle,
    Clock,
    Eye,
    ThumbsUp,
    ThumbsDown,
    Search,
    Filter
} from 'lucide-react';
import { useAdminBilling, type SaaSInvoice } from '@/hooks/useBilling';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export function AdminInvoicesPage() {
    const { allInvoices, isLoading, verifyInvoice, refetch } = useAdminBilling();
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full flex items-center gap-1"><CheckCircle size={12} /> Đã TT</span>;
            case 'pending':
                return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full flex items-center gap-1"><Clock size={12} /> Chờ duyệt</span>;
            case 'failed':
                return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full flex items-center gap-1"><XCircle size={12} /> Từ chối</span>;
            default:
                return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{status}</span>;
        }
    };

    const handleApprove = async (invoiceId: string) => {
        if (!confirm('Xác nhận duyệt hóa đơn này?')) return;
        setIsProcessing(true);
        await verifyInvoice(invoiceId, true);
        setIsProcessing(false);
        setSelectedInvoice(null);
    };

    const handleReject = async (invoiceId: string) => {
        if (!rejectionReason.trim()) {
            alert('Vui lòng nhập lý do từ chối');
            return;
        }
        setIsProcessing(true);
        await verifyInvoice(invoiceId, false, rejectionReason);
        setIsProcessing(false);
        setSelectedInvoice(null);
        setRejectionReason('');
    };

    const filteredInvoices = allInvoices.filter(inv => {
        if (filterStatus && inv.status !== filterStatus) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                inv.transaction_code?.toLowerCase().includes(q) ||
                (inv as any).brands?.name?.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const pendingCount = allInvoices.filter(i => i.status === 'pending').length;

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Quản lý Hóa đơn</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Duyệt và quản lý thanh toán của tenant
                        {pendingCount > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                {pendingCount} chờ duyệt
                            </span>
                        )}
                    </p>
                </div>
                <button
                    onClick={refetch}
                    disabled={isLoading}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
                >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    Làm mới
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Tìm theo mã GD, tên brand..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                    </div>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                        <option value="">Tất cả trạng thái</option>
                        <option value="pending">Chờ duyệt</option>
                        <option value="paid">Đã thanh toán</option>
                        <option value="failed">Từ chối</option>
                    </select>
                </div>
            </div>

            {/* Invoice List */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center">
                        <RefreshCw className="animate-spin mx-auto text-gray-400" size={32} />
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        Không có hóa đơn nào
                    </div>
                ) : (
                    <>
                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {filteredInvoices.map((invoice: any) => (
                                <div key={invoice.id} className="p-4 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900">{invoice.brands?.name || 'N/A'}</p>
                                            <p className="text-sm text-gray-500">
                                                {format(new Date(invoice.created_at), 'dd/MM/yyyy', { locale: vi })}
                                            </p>
                                        </div>
                                        {getStatusBadge(invoice.status)}
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <div>
                                            <span className="text-gray-500">Gói: </span>
                                            <span className="font-medium">{invoice.billing_period === 'yearly' ? 'Năm' : 'Tháng'}</span>
                                        </div>
                                        <span className="font-bold text-indigo-600">{formatPrice(invoice.amount)}</span>
                                    </div>
                                    {invoice.transaction_code && (
                                        <p className="text-xs text-gray-500">Mã GD: {invoice.transaction_code}</p>
                                    )}
                                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                                        {invoice.evidence_url && (
                                            <a
                                                href={invoice.evidence_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 py-2 text-center text-blue-600 bg-blue-50 rounded-lg text-sm font-medium"
                                            >
                                                Xem ảnh CK
                                            </a>
                                        )}
                                        {invoice.status === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => handleApprove(invoice.id)}
                                                    disabled={isProcessing}
                                                    className="flex-1 py-2 text-center text-green-600 bg-green-50 rounded-lg text-sm font-medium"
                                                >
                                                    Duyệt
                                                </button>
                                                <button
                                                    onClick={() => setSelectedInvoice(invoice)}
                                                    disabled={isProcessing}
                                                    className="flex-1 py-2 text-center text-red-600 bg-red-50 rounded-lg text-sm font-medium"
                                                >
                                                    Từ chối
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table */}
                        <table className="hidden md:table w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="py-3 px-4 text-left font-medium text-gray-600">Thương hiệu</th>
                                    <th className="py-3 px-4 text-left font-medium text-gray-600">Gói</th>
                                    <th className="py-3 px-4 text-left font-medium text-gray-600">Số tiền</th>
                                    <th className="py-3 px-4 text-left font-medium text-gray-600">Mã GD</th>
                                    <th className="py-3 px-4 text-left font-medium text-gray-600">Trạng thái</th>
                                    <th className="py-3 px-4 text-left font-medium text-gray-600">Ngày tạo</th>
                                    <th className="py-3 px-4 text-center font-medium text-gray-600">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredInvoices.map((invoice: any) => (
                                    <tr key={invoice.id} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 font-medium">{invoice.brands?.name || 'N/A'}</td>
                                        <td className="py-3 px-4">{invoice.billing_period === 'yearly' ? 'Năm' : 'Tháng'}</td>
                                        <td className="py-3 px-4 font-medium">{formatPrice(invoice.amount)}</td>
                                        <td className="py-3 px-4 text-gray-500">{invoice.transaction_code || '-'}</td>
                                        <td className="py-3 px-4">{getStatusBadge(invoice.status)}</td>
                                        <td className="py-3 px-4 text-gray-500">
                                            {format(new Date(invoice.created_at), 'dd/MM/yyyy', { locale: vi })}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-center gap-2">
                                                {invoice.evidence_url && (
                                                    <a
                                                        href={invoice.evidence_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                        title="Xem ảnh CK"
                                                    >
                                                        <Eye size={16} />
                                                    </a>
                                                )}
                                                {invoice.status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleApprove(invoice.id)}
                                                            disabled={isProcessing}
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                                            title="Duyệt"
                                                        >
                                                            <ThumbsUp size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => setSelectedInvoice(invoice)}
                                                            disabled={isProcessing}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                                            title="Từ chối"
                                                        >
                                                            <ThumbsDown size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}
            </div>

            {/* Rejection Modal */}
            {selectedInvoice && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold mb-4">Từ chối hóa đơn</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Hóa đơn của <strong>{selectedInvoice.brands?.name}</strong> - {formatPrice(selectedInvoice.amount)}
                        </p>
                        <textarea
                            placeholder="Nhập lý do từ chối..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg text-sm mb-4"
                            rows={3}
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setSelectedInvoice(null);
                                    setRejectionReason('');
                                }}
                                className="flex-1 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => handleReject(selectedInvoice.id)}
                                disabled={isProcessing}
                                className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                            >
                                {isProcessing ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
