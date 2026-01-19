import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useDebtStore } from '@/stores/debtStore';
import { formatVND } from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';
import type { Customer, Order, TransactionType } from '@/types';
import { OrderDetailsModal } from '@/components/orders/OrderDetailsModal';
import { CreateTransactionModal } from '@/components/cash/CreateTransactionModal';
import { PointsHistoryModal } from '@/components/customers/PointsHistoryModal';
import { useCustomerStore } from '@/stores/customerStore';

interface CustomerDetailsViewProps {
    customer: Customer;
    onBack: () => void;
    onEdit: (customer: Customer) => void;
    onDelete: (id: string) => void;
}

export function CustomerDetailsView({ customer, onBack, onEdit, onDelete }: CustomerDetailsViewProps) {
    const [activeTab, setActiveTab] = useState<'history' | 'debt' | 'contact'>('history');
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({
        lastPurchaseDate: '---',
        totalItemsPurchased: 0,
        totalReturns: 0
    });
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showPointsModal, setShowPointsModal] = useState(false);
    const [paymentTargetOrder, setPaymentTargetOrder] = useState<Order | undefined>(undefined);
    const [refreshKey, setRefreshKey] = useState(0); // Force re-render after updates

    const { updateCustomer } = useCustomerStore();

    useEffect(() => {
        if (!customer.id) return;

        async function fetchHistory() {
            setLoading(true);
            try {
                let fetchedOrders: Order[] = [];

                // 1. Try Supabase
                if (supabase) {
                    const { data: orderData, error } = await supabase
                        .from('orders')
                        .select('*, order_items(*)')
                        .eq('customer_id', customer.id)
                        .order('created_at', { ascending: false });

                    if (!error && orderData) {
                        fetchedOrders = orderData as Order[];
                    }
                }

                // 2. Merge with Offline/Local Store orders (Demo mode)
                const { orders: storeOrders } = await import('@/stores/orderStore').then(m => m.useOrderStore.getState());
                const localOrders = storeOrders.filter(o => o.customer_id === customer.id);

                // Deduplicate by ID
                const orderMap = new Map<string, Order>();
                fetchedOrders.forEach(o => orderMap.set(o.id, o));
                localOrders.forEach(o => orderMap.set(o.id, o)); // Local matches overwrite fetched (usually newer)

                let allOrders = Array.from(orderMap.values());

                // 3. Fallback: If NO orders found, but Customer has stats (Mock Data), generate fake orders
                if (allOrders.length === 0 && (customer.total_orders > 0 || customer.total_spent > 0)) {
                    console.log('Generating mock orders for customer:', customer.id);
                    // Generate mock orders to match the stats
                    const avgValue = customer.total_spent / (customer.total_orders || 1);
                    for (let i = 0; i < (customer.total_orders || 5); i++) {
                        const date = new Date();
                        date.setDate(date.getDate() - i * 3); // Spread out every 3 days

                        // Alternate statuses
                        const status = i === 0 ? 'pending' : 'completed';
                        const debt = status === 'pending' ? avgValue : 0;

                        allOrders.push({
                            id: `mock-order-${i}-${customer.id}`,
                            order_number: `ORD-MOCK-${1000 + i}`,
                            customer_id: customer.id,
                            shift_id: 'shift-1',
                            status: status as any,
                            total_amount: avgValue,
                            final_amount: avgValue,
                            subtotal: avgValue,
                            discount_amount: 0,
                            discount_percent: 0,
                            points_used: 0,
                            points_discount: 0,
                            tax_amount: 0,
                            paid_amount: status === 'completed' ? avgValue : 0,
                            cash_received: status === 'completed' ? avgValue : 0,
                            change_amount: 0,
                            transfer_amount: 0,
                            card_amount: 0,
                            debt_amount: debt,
                            payment_method: 'cash',
                            provisional_printed: false,
                            receipt_printed: false,
                            created_at: date.toISOString(),
                            order_items: [], // Empty items for mock
                        } as Order);
                    }
                }

                // Sort by date desc
                allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                setOrders(allOrders);

                // Calculate Stats
                if (allOrders.length > 0) {
                    const lastOrder = allOrders[0];

                    // Tính tổng SL sản phẩm đã mua từ order_items
                    let totalItems = 0;
                    let totalReturns = 0;
                    allOrders.forEach(order => {
                        if (order.order_items && Array.isArray(order.order_items)) {
                            order.order_items.forEach((item: any) => {
                                totalItems += (item.quantity || 0);
                            });
                        }
                        if (order.status === 'returned') {
                            totalReturns += 1;
                        }
                    });

                    setStats({
                        lastPurchaseDate: new Date(lastOrder.created_at).toLocaleDateString('vi-VN'),
                        totalItemsPurchased: totalItems,
                        totalReturns: totalReturns
                    });
                }

            } catch (err) {
                console.error("Error loading customer history:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchHistory();
    }, [customer.id, customer.total_orders, refreshKey]);

    const handleOrderPayment = (order: Order) => {
        setPaymentTargetOrder(order);
        setShowPaymentModal(true);
        // Close order modal to show payment modal clearly, or keep it open?
        // Let's close Order Modal to avoid z-index stacking issues for now, or keep it if z-index managed.
        // Better: Close Order Modal.
        setSelectedOrder(null);
    };

    const handlePaymentSuccess = async (amount: number, type: TransactionType, isAccounting: boolean, notes: string) => {
        // 1. Update Customer Debt
        const newDebt = Math.max(0, customer.debt_balance - amount);
        await updateCustomer(customer.id, { debt_balance: newDebt });

        // 2. Update Order Status if linked
        if (paymentTargetOrder) {
            const currentPaid = paymentTargetOrder.paid_amount || 0;
            const newPaid = currentPaid + amount;
            const total = paymentTargetOrder.total_amount;
            const remaining = Math.max(0, paymentTargetOrder.debt_amount - newPaid); // Simplified logic

            // Determine status
            let newStatus: 'paid' | 'partially_paid' | 'unpaid' = 'unpaid';
            if (remaining <= 0) newStatus = 'paid';
            else if (newPaid > 0) newStatus = 'partially_paid';

            // We need to update the Order in DB/Store.
            // Using the newly implemented updateOrder method
            import('@/stores/orderStore').then(({ useOrderStore }) => {
                useOrderStore.getState().updateOrder(paymentTargetOrder.id, {
                    paid_amount: newPaid,
                    remaining_debt: remaining,
                    payment_status: newStatus
                });
            });

            // For immediate UI update (Legacy DebtStore sync)
            useDebtStore.getState().addPayment({
                payment_type: 'customer',
                customer_id: customer.id,
                order_id: paymentTargetOrder.id,
                amount: amount,
                payment_method: 'cash',
                debt_before: customer.debt_balance,
                debt_after: newDebt,
                notes: notes
            });
        } else {
            // General Payment
            useDebtStore.getState().addPayment({
                payment_type: 'customer',
                customer_id: customer.id,
                amount: amount,
                payment_method: 'cash',
                debt_before: customer.debt_balance,
                debt_after: newDebt,
                notes: notes
            });
        }

        // Refresh
        setRefreshKey(k => k + 1);
        // Also update the local customer prop to reflect immediate change if parent doesn't re-render
        // (But parent passed customer, so we need parent to refresh? updateCustomer updates store, which should trigger re-render if observed)
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
                    <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => onDelete(customer.id)}
                        className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                    >
                        Xóa khách hàng
                    </button>
                    <button
                        onClick={() => { setPaymentTargetOrder(undefined); setShowPaymentModal(true); }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors"
                    >
                        Tạo phiếu thu
                    </button>
                </div>
            </header>

            <main className="container-app py-6 space-y-6">

                {/* Info Cards Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* 1. Personal Info */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800">Thông tin cá nhân</h3>
                            <button onClick={() => onEdit(customer)} className="text-blue-600 text-sm font-medium hover:underline">Cập nhật</button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                            <InfoRow label="Ngày sinh" value={customer.date_of_birth ? new Date(customer.date_of_birth).toLocaleDateString('vi-VN') : '---'} />
                            <InfoRow label="Nhóm khách hàng" value="Bán lẻ" cssValue="text-blue-600 font-medium" />
                            <InfoRow label="Giới tính" value={customer.gender === 'male' ? 'Nam' : customer.gender === 'female' ? 'Nữ' : '---'} />
                            <InfoRow label="Mã khách hàng" value={customer.code || '---'} />
                            <InfoRow label="Số điện thoại" value={customer.phone || '---'} />
                            <InfoRow label="Mã số thuế" value="---" />
                            <InfoRow label="Email" value={customer.email || '---'} />
                            <InfoRow label="Website" value="---" />
                            <InfoRow label="Nhân viên phụ trách" value="Admin" />
                            <InfoRow label="Mô tả" value={customer.notes || '---'} />
                        </div>
                    </div>

                    {/* 2. Selling Info / Points */}
                    <div className="space-y-6">
                        {/* Buying Info */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-800">Thông tin mua hàng</h3>
                                <button className="text-blue-600 text-sm font-medium hover:underline">Chi tiết</button>
                            </div>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                <InfoRow label="Tổng chi tiêu" value={formatVND(customer.total_spent || 0)} cssValue="font-bold text-gray-900" />
                                <InfoRow label="Tổng SL sản phẩm đã mua" value={stats.totalItemsPurchased.toString()} />
                                <InfoRow label="Tổng SL đơn hàng" value={(customer.total_orders || 0).toString()} />
                                <InfoRow label="Tổng SL sản phẩm hoàn trả" value={stats.totalReturns.toString()} />
                                <InfoRow label="Ngày cuối cùng mua hàng" value={stats.lastPurchaseDate} />
                                <InfoRow label="Công nợ hiện tại" value={formatVND(customer.debt_balance || 0)} cssValue="font-bold text-red-600" />
                            </div>
                        </div>

                        {/* Loyalty Info */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-800">Thông tin tích điểm</h3>
                                <button
                                    onClick={() => setShowPointsModal(true)}
                                    className="text-blue-600 text-sm font-medium hover:underline"
                                >
                                    Chi tiết
                                </button>
                            </div>
                            <div className="text-sm space-y-3">
                                <InfoRow label="Điểm hiện tại" value={(customer.points_balance || 0).toString()} cssValue="font-bold text-green-600" />
                                <InfoRow label="Hạng thẻ hiện tại" value="Thành viên" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Tabs Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="border-b px-6 flex gap-6 overflow-x-auto">
                        <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} label="Lịch sử mua hàng" />
                        <TabButton active={activeTab === 'debt'} onClick={() => setActiveTab('debt')} label="Công nợ" />
                        <TabButton active={activeTab === 'contact'} onClick={() => setActiveTab('contact')} label="Liên hệ" />
                    </div>

                    <div className="p-0">
                        {activeTab === 'history' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 border-b text-gray-500 font-medium">
                                        <tr>
                                            <th className="px-6 py-3">Mã đơn hàng</th>
                                            <th className="px-6 py-3">Trạng thái</th>
                                            <th className="px-6 py-3 text-center">Thanh toán</th>
                                            <th className="px-6 py-3 text-center">Xuất kho</th>
                                            <th className="px-6 py-3 text-right">Giá trị</th>
                                            <th className="px-6 py-3 text-right">Ngày ghi nhận</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {loading ? (
                                            <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Đang tải lịch sử...</td></tr>
                                        ) : orders.length === 0 ? (
                                            <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Chưa có giao dịch nào</td></tr>
                                        ) : (
                                            orders.map(order => (
                                                <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                                                    <td className="px-6 py-3 font-medium text-blue-600">{order.order_number}</td>
                                                    <td className="px-6 py-3">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded-full text-xs font-bold",
                                                            order.status === 'completed' ? "bg-green-100 text-green-700" :
                                                                order.status === 'returned' ? "bg-yellow-100 text-yellow-700" :
                                                                    "bg-gray-100 text-gray-700"
                                                        )}>
                                                            {order.status === 'completed' ? 'Hoàn thành' :
                                                                order.status === 'returned' ? 'Đã trả hàng' : order.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 text-center">●</td>
                                                    <td className="px-6 py-3 text-center">●</td>
                                                    <td className="px-6 py-3 text-right font-medium">{formatVND(order.total_amount)}</td>
                                                    <td className="px-6 py-3 text-right text-gray-500">{new Date(order.created_at).toLocaleString('vi-VN')}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {activeTab === 'debt' && (
                            <DebtTabContent customer={customer} orders={orders} onOrderClick={setSelectedOrder} />
                        )}
                        {activeTab === 'contact' && (
                            <div className="p-8 text-center text-gray-500">
                                Thông tin liên hệ chi tiết
                            </div>
                        )}
                    </div>
                </div>

            </main>

            {selectedOrder && (
                <OrderDetailsModal
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    onPayment={handleOrderPayment}
                />
            )}

            <CreateTransactionModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                defaultType="income"
                targetId={customer.id}
                targetName={customer.name}
                targetKind="customer"
                referenceId={paymentTargetOrder?.id}
                referenceType={paymentTargetOrder ? 'order' : undefined}
                onSuccess={handlePaymentSuccess}
            />

            <PointsHistoryModal
                customer={customer}
                isOpen={showPointsModal}
                onClose={() => setShowPointsModal(false)}
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

// Debt Tab Content Component
function DebtTabContent({ customer, orders, onOrderClick }: { customer: Customer; orders: Order[], onOrderClick: (order: Order) => void }) {
    const { getCustomerPayments } = useDebtStore();
    const payments = getCustomerPayments(customer.id);

    // Get debt orders (orders with debt_amount > 0)
    const debtOrders = orders.filter(o => o.debt_amount > 0 || o.payment_method === 'debt');

    return (
        <div className="p-6 space-y-6">
            {/* Debt Summary */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-red-50 rounded-lg p-4 text-center">
                    <div className="text-sm text-red-600">Công nợ hiện tại</div>
                    <div className="text-2xl font-bold text-red-700">{formatVND(customer.debt_balance)}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-sm text-blue-600">Đơn nợ</div>
                    <div className="text-2xl font-bold text-blue-700">{debtOrders.length}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-sm text-green-600">Đã thanh toán</div>
                    <div className="text-2xl font-bold text-green-700">
                        {formatVND(payments.reduce((sum, p) => sum + p.amount, 0))}
                    </div>
                </div>
            </div>

            {/* Debt Orders */}
            {debtOrders.length > 0 && (
                <div>
                    <h4 className="font-bold text-gray-800 mb-3">Đơn hàng ghi nợ</h4>
                    <div className="space-y-2">
                        {debtOrders.map(order => (
                            <div key={order.id} className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100 cursor-pointer hover:bg-red-100 transition-colors" onClick={() => onOrderClick(order)}>
                                <div>
                                    <span className="font-medium text-gray-800">{order.order_number}</span>
                                    <span className="text-sm text-gray-500 ml-2">
                                        {new Date(order.created_at).toLocaleString('vi-VN')}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-red-600">{formatVND(order.debt_amount || order.total_amount)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Payment History */}
            <div>
                <h4 className="font-bold text-gray-800 mb-3">Lịch sử thanh toán</h4>
                {payments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        Chưa có lịch sử thanh toán
                    </div>
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
                                    {payment.notes && (
                                        <p className="text-xs text-gray-500 mt-1">{payment.notes}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-green-600">+{formatVND(payment.amount)}</div>
                                    <div className="text-xs text-gray-500">
                                        {formatVND(payment.debt_before)} → {formatVND(payment.debt_after)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
