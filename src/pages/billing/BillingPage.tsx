import React, { useState } from 'react';
import {
    CreditCard,
    Calendar,
    ArrowUpCircle,
    CheckCircle,
    Clock,
    XCircle,
    FileText,
    Download,
    RefreshCw,
    Upload,
    AlertTriangle
} from 'lucide-react';
import { useBilling, type SaaSInvoice } from '@/hooks/useBilling';
import { UpgradePlanModal } from '@/components/billing/UpgradePlanModal';
import { formatDistanceToNow, format } from 'date-fns';
import { vi } from 'date-fns/locale';

export function BillingPage() {
    const { currentPlan, subscription, invoices, plans, isLoading, uploadEvidence, updateTransactionCode } = useBilling();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
    const [transactionCode, setTransactionCode] = useState('');

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full flex items-center gap-1"><CheckCircle size={12} /> Đã thanh toán</span>;
            case 'pending':
                return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full flex items-center gap-1"><Clock size={12} /> Chờ xác nhận</span>;
            case 'failed':
                return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full flex items-center gap-1"><XCircle size={12} /> Thất bại</span>;
            case 'cancelled':
                return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">Đã hủy</span>;
            default:
                return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{status}</span>;
        }
    };

    const getDaysRemaining = () => {
        if (!subscription?.expires_at) return null;
        const expires = new Date(subscription.expires_at);
        const now = new Date();
        const diff = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const daysRemaining = getDaysRemaining();

    if (isLoading) {
        return (
            <div className="p-6 flex items-center justify-center">
                <RefreshCw className="animate-spin text-gray-400" size={32} />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Gói dịch vụ & Thanh toán</h1>
                <p className="text-gray-500 text-sm mt-1">Quản lý gói đăng ký và lịch sử thanh toán</p>
            </div>

            {/* Expiry Warning */}
            {daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="text-yellow-600" size={24} />
                        <div>
                            <p className="font-medium text-yellow-800">Gói sắp hết hạn!</p>
                            <p className="text-sm text-yellow-700">
                                Gói của bạn sẽ hết hạn trong <strong>{daysRemaining} ngày</strong>.
                                Gia hạn ngay để không bị gián đoạn dịch vụ.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowUpgradeModal(true)}
                            className="ml-auto px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700"
                        >
                            Gia hạn ngay
                        </button>
                    </div>
                </div>
            )}

            {daysRemaining !== null && daysRemaining <= 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
                    <div className="flex items-center gap-3">
                        <XCircle className="text-red-600" size={24} />
                        <div>
                            <p className="font-medium text-red-800">Gói đã hết hạn!</p>
                            <p className="text-sm text-red-700">
                                Một số tính năng đã bị giới hạn. Vui lòng gia hạn để tiếp tục sử dụng đầy đủ.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowUpgradeModal(true)}
                            className="ml-auto px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                        >
                            Gia hạn ngay
                        </button>
                    </div>
                </div>
            )}

            {/* Current Plan Card */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-2xl p-6 mb-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-blue-200 text-sm mb-1">Gói hiện tại</p>
                        <h2 className="text-2xl font-bold mb-2">{currentPlan?.name || 'Chưa đăng ký'}</h2>
                        {subscription?.expires_at && (
                            <p className="text-blue-200 text-sm flex items-center gap-2">
                                <Calendar size={14} />
                                Hết hạn: {format(new Date(subscription.expires_at), 'dd/MM/yyyy', { locale: vi })}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => setShowUpgradeModal(true)}
                        className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 flex items-center gap-2"
                    >
                        <ArrowUpCircle size={18} />
                        Nâng cấp
                    </button>
                </div>

                {currentPlan && (
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white/10 rounded-lg p-3">
                            <p className="text-blue-200 text-xs">Chi nhánh</p>
                            <p className="text-lg font-bold">{currentPlan.max_branches === -1 ? '∞' : currentPlan.max_branches}</p>
                        </div>
                        <div className="bg-white/10 rounded-lg p-3">
                            <p className="text-blue-200 text-xs">Nhân viên</p>
                            <p className="text-lg font-bold">{currentPlan.max_users === -1 ? '∞' : currentPlan.max_users}</p>
                        </div>
                        <div className="bg-white/10 rounded-lg p-3">
                            <p className="text-blue-200 text-xs">Sản phẩm</p>
                            <p className="text-lg font-bold">{currentPlan.max_products === -1 ? '∞' : currentPlan.max_products}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Invoice History */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <FileText size={18} />
                        Lịch sử thanh toán
                    </h3>
                </div>

                {invoices.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <CreditCard size={32} className="mx-auto mb-2 text-gray-300" />
                        <p>Chưa có giao dịch nào</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {invoices.map((invoice) => {
                            const plan = plans.find(p => p.id === invoice.plan_id);

                            return (
                                <div key={invoice.id} className="p-4 hover:bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                Gói {plan?.name || 'Unknown'}
                                                <span className="text-gray-400 text-sm ml-2">
                                                    ({invoice.billing_period === 'yearly' ? 'Năm' : 'Tháng'})
                                                </span>
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {format(new Date(invoice.created_at), 'HH:mm dd/MM/yyyy', { locale: vi })}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-gray-900">{formatPrice(invoice.amount)}</p>
                                            {getStatusBadge(invoice.status)}
                                        </div>
                                    </div>

                                    {/* Pending invoice actions */}
                                    {invoice.status === 'pending' && (
                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="text"
                                                    placeholder="Nhập mã giao dịch..."
                                                    value={selectedInvoice === invoice.id ? transactionCode : invoice.transaction_code || ''}
                                                    onChange={(e) => {
                                                        setSelectedInvoice(invoice.id);
                                                        setTransactionCode(e.target.value);
                                                    }}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                />
                                                <button
                                                    onClick={async () => {
                                                        if (selectedInvoice === invoice.id && transactionCode) {
                                                            await updateTransactionCode(invoice.id, transactionCode);
                                                            setTransactionCode('');
                                                            setSelectedInvoice(null);
                                                        }
                                                    }}
                                                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                                                >
                                                    Cập nhật
                                                </button>
                                            </div>
                                            {invoice.evidence_url && (
                                                <a
                                                    href={invoice.evidence_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                                                >
                                                    Xem ảnh chuyển khoản
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {invoice.status === 'failed' && invoice.rejection_reason && (
                                        <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                                            Lý do: {invoice.rejection_reason}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Upgrade Modal */}
            <UpgradePlanModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                currentPlanId={currentPlan?.id}
            />
        </div>
    );
}
