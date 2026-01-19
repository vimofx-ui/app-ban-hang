// =============================================================================
// DEBT MANAGEMENT PAGE - Customer & Supplier Debt Tracking
// =============================================================================

import { useState, useEffect } from 'react';
import { useCustomerStore } from '@/stores/customerStore';
import { useSupplierStore, type Supplier } from '@/stores/supplierStore';
import { useDebtStore } from '@/stores/debtStore';
import { useOrderStore } from '@/stores/orderStore';
import type { Customer, DebtPayment, Order } from '@/types';
import { toast } from 'sonner';

// Format currency
const formatVND = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// Format date
const formatDate = (date: string) => new Date(date).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

export function DebtManagementPage() {
    const { customers, loadCustomers, getCustomersWithDebt, payDebt: payCustomerDebt } = useCustomerStore();
    const { suppliers, loadSuppliers, getSuppliersWithDebt, payDebt: paySupplierDebt } = useSupplierStore();
    const { payments, addPayment, getCustomerPayments, getSupplierPayments } = useDebtStore();
    const { orders } = useOrderStore();

    const [activeTab, setActiveTab] = useState<'customer' | 'supplier'>('customer');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showDebtDetailModal, setShowDebtDetailModal] = useState(false);
    const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
    const [paymentNotes, setPaymentNotes] = useState('');

    useEffect(() => {
        loadCustomers();
        loadSuppliers();
    }, [loadCustomers, loadSuppliers]);

    const customersWithDebt = getCustomersWithDebt();
    const suppliersWithDebt = getSuppliersWithDebt();

    // Get pending orders for selected customer
    const getPendingOrders = (customerId: string): Order[] => {
        return orders.filter(o =>
            o.customer_id === customerId &&
            o.debt_amount > 0 &&
            (o.remaining_debt === undefined || o.remaining_debt > 0)
        );
    };

    const totalCustomerDebt = customersWithDebt.reduce((sum, c) => sum + c.debt_balance, 0);
    const totalSupplierDebt = suppliersWithDebt.reduce((sum, s) => sum + s.debt_balance, 0);

    // Handle payment submission for customer
    const handleCustomerPayment = async () => {
        if (!selectedCustomer || !paymentAmount) return;

        const amount = Number(paymentAmount);
        if (amount <= 0) return;

        // Add payment record
        // FIFO Logic: Distribute payment to oldest unpaid orders
        let remaining = amount;
        const unpaidOrders = orders
            .filter(o => o.customer_id === selectedCustomer.id && o.debt_amount > 0 && (o.remaining_debt === undefined || o.remaining_debt > 0))
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const paidOrdersList: string[] = [];
        const orderStore = useOrderStore.getState();

        for (const order of unpaidOrders) {
            if (remaining <= 0) break;

            const currentDebt = order.remaining_debt ?? order.debt_amount;
            const payForThis = Math.min(remaining, currentDebt);

            const newPaid = (order.paid_amount || 0) + payForThis;
            const newRemaining = currentDebt - payForThis;

            // Update Order
            await orderStore.updateOrder(order.id, {
                paid_amount: newPaid,
                remaining_debt: newRemaining,
                payment_status: newRemaining <= 0 ? 'paid' : 'partially_paid',
                paid_at: newRemaining <= 0 ? new Date().toISOString() : undefined
            });

            remaining -= payForThis;
            paidOrdersList.push(`${order.order_number}`);
        }

        // Add payment record
        addPayment({
            payment_type: 'customer',
            customer_id: selectedCustomer.id,
            amount,
            payment_method: paymentMethod,
            debt_before: selectedCustomer.debt_balance,
            debt_after: Math.max(0, selectedCustomer.debt_balance - amount),
            notes: paymentNotes || `Thanh toán cho các đơn: ${paidOrdersList.join(', ')}`,
        });

        // Update customer debt
        await payCustomerDebt(selectedCustomer.id, amount);

        // Reset form
        setShowPaymentModal(false);
        setPaymentAmount('');
        setPaymentNotes('');
        setSelectedCustomer(null);
        toast.success(`Đã thu ${formatVND(amount)} từ ${selectedCustomer.name}`);
    };

    // Handle payment submission for supplier
    const handleSupplierPayment = async () => {
        if (!selectedSupplier || !paymentAmount) return;

        const amount = Number(paymentAmount);
        if (amount <= 0) return;

        // Add payment record
        addPayment({
            payment_type: 'supplier',
            supplier_id: selectedSupplier.id,
            amount,
            payment_method: paymentMethod,
            debt_before: selectedSupplier.debt_balance,
            debt_after: Math.max(0, selectedSupplier.debt_balance - amount),
            notes: paymentNotes,
        });

        // Update supplier debt
        await paySupplierDebt(selectedSupplier.id, amount);

        // Reset form
        setShowPaymentModal(false);
        setPaymentAmount('');
        setPaymentNotes('');
        setSelectedSupplier(null);
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            {/* Header */}
            <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>💰 Quản lý Công nợ</h1>
            </header>

            {/* Summary Cards */}
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div style={{
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ color: '#6b7280', fontSize: '14px' }}>Công nợ khách hàng</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444', marginTop: '8px' }}>
                        {formatVND(totalCustomerDebt)}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '13px', marginTop: '4px' }}>
                        {customersWithDebt.length} khách còn nợ
                    </div>
                </div>
                <div style={{
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ color: '#6b7280', fontSize: '14px' }}>Nợ nhà cung cấp</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b', marginTop: '8px' }}>
                        {formatVND(totalSupplierDebt)}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '13px', marginTop: '4px' }}>
                        {suppliersWithDebt.length} NCC còn nợ
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ padding: '0 24px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <button
                        onClick={() => setActiveTab('customer')}
                        style={{
                            padding: '12px 24px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: activeTab === 'customer' ? '#22c55e' : 'white',
                            color: activeTab === 'customer' ? 'white' : '#374151',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                    >
                        👤 Khách hàng ({customersWithDebt.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('supplier')}
                        style={{
                            padding: '12px 24px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: activeTab === 'supplier' ? '#22c55e' : 'white',
                            color: activeTab === 'supplier' ? 'white' : '#374151',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                    >
                        🏭 Nhà cung cấp ({suppliersWithDebt.length})
                    </button>
                </div>
            </div>

            {/* Content */}
            <div style={{ padding: '0 24px 24px' }}>
                {activeTab === 'customer' ? (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        {customersWithDebt.length === 0 ? (
                            <div className="p-12 text-center text-gray-400">
                                <div className="text-5xl mb-3">✅</div>
                                <div>Không có khách hàng nào còn nợ</div>
                            </div>
                        ) : (
                            <>
                                {/* Mobile Cards */}
                                <div className="md:hidden divide-y divide-gray-100">
                                    {customersWithDebt.map(customer => (
                                        <div key={customer.id} className="p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="font-medium text-gray-900">{customer.name}</div>
                                                    <div className="text-sm text-gray-500">{customer.phone || '---'}</div>
                                                </div>
                                                <span className="font-bold text-red-500">{formatVND(customer.debt_balance)}</span>
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                <button
                                                    onClick={() => { setDetailCustomer(customer); setShowDebtDetailModal(true); }}
                                                    className="flex-1 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium text-sm"
                                                >📋 Chi tiết</button>
                                                <button
                                                    onClick={() => { setSelectedCustomer(customer); setShowPaymentModal(true); }}
                                                    className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium text-sm"
                                                >💵 Thu tiền</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* Desktop Table */}
                                <table className="hidden md:table w-full">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Khách hàng</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">SĐT</th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Công nợ</th>
                                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {customersWithDebt.map(customer => (
                                            <tr key={customer.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 font-medium">{customer.name}</td>
                                                <td className="px-4 py-3 text-gray-600">{customer.phone || '---'}</td>
                                                <td className="px-4 py-3 text-right font-bold text-red-500">{formatVND(customer.debt_balance)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex gap-2 justify-center">
                                                        <button
                                                            onClick={() => { setDetailCustomer(customer); setShowDebtDetailModal(true); }}
                                                            className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium text-sm hover:bg-blue-200"
                                                        >📋 Chi tiết</button>
                                                        <button
                                                            onClick={() => { setSelectedCustomer(customer); setShowPaymentModal(true); }}
                                                            className="px-3 py-2 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700"
                                                        >💵 Thu tiền</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        {suppliersWithDebt.length === 0 ? (
                            <div className="p-12 text-center text-gray-400">
                                <div className="text-5xl mb-3">✅</div>
                                <div>Không có nhà cung cấp nào còn nợ</div>
                            </div>
                        ) : (
                            <>
                                {/* Mobile Cards */}
                                <div className="md:hidden divide-y divide-gray-100">
                                    {suppliersWithDebt.map(supplier => (
                                        <div key={supplier.id} className="p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="font-medium text-gray-900">{supplier.name}</div>
                                                    <div className="text-sm text-gray-500">{supplier.phone || supplier.contact_person || '---'}</div>
                                                </div>
                                                <span className="font-bold text-amber-500">{formatVND(supplier.debt_balance)}</span>
                                            </div>
                                            <button
                                                onClick={() => { setSelectedSupplier(supplier); setShowPaymentModal(true); }}
                                                className="w-full py-2 bg-amber-500 text-white rounded-lg font-medium mt-2"
                                            >💳 Trả tiền</button>
                                        </div>
                                    ))}
                                </div>
                                {/* Desktop Table */}
                                <table className="hidden md:table w-full">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Nhà cung cấp</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Liên hệ</th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Công nợ</th>
                                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {suppliersWithDebt.map(supplier => (
                                            <tr key={supplier.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 font-medium">{supplier.name}</td>
                                                <td className="px-4 py-3 text-gray-600">{supplier.phone || supplier.contact_person || '---'}</td>
                                                <td className="px-4 py-3 text-right font-bold text-amber-500">{formatVND(supplier.debt_balance)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => { setSelectedSupplier(supplier); setShowPaymentModal(true); }}
                                                        className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium"
                                                    >💳 Trả tiền</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>
                )}

                {/* Payment History */}
                <div style={{ marginTop: '24px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>📜 Lịch sử thanh toán gần đây</h3>
                    {payments.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '24px' }}>Chưa có lịch sử thanh toán</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {payments.slice(0, 10).map((payment) => {
                                const customerName = customers.find(c => c.id === payment.customer_id)?.name;
                                const supplierName = suppliers.find(s => s.id === payment.supplier_id)?.name;
                                return (
                                    <div key={payment.id} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '12px',
                                        backgroundColor: '#f9fafb',
                                        borderRadius: '8px'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 500 }}>
                                                {payment.payment_type === 'customer' ? '👤' : '🏭'} {customerName || supplierName}
                                            </div>
                                            <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                                {formatDate(payment.created_at)} • {payment.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 600, color: '#22c55e' }}>+{formatVND(payment.amount)}</div>
                                            <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                                                {formatVND(payment.debt_before)} → {formatVND(payment.debt_after)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && (selectedCustomer || selectedSupplier) && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 50
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        padding: '24px',
                        width: '90%',
                        maxWidth: '400px',
                        boxShadow: '0 20px 25px rgba(0,0,0,0.15)'
                    }}>
                        <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 'bold' }}>
                            {selectedCustomer ? '💵 Thu tiền công nợ' : '💳 Trả tiền nhà cung cấp'}
                        </h2>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                                {selectedCustomer ? 'Khách hàng' : 'Nhà cung cấp'}
                            </label>
                            <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', fontWeight: 600 }}>
                                {selectedCustomer?.name || selectedSupplier?.name}
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Công nợ hiện tại</label>
                            <div style={{
                                padding: '12px',
                                backgroundColor: '#fef2f2',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                color: '#ef4444',
                                fontSize: '20px'
                            }}>
                                {formatVND(selectedCustomer?.debt_balance || selectedSupplier?.debt_balance || 0)}
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Số tiền thanh toán</label>
                            <input
                                type="number"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                placeholder="Nhập số tiền"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid #e5e7eb',
                                    fontSize: '16px',
                                    boxSizing: 'border-box'
                                }}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button
                                    onClick={() => setPaymentAmount(String((selectedCustomer?.debt_balance || selectedSupplier?.debt_balance || 0) / 2))}
                                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb', backgroundColor: 'white', cursor: 'pointer' }}
                                >
                                    50%
                                </button>
                                <button
                                    onClick={() => setPaymentAmount(String(selectedCustomer?.debt_balance || selectedSupplier?.debt_balance || 0))}
                                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb', backgroundColor: 'white', cursor: 'pointer' }}
                                >
                                    Tất cả
                                </button>
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Phương thức thanh toán</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => setPaymentMethod('cash')}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: paymentMethod === 'cash' ? '2px solid #22c55e' : '1px solid #e5e7eb',
                                        backgroundColor: paymentMethod === 'cash' ? '#f0fdf4' : 'white',
                                        cursor: 'pointer',
                                        fontWeight: 500
                                    }}
                                >
                                    💵 Tiền mặt
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('transfer')}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: paymentMethod === 'transfer' ? '2px solid #22c55e' : '1px solid #e5e7eb',
                                        backgroundColor: paymentMethod === 'transfer' ? '#f0fdf4' : 'white',
                                        cursor: 'pointer',
                                        fontWeight: 500
                                    }}
                                >
                                    🏦 Chuyển khoản
                                </button>
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Ghi chú</label>
                            <input
                                type="text"
                                value={paymentNotes}
                                onChange={(e) => setPaymentNotes(e.target.value)}
                                placeholder="Ghi chú (tùy chọn)"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid #e5e7eb',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => {
                                    setShowPaymentModal(false);
                                    setPaymentAmount('');
                                    setPaymentNotes('');
                                    setSelectedCustomer(null);
                                    setSelectedSupplier(null);
                                }}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid #e5e7eb',
                                    backgroundColor: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={selectedCustomer ? handleCustomerPayment : handleSupplierPayment}
                                disabled={!paymentAmount || Number(paymentAmount) <= 0}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: '#22c55e',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    opacity: !paymentAmount || Number(paymentAmount) <= 0 ? 0.5 : 1
                                }}
                            >
                                ✓ Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Debt Detail Modal */}
            {showDebtDetailModal && detailCustomer && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 50
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        padding: '24px',
                        width: '95%',
                        maxWidth: '600px',
                        maxHeight: '80vh',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 20px 25px rgba(0,0,0,0.15)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                                📋 Chi tiết công nợ - {detailCustomer.name}
                            </h2>
                            <button
                                onClick={() => { setShowDebtDetailModal(false); setDetailCustomer(null); }}
                                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}
                            >×</button>
                        </div>

                        <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '8px' }}>
                            <div style={{ fontSize: '14px', color: '#666' }}>Tổng công nợ hiện tại</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>{formatVND(detailCustomer.debt_balance)}</div>
                        </div>

                        <div style={{ fontWeight: 600, marginBottom: '8px' }}>Đơn hàng chưa thanh toán hết:</div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {(() => {
                                const unpaidOrders = orders.filter(o =>
                                    o.customer_id === detailCustomer.id &&
                                    o.debt_amount > 0 &&
                                    (o.remaining_debt === undefined || o.remaining_debt > 0)
                                );
                                if (unpaidOrders.length === 0) {
                                    return (
                                        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '24px' }}>
                                            Không có đơn hàng chưa thanh toán
                                        </div>
                                    );
                                }
                                return unpaidOrders.map(order => (
                                    <div key={order.id} style={{
                                        padding: '12px',
                                        marginBottom: '8px',
                                        backgroundColor: '#f9fafb',
                                        borderRadius: '8px',
                                        border: '1px solid #e5e7eb'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#22c55e' }}>{order.order_number}</div>
                                                <div style={{ fontSize: '12px', color: '#6b7280' }}>{formatDate(order.created_at)}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '12px', color: '#6b7280' }}>Còn nợ</div>
                                                <div style={{ fontWeight: 'bold', color: '#ef4444' }}>
                                                    {formatVND(order.remaining_debt ?? order.debt_amount)}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                                            Tổng đơn: {formatVND(order.total_amount)} • Đã trả: {formatVND(order.paid_amount || 0)}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>

                        <div style={{ fontWeight: 600, marginTop: '16px', marginBottom: '8px' }}>Lịch sử thanh toán:</div>
                        <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                            {(() => {
                                const customerPayments = getCustomerPayments(detailCustomer.id);
                                if (customerPayments.length === 0) {
                                    return (
                                        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '16px' }}>
                                            Chưa có lịch sử thanh toán
                                        </div>
                                    );
                                }
                                return customerPayments.slice(0, 10).map(p => (
                                    <div key={p.id} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: '8px',
                                        backgroundColor: '#f0fdf4',
                                        borderRadius: '6px',
                                        marginBottom: '4px'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '13px' }}>{formatDate(p.created_at)}</div>
                                            <div style={{ fontSize: '11px', color: '#6b7280' }}>{p.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</div>
                                        </div>
                                        <div style={{ fontWeight: 600, color: '#22c55e' }}>+{formatVND(p.amount)}</div>
                                    </div>
                                ));
                            })()}
                        </div>

                        <button
                            onClick={() => {
                                setShowDebtDetailModal(false);
                                setSelectedCustomer(detailCustomer);
                                setShowPaymentModal(true);
                            }}
                            style={{
                                marginTop: '16px',
                                width: '100%',
                                padding: '12px',
                                backgroundColor: '#22c55e',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >💵 Thu tiền ngay</button>
                    </div>
                </div>
            )}
        </div>
    );
}
