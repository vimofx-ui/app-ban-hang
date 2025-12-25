import { useState, useCallback, useEffect } from 'react';
import { useShiftStore } from '@/stores/shiftStore';
import { useAuthStore } from '@/stores/authStore';
import { useUserStore } from '@/stores/userStore';
import { supabase } from '@/lib/supabase';
import { formatVND } from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';
import type { Shift } from '@/types';

// =============================================================================
// SUB-COMPONENTS (Previously in ShiftPage.tsx)
// =============================================================================

function StatCard({ label, value, color, highlight }: any) {
    const colors: any = {
        blue: 'bg-blue-50 text-blue-900 border-blue-100',
        green: 'bg-green-50 text-green-900 border-green-100',
        purple: 'bg-purple-50 text-purple-900 border-purple-100',
        amber: 'bg-amber-50 text-amber-900 border-amber-100',
        emerald: 'bg-emerald-50 text-emerald-900 border-emerald-100',
        red: 'bg-red-50 text-red-900 border-red-100',
        cyan: 'bg-cyan-50 text-cyan-900 border-cyan-100',
    };

    return (
        <div className={cn("p-6 rounded-2xl border", colors[color], highlight && "shadow-md ring-1 ring-amber-200")}>
            <p className="text-sm opacity-70 mb-1">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
        </div>
    );
}

const MOCK_ORDERS = [
    { id: 'DH001', total_amount: 150000, created_at: new Date().toISOString(), status: 'completed' },
    { id: 'DH002', total_amount: 500000, created_at: new Date(Date.now() - 86400000).toISOString(), status: 'pending' },
    { id: 'DH003', total_amount: 1200000, created_at: new Date(Date.now() - 172800000).toISOString(), status: 'completed' },
];

export function ActiveShiftDashboard({ shift, onEndShift }: { shift: Shift, onEndShift: () => void }) {
    const { updateShiftTotals, currentUser } = useShiftStore();
    const { hasPermission } = useUserStore();
    const { user: authUser } = useAuthStore();
    const { total_cash_sales, total_transfer_sales, total_card_sales, total_debt_sales, total_point_sales, opening_cash, total_expenses, opening_bank_balance } = shift;

    // Expense State
    const [expenses, setExpenses] = useState<any[]>([]);
    const [expenseForm, setExpenseForm] = useState({ type: 'other', amount: '', note: '' });
    const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [addError, setAddError] = useState<string | null>(null);

    // Fetch recent orders when type is 'order'
    useEffect(() => {
        if (expenseForm.type === 'order') {
            const fetchRecentOrders = async () => {
                if (!supabase) {
                    console.warn('Supabase missing, using MOCK orders');
                    setRecentOrders(MOCK_ORDERS);
                    return;
                }

                console.log('Fetching purchase orders (Simplified)...');
                const { data, error } = await supabase
                    .from('purchase_orders')
                    .select('id, total_amount, created_at, status')
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (error) {
                    console.error('Error fetching orders:', error);
                    setAddError(`Lỗi tải đơn hàng: ${error.message}`);
                }
                if (data) setRecentOrders(data);
            };
            fetchRecentOrders();
        }
    }, [expenseForm.type]);

    const canManageExpenses = authUser?.role === 'admin' || authUser?.id === shift.user_id;

    // Load Expenses
    const loadExpenses = useCallback(async () => {
        if (!supabase) return;
        setExpenses([]);
        const { data } = await supabase
            .from('transactions')
            .select('*')
            .eq('shift_id', shift.id)
            .eq('type', 'expense')
            .order('created_at', { ascending: false });

        if (data) setExpenses(data);
    }, [shift.id]);

    useEffect(() => {
        loadExpenses();
    }, [shift.id, loadExpenses]);

    const handleNoteChange = (val: string) => {
        setExpenseForm(prev => ({ ...prev, note: val }));
    };

    const handleAddExpense = async () => {
        setAddError(null);

        if (!shift?.id) {
            setAddError('Lỗi: Không tìm thấy thông tin ca làm việc.');
            return;
        }
        if (!expenseForm.amount) {
            setAddError('Vui lòng nhập số tiền');
            return;
        }

        if (!supabase) {
            setAddError('Lỗi kết nối Database.');
            return;
        }

        setIsLoadingExpenses(true);
        const amount = parseInt(expenseForm.amount.replace(/\D/g, ''), 10);

        try {
            // 1. Create Transaction
            const { error: txError } = await supabase.from('transactions').insert({
                id: crypto.randomUUID(),
                shift_id: shift.id,
                type: 'expense',
                amount: amount,
                payment_method: 'cash',
                notes: expenseForm.note,
                category: expenseForm.type,
                created_at: new Date().toISOString(),
                created_by: authUser?.id
            });
            if (txError) throw txError;

            // 2. Update Shift Total in DB
            const newTotal = (shift.total_expenses || 0) + amount;
            const { error: shiftError } = await supabase
                .from('shifts')
                .update({ total_expenses: newTotal })
                .eq('id', shift.id);
            if (shiftError) throw shiftError;

            // 3. Update Local State
            updateShiftTotals({ total_expenses: newTotal });
            loadExpenses();
            setExpenseForm({ type: 'other', amount: '', note: '' });
            setAddError(null);
        } catch (err: any) {
            console.error(err);
            setAddError(err.message || 'Lỗi lưu chi phí!');
        } finally {
            setIsLoadingExpenses(false);
        }
    };

    const handleRemoveExpense = async (id: string, amount: number) => {
        if (!supabase) return;

        setIsLoadingExpenses(true);
        try {
            const { error: txError } = await supabase.from('transactions').delete().eq('id', id);
            if (txError) throw new Error(`DB Delete Error: ${txError.message}`);

            const { data: remainingOps, error: countError } = await supabase
                .from('transactions')
                .select('amount')
                .eq('shift_id', shift.id)
                .eq('type', 'expense');

            if (countError) throw new Error(`Recalc Error: ${countError.message}`);

            const newTotal = remainingOps?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;

            const { error: shiftError } = await supabase
                .from('shifts')
                .update({ total_expenses: newTotal })
                .eq('id', shift.id);

            if (shiftError) throw new Error(`Shift Update Error: ${shiftError.message}`);

            updateShiftTotals({ total_expenses: newTotal });
            loadExpenses();
        } catch (err: any) {
            console.error('FULL DELETE ERROR:', err);
            alert(`Lỗi xóa chi phí chi tiết: ${err.message}`);
        } finally {
            setIsLoadingExpenses(false);
        }
    };

    const handleUpdateExpense = async (id: string, updates: any) => {
        console.log('Update expense', id, updates);
    };

    return (
        <div className="h-full bg-gray-50 flex flex-col text-sm">
            {/* Minimal Header */}
            <header className="bg-white border-b py-3 px-4 flex-shrink-0">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">Ca làm việc</h1>
                        <p className="text-gray-500 text-xs">Vào ca: {new Date(shift.clock_in).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <span className="px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium text-xs">● Đang hoạt động</span>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Row 1: Opening Balances & Current Total */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <StatCard label="Tiền mặt đầu ca" value={formatVND(opening_cash)} color="blue" />
                    <StatCard label="Tiền tài khoản đầu ca" value={formatVND(opening_bank_balance || 0)} color="cyan" />
                    {hasPermission(currentUser as any, 'pos_view_revenue') ? (
                        <StatCard
                            label="Tổng tiền mặt hiện tại"
                            value={formatVND(opening_cash + total_cash_sales - expenses.reduce((sum, e) => sum + Number(e.amount), 0))}
                            color="amber"
                            highlight
                        />
                    ) : (
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center justify-center text-gray-400 italic text-xs">
                            Đã ẩn tổng tiền
                        </div>
                    )}
                </div>

                {hasPermission(currentUser as any, 'pos_view_revenue') && (
                    /* Row 2: Sales */
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <StatCard label="Tổng điểm" value={formatVND(total_point_sales || 0)} color="red" />
                        <StatCard label="Doanh thu tiền mặt" value={formatVND(total_cash_sales)} color="green" />
                        <StatCard label="Doanh thu chuyển khoản" value={formatVND(total_transfer_sales)} color="purple" />
                        <StatCard label="Tổng doanh thu" value={formatVND((total_cash_sales || 0) + (total_transfer_sales || 0) + (total_card_sales || 0) + (total_debt_sales || 0) + (total_point_sales || 0))} color="emerald" />
                    </div>
                )}

                {canManageExpenses && (
                    <div className="mt-4">
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                            <div className="space-y-3 bg-white p-3 rounded-xl border border-gray-200">
                                <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                                    💸 Ghi nhận chi tiền (Lấy từ két)
                                    <span className="text-[10px] font-normal text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Tự động lưu</span>
                                </h3>

                                {/* Expenses List */}
                                {expenses.map((e: any) => (
                                    <div key={e.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-white p-1 rounded-lg items-center">
                                        <div className="md:col-span-3">
                                            <select
                                                value={e.category || 'other'}
                                                onChange={(ev) => handleUpdateExpense(e.id, { category: ev.target.value })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary text-xs font-medium bg-gray-50"
                                            >
                                                <option value="other">Khác</option>
                                                <option value="order">Trả tiền đơn</option>
                                                <option value="handover">Đưa tiền</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-3">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={Number(e.amount).toLocaleString('vi-VN')}
                                                    readOnly
                                                    className="w-full pl-3 pr-8 py-2 rounded-lg border border-gray-300 bg-gray-50 font-bold text-gray-900 text-xs"
                                                />
                                                <span className="absolute right-3 top-2 text-gray-500 text-[10px] font-medium">đ</span>
                                            </div>
                                        </div>
                                        <div className="md:col-span-5">
                                            <input
                                                type="text"
                                                value={e.notes || ''}
                                                readOnly
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-xs"
                                            />
                                        </div>
                                        <div className="md:col-span-1 flex items-center justify-center">
                                            <button
                                                type="button"
                                                onClick={(ev) => {
                                                    ev.preventDefault();
                                                    if (confirm('Xóa khoản chi này?')) {
                                                        handleRemoveExpense(e.id, e.amount);
                                                    }
                                                }}
                                                className="w-full h-8 px-2 bg-white border border-red-200 text-red-600 rounded hover:bg-red-50 font-bold text-[10px] uppercase shadow-sm"
                                            >
                                                XÓA
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* New Expense Form */}
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-blue-50/50 p-2 rounded-xl border border-blue-100 items-center">
                                    <div className="md:col-span-3">
                                        <select
                                            value={expenseForm.type}
                                            onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary text-xs font-medium"
                                        >
                                            <option value="other">Khác</option>
                                            <option value="order">Trả tiền đơn</option>
                                            <option value="handover">Đưa tiền</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-3">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={expenseForm.amount ? Number(expenseForm.amount).toLocaleString('vi-VN') : ''}
                                                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value.replace(/\D/g, '') })}
                                                placeholder="Số tiền"
                                                className="w-full pl-3 pr-8 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary font-bold text-gray-900 text-xs"
                                            />
                                            <span className="absolute right-3 top-2 text-gray-500 text-[10px] font-medium">đ</span>
                                        </div>
                                    </div>
                                    <div className="md:col-span-5">
                                        <input
                                            type="text"
                                            list={expenseForm.type === 'order' ? "recent-orders-list" : undefined}
                                            value={expenseForm.note}
                                            onChange={(e) => handleNoteChange(e.target.value)}
                                            placeholder={expenseForm.type === 'order' ? "Nhập hoặc chọn đơn hàng..." : "Ghi chú..."}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary text-xs"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleAddExpense();
                                            }}
                                        />
                                        {expenseForm.type === 'order' && (
                                            <datalist id="recent-orders-list">
                                                {recentOrders.map(order => (
                                                    <option key={order.id} value={`${order.id} - ${new Intl.NumberFormat('vi-VN').format(order.total_amount)}đ (${order.status})`}>
                                                        {new Date(order.created_at).toLocaleDateString('vi-VN')}
                                                    </option>
                                                ))}
                                                <option value="Chi phí khác (Nhập tay)" />
                                            </datalist>
                                        )}
                                    </div>
                                    <div className="md:col-span-1 relative h-8">
                                        <button
                                            onClick={handleAddExpense}
                                            disabled={isLoadingExpenses}
                                            className="w-full h-full bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 disabled:opacity-50 flex items-center justify-center text-lg shadow-sm hover:shadow active:scale-95 transition-all"
                                        >
                                            +
                                        </button>
                                        {addError && (
                                            <div className="absolute top-full right-0 mt-2 w-48 bg-red-100 text-red-600 text-[10px] p-2 rounded shadow-lg z-20 border border-red-200">
                                                {addError}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div >
                )}

                <div className="md:col-span-2 lg:col-span-4 mt-4 pb-4 text-center border-t pt-4">
                    <button
                        onClick={onEndShift}
                        className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-bold text-base shadow hover:bg-red-700 transition-transform hover:scale-105"
                    >
                        Kết thúc ca & Bàn giao
                    </button>
                    <p className="text-xs text-gray-400 mt-1">Kiểm kê tiền mặt, chốt sổ và đăng xuất</p>
                </div>
            </main >
        </div >
    );
}
