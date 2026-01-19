// =============================================================================
// CUSTOMER POINTS HISTORY MODAL - Lịch sử tích điểm/đổi điểm của khách hàng
// =============================================================================

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatVND } from '@/lib/cashReconciliation';
import type { Customer } from '@/types';

interface PointsHistoryModalProps {
    customer: Customer;
    isOpen: boolean;
    onClose: () => void;
}

interface PointTransaction {
    id: string;
    type: 'earned' | 'redeemed' | 'adjustment';
    amount: number;
    balance_after: number;
    order_id?: string;
    order_number?: string;
    description?: string;
    created_at: string;
}

export function PointsHistoryModal({ customer, isOpen, onClose }: PointsHistoryModalProps) {
    const [transactions, setTransactions] = useState<PointTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && customer.id) {
            loadPointsHistory();
        }
    }, [isOpen, customer.id]);

    const loadPointsHistory = async () => {
        setIsLoading(true);
        try {
            // Try to load from database
            if (supabase) {
                const { data: orders, error } = await supabase
                    .from('orders')
                    .select('id, order_number, points_used, total_amount, created_at')
                    .eq('customer_id', customer.id)
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (!error && orders) {
                    // Convert orders to point transactions
                    let runningBalance = customer.points_balance || 0;
                    const txns: PointTransaction[] = [];

                    // Sort by created_at descending to calculate running balance correctly
                    orders.forEach(order => {
                        // Points used (redemption)
                        if (order.points_used && order.points_used > 0) {
                            txns.push({
                                id: `redeem-${order.id}`,
                                type: 'redeemed',
                                amount: -order.points_used,
                                balance_after: runningBalance,
                                order_id: order.id,
                                order_number: order.order_number,
                                description: `Đổi điểm cho đơn ${order.order_number}`,
                                created_at: order.created_at
                            });
                            runningBalance += order.points_used; // Add back to get previous balance
                        }

                        // Points earned (1% of total_amount)
                        const earnedPoints = Math.floor((order.total_amount || 0) / 100);
                        if (earnedPoints > 0) {
                            txns.push({
                                id: `earn-${order.id}`,
                                type: 'earned',
                                amount: earnedPoints,
                                balance_after: runningBalance,
                                order_id: order.id,
                                order_number: order.order_number,
                                description: `Tích điểm từ đơn ${order.order_number}`,
                                created_at: order.created_at
                            });
                            runningBalance -= earnedPoints; // Subtract to get previous balance
                        }
                    });

                    setTransactions(txns);
                }
            } else {
                // Demo mode - generate fake history
                const demoTxns: PointTransaction[] = [
                    {
                        id: '1',
                        type: 'earned',
                        amount: 44,
                        balance_after: customer.points_balance || 0,
                        order_number: 'DH289924',
                        description: 'Tích điểm từ đơn DH289924',
                        created_at: new Date().toISOString()
                    }
                ];
                setTransactions(demoTxns);
            }
        } catch (err) {
            console.error('Error loading points history:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]">
            <div className="bg-white rounded-2xl shadow-xl w-[90vw] md:w-[600px] max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">Lịch sử điểm thưởng</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Khách hàng: <span className="font-medium text-gray-800">{customer.name}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="p-6 border-b grid grid-cols-3 gap-4">
                    <div className="bg-green-50 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                            {customer.points_balance || 0}
                        </div>
                        <div className="text-sm text-green-700">Điểm hiện có</div>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">
                            {transactions.filter(t => t.type === 'earned').reduce((sum, t) => sum + t.amount, 0)}
                        </div>
                        <div className="text-sm text-blue-700">Đã tích lũy</div>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600">
                            {Math.abs(transactions.filter(t => t.type === 'redeemed').reduce((sum, t) => sum + t.amount, 0))}
                        </div>
                        <div className="text-sm text-orange-700">Đã đổi</div>
                    </div>
                </div>

                {/* Transaction List */}
                <div className="flex-1 overflow-y-auto p-6">
                    <h3 className="font-semibold text-gray-800 mb-4">Lịch sử giao dịch</h3>

                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Đang tải...</div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            Chưa có lịch sử tích điểm
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {transactions.map(txn => (
                                <div
                                    key={txn.id}
                                    className={`p-4 rounded-xl border ${txn.type === 'earned'
                                            ? 'bg-green-50 border-green-100'
                                            : txn.type === 'redeemed'
                                                ? 'bg-orange-50 border-orange-100'
                                                : 'bg-gray-50 border-gray-100'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-lg ${txn.type === 'earned' ? 'text-green-600' : 'text-orange-600'
                                                    }`}>
                                                    {txn.type === 'earned' ? '🎁' : '🔥'}
                                                </span>
                                                <span className="font-medium text-gray-800">
                                                    {txn.type === 'earned' ? 'Tích điểm' : 'Đổi điểm'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500 mt-1">{txn.description}</p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {new Date(txn.created_at).toLocaleString('vi-VN')}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-lg font-bold ${txn.amount > 0 ? 'text-green-600' : 'text-orange-600'
                                                }`}>
                                                {txn.amount > 0 ? '+' : ''}{txn.amount}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                Số dư: {txn.balance_after}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50">
                    <p className="text-xs text-gray-500 text-center">
                        💡 Tích 1 điểm cho mỗi 100đ chi tiêu • 1 điểm = 1đ khi đổi
                    </p>
                </div>
            </div>
        </div>
    );
}
