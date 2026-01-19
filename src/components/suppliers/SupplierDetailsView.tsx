import { useState, useEffect } from 'react';
import { useDebtStore } from '@/stores/debtStore';
import { usePurchaseOrderStore } from '@/stores/purchaseOrderStore';
import { useSupplierStore } from '@/stores/supplierStore';
import { formatVND } from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';
import type { Supplier, PurchaseOrder, TransactionType, PurchaseOrder as PurchaseOrderType } from '@/types';
import { CreateTransactionModal } from '@/components/cash/CreateTransactionModal';

// Reuse Purchase Order Modal logic or create a simple view?
// Assuming we might need a PurchaseOrderDetailsModal later, but for now we list orders.
// We can define a simple internal row detail or just list them.

interface SupplierDetailsViewProps {
    supplier: Supplier;
    onBack: () => void;
    onEdit: (supplier: Supplier) => void;
    onDelete: (id: string) => void;
}

export function SupplierDetailsView({ supplier, onBack, onEdit, onDelete }: SupplierDetailsViewProps) {
    const [activeTab, setActiveTab] = useState<'history' | 'debt' | 'contact'>('history');
    const [orders, setOrders] = useState<any[]>([]); // Use PurchaseOrderWithItems type if available, using any for ease now
    const [loading, setLoading] = useState(false);

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentTargetOrder, setPaymentTargetOrder] = useState<any | undefined>(undefined);
    const [refreshKey, setRefreshKey] = useState(0);

    const { purchaseOrders: allPOs, fetchPurchaseOrders, updatePurchaseOrder } = usePurchaseOrderStore();
    const { updateSupplier } = useSupplierStore();

    useEffect(() => {
        fetchPurchaseOrders();
    }, []);

    useEffect(() => {
        if (!supplier.id) return;
        setLoading(true);
        // Filter orders for this supplier
        const supplierOrders = allPOs.filter(o => o.supplier_id === supplier.id);
        setOrders(supplierOrders);
        setLoading(false);
    }, [supplier.id, allPOs, refreshKey]);

    const handleOrderPayment = (order: any) => {
        setPaymentTargetOrder(order);
        setShowPaymentModal(true);
    };

    const handlePaymentSuccess = async (amount: number, type: TransactionType, isAccounting: boolean, notes: string) => {
        // 1. Update Supplier Debt (Handled by updatePurchaseOrder or manually if general)

        if (paymentTargetOrder) {
            // Linked to PO - Update paid_amount
            const newPaidAmount = (paymentTargetOrder.paid_amount || 0) + amount;
            const newPaymentStatus = newPaidAmount >= paymentTargetOrder.total_amount ? 'paid' : 'partial';
            await updatePurchaseOrder(paymentTargetOrder.id, {
                paid_amount: newPaidAmount,
                payment_status: newPaymentStatus
            });
        } else {
            // General Debt Payment - Just record in debtStore
            // Note: Full debt management would require adding payDebt method to supplierStore
            useDebtStore.getState().addPayment({
                payment_type: 'supplier',
                supplier_id: supplier.id,
                amount: amount,
                payment_method: 'cash',
                debt_before: supplier.debt_balance || 0,
                debt_after: Math.max(0, (supplier.debt_balance || 0) - amount),
                notes: notes
            });
        }

        setRefreshKey(k => k + 1);
    };

    const stats = {
        totalOrders: orders.length,
        totalBought: orders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
        deptOrders: orders.filter(o => o.payment_status !== 'paid').length
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            {/* Header */}
            <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Quay lại danh sách
                    </button>
                    <div className="h-6 w-px bg-gray-200"></div>
                    <h1 className="text-xl font-bold text-gray-900">{supplier.name}</h1>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => onDelete(supplier.id)}
                        className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                    >
                        Xóa nhà cung cấp
                    </button>
                    <button
                        onClick={() => { setPaymentTargetOrder(undefined); setShowPaymentModal(true); }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors"
                    >
                        Tạo phiếu chi
                    </button>
                </div>
            </header>

            <main className="container-app py-6 space-y-6">
                {/* Info Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Personal Info */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800">Thông tin nhà cung cấp</h3>
                            <button onClick={() => onEdit(supplier)} className="text-blue-600 text-sm font-medium hover:underline">Cập nhật</button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                            <InfoRow label="Mã NCC" value={supplier.code || '---'} />
                            <InfoRow label="Người liên hệ" value={supplier.contact_person || '---'} />
                            <InfoRow label="Số điện thoại" value={supplier.phone || '---'} />
                            <InfoRow label="Email" value={supplier.email || '---'} />
                            <InfoRow label="Địa chỉ" value={supplier.address || '---'} />
                            <InfoRow label="MST" value={supplier.tax_id || '---'} />
                            <InfoRow label="Công nợ cho phép" value={`${supplier.payment_terms} ngày`} />
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800">Thông tin giao dịch</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                            <InfoRow label="Tổng mua hàng" value={formatVND(stats.totalBought)} cssValue="font-bold text-gray-900" />
                            <InfoRow label="Số đơn nhập" value={stats.totalOrders.toString()} />
                            <InfoRow label="Công nợ hiện tại" value={formatVND(supplier.debt_balance)} cssValue="font-bold text-red-600" />
                            <InfoRow label="Đơn chưa thanh toán" value={stats.deptOrders.toString()} />
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="border-b px-6 flex gap-6 overflow-x-auto">
                        <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} label="Lịch sử nhập hàng" />
                        <TabButton active={activeTab === 'debt'} onClick={() => setActiveTab('debt')} label="Công nợ" />
                    </div>

                    <div className="p-0">
                        {activeTab === 'history' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 border-b text-gray-500 font-medium">
                                        <tr>
                                            <th className="px-6 py-3">Mã đơn</th>
                                            <th className="px-6 py-3">Trạng thái</th>
                                            <th className="px-6 py-3 text-right">Giá trị</th>
                                            <th className="px-6 py-3 text-right">Đã thanh toán</th>
                                            <th className="px-6 py-3 text-right">Ngày nhập</th>
                                            <th className="px-6 py-3 text-center">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {orders.length === 0 ? (
                                            <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Chưa có đơn nhập nào</td></tr>
                                        ) : (
                                            orders.map(order => (
                                                <tr key={order.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-3 font-medium text-blue-600">{order.po_number}</td>
                                                    <td className="px-6 py-3">
                                                        <POStatusBadge status={order.status} />
                                                        <PaymentStatusBadge status={order.payment_status} className="ml-2" />
                                                    </td>
                                                    <td className="px-6 py-3 text-right font-medium">{formatVND(order.total_amount)}</td>
                                                    <td className="px-6 py-3 text-right text-green-600">{formatVND(order.paid_amount)}</td>
                                                    <td className="px-6 py-3 text-right text-gray-500">{new Date(order.created_at).toLocaleDateString('vi-VN')}</td>
                                                    <td className="px-6 py-3 text-center">
                                                        {order.payment_status !== 'paid' && order.status !== 'cancelled' && (
                                                            <button
                                                                onClick={() => handleOrderPayment(order)}
                                                                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                                                            >
                                                                Thanh toán
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {activeTab === 'debt' && (
                            <SupplierDebtTabContent supplier={supplier} orders={orders} onOrderClick={handleOrderPayment} />
                        )}
                    </div>
                </div>
            </main>

            <CreateTransactionModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                defaultType="expense"
                targetId={supplier.id}
                targetName={supplier.name}
                targetKind="supplier"
                referenceId={paymentTargetOrder?.id}
                referenceType={paymentTargetOrder ? 'purchase_order' : undefined}
                onSuccess={handlePaymentSuccess}
            />
        </div>
    );
}

// Helpers
function InfoRow({ label, value, cssValue }: { label: string, value: string, cssValue?: string }) {
    return (
        <div className="flex justify-between items-start">
            <span className="text-gray-500">{label}</span>
            <span className={cn("text-gray-900 text-right max-w-[50%]", cssValue)}>{value}</span>
        </div>
    );
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "py-4 border-b-2 font-medium text-sm transition-colors",
                active ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
        >
            {label}
        </button>
    );
}

function POStatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        draft: 'Nháp',
        confirmed: 'Đã đặt',
        received: 'Đã nhập kho',
        cancelled: 'Đã hủy'
    };
    const colors: Record<string, string> = {
        draft: 'bg-gray-100 text-gray-700',
        confirmed: 'bg-blue-100 text-blue-700',
        received: 'bg-green-100 text-green-700',
        cancelled: 'bg-red-100 text-red-700'
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors[status] || 'bg-gray-100'}`}>{map[status] || status}</span>;
}

function PaymentStatusBadge({ status, className }: { status: string, className?: string }) {
    if (!status || status === 'unpaid') return null; // Don't show if unpaid (redundant?) or show red? user wants visibility.
    // Actually show Unpaid if explicitly needed
    if (status === 'unpaid') return <span className={`px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 ${className}`}>Chưa TT</span>;

    const map: Record<string, string> = {
        unpaid: 'Chưa TT',
        partial: 'TT 1 phần',
        paid: 'Đã TT'
    };
    const colors: Record<string, string> = {
        unpaid: 'bg-red-100 text-red-700',
        partial: 'bg-yellow-100 text-yellow-700',
        paid: 'bg-green-100 text-green-700'
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${colors[status]} ${className}`}>{map[status] || status}</span>;
}

function SupplierDebtTabContent({ supplier, orders, onOrderClick }: { supplier: Supplier; orders: any[]; onOrderClick: (o: any) => void }) {
    const { getSupplierPayments } = useDebtStore();
    const payments = getSupplierPayments(supplier.id);
    const debtOrders = orders.filter(o => o.payment_status !== 'paid' && o.status !== 'cancelled');

    return (
        <div className="p-6 space-y-6">
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-red-50 rounded-lg p-4 text-center">
                    <div className="text-sm text-red-600">Công nợ hiện tại</div>
                    <div className="text-2xl font-bold text-red-700">{formatVND(supplier.debt_balance)}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-sm text-blue-600">Đơn chưa TT</div>
                    <div className="text-2xl font-bold text-blue-700">{debtOrders.length}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-sm text-green-600">Đã thanh toán</div>
                    <div className="text-2xl font-bold text-green-700">
                        {formatVND(payments.reduce((sum, p) => sum + p.amount, 0))}
                    </div>
                </div>
            </div>

            {debtOrders.length > 0 && (
                <div>
                    <h4 className="font-bold text-gray-800 mb-3">Đơn nhập chưa thanh toán</h4>
                    <div className="space-y-2">
                        {debtOrders.map(order => (
                            <div key={order.id} className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100 cursor-pointer hover:bg-red-100 transition-colors" onClick={() => onOrderClick(order)}>
                                <div>
                                    <span className="font-medium text-gray-800">{order.po_number}</span>
                                    <span className="text-sm text-gray-500 ml-2">
                                        {new Date(order.created_at).toLocaleString('vi-VN')}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-red-600">{formatVND(order.total_amount - (order.paid_amount || 0))}</div>
                                    <div className="text-xs text-gray-500">Tổng: {formatVND(order.total_amount)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Payment History */}
            <div>
                <h4 className="font-bold text-gray-800 mb-3">Lịch sử chi tiền</h4>
                {payments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">Chưa có lịch sử thanh toán</div>
                ) : (
                    <div className="space-y-2">
                        {payments.map(payment => (
                            <div key={payment.id} className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-100">
                                <div>
                                    <span className="font-medium text-gray-800">
                                        {payment.payment_method === 'cash' ? '💵 Tiền mặt' : '🏦 Chuyển khoản'}
                                    </span>
                                    <span className="text-sm text-gray-500 ml-2">
                                        {new Date(payment.created_at).toLocaleString('vi-VN')}
                                    </span>
                                    {payment.notes && <p className="text-xs text-gray-500 mt-1">{payment.notes}</p>}
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-red-600">-{formatVND(payment.amount)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
