// =============================================================================
// DEBT MANAGEMENT PAGE - Customer & Supplier Debt Tracking
// =============================================================================

import { useState, useEffect } from 'react';
import { useCustomerStore } from '@/stores/customerStore';
import { useSupplierStore } from '@/stores/supplierStore';
import { useDebtStore } from '@/stores/debtStore';
import { useOrderStore } from '@/stores/orderStore';
import type { Customer, Supplier, DebtPayment, Order } from '@/types';

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
        addPayment({
            payment_type: 'customer',
            customer_id: selectedCustomer.id,
            amount,
            payment_method: paymentMethod,
            debt_before: selectedCustomer.debt_balance,
            debt_after: Math.max(0, selectedCustomer.debt_balance - amount),
            notes: paymentNotes,
        });

        // Update customer debt
        await payCustomerDebt(selectedCustomer.id, amount);

        // Reset form
        setShowPaymentModal(false);
        setPaymentAmount('');
        setPaymentNotes('');
        setSelectedCustomer(null);
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
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        {customersWithDebt.length === 0 ? (
                            <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
                                <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                                <div>Không có khách hàng nào còn nợ</div>
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Khách hàng</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>SĐT</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Công nợ</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customersWithDebt.map(customer => (
                                        <tr key={customer.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                            <td style={{ padding: '12px 16px', fontWeight: 500 }}>{customer.name}</td>
                                            <td style={{ padding: '12px 16px', color: '#6b7280' }}>{customer.phone || '---'}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>
                                                {formatVND(customer.debt_balance)}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => {
                                                        setSelectedCustomer(customer);
                                                        setShowPaymentModal(true);
                                                    }}
                                                    style={{
                                                        padding: '8px 16px',
                                                        borderRadius: '6px',
                                                        border: 'none',
                                                        backgroundColor: '#22c55e',
                                                        color: 'white',
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    💵 Thu tiền
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                ) : (
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        {suppliersWithDebt.length === 0 ? (
                            <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
                                <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                                <div>Không có nhà cung cấp nào còn nợ</div>
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Nhà cung cấp</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Liên hệ</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Công nợ</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suppliersWithDebt.map(supplier => (
                                        <tr key={supplier.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                            <td style={{ padding: '12px 16px', fontWeight: 500 }}>{supplier.name}</td>
                                            <td style={{ padding: '12px 16px', color: '#6b7280' }}>{supplier.phone || supplier.contact_person || '---'}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#f59e0b' }}>
                                                {formatVND(supplier.debt_balance)}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => {
                                                        setSelectedSupplier(supplier);
                                                        setShowPaymentModal(true);
                                                    }}
                                                    style={{
                                                        padding: '8px 16px',
                                                        borderRadius: '6px',
                                                        border: 'none',
                                                        backgroundColor: '#f59e0b',
                                                        color: 'white',
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    💳 Trả tiền
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
        </div>
    );
}
