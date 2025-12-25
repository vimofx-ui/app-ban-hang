import { useState, useEffect } from 'react';

import { useCashFlowStore } from '@/stores/cashFlowStore';
import { formatVND } from '@/lib/cashReconciliation';
import type { TransactionType } from '@/types';
import { CurrencyInput } from '@/components/common/CurrencyInput';

interface CreateTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    // Context
    defaultType?: TransactionType;
    targetId?: string;
    targetName?: string;
    targetKind?: 'customer' | 'supplier' | 'other';
    referenceId?: string; // e.g. Order ID
    referenceType?: string; // 'order' | 'debt_payment'

    // Callback to handle specific business logic (e.g. updating debt)
    onSuccess?: (amount: number, type: TransactionType, isAccounting: boolean, notes: string) => void;
}

export function CreateTransactionModal({
    isOpen,
    onClose,
    defaultType = 'income',
    targetId,
    targetName,
    targetKind,
    referenceId,
    referenceType,
    onSuccess
}: CreateTransactionModalProps) {
    const { addTransaction } = useCashFlowStore();

    const [type, setType] = useState<TransactionType>(defaultType);
    const [amount, setAmount] = useState<number>(0);
    const [notes, setNotes] = useState('');
    const [isAccounting, setIsAccounting] = useState(true);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setType(defaultType);
            setAmount(0);
            setNotes(referenceType === 'order' ? `Thanh toán cho đơn ${referenceId || ''}` : '');
            setIsAccounting(true);
            setDate(new Date().toISOString().split('T')[0]);
        }
    }, [isOpen, defaultType, referenceId, referenceType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = amount;
        if (numAmount <= 0) return;

        setIsSubmitting(true);
        try {
            // 1. Add to Ledger
            await addTransaction({
                transaction_number: `TX-${Date.now()}`, // Simple ID generation
                type,
                amount: numAmount,
                payment_method: 'cash', // Default to cash for now, enhance later
                transaction_date: date,
                description: notes,
                is_accounting: isAccounting,
                target_name: targetName,
                reference_id: referenceId,
                reference_type: referenceType,
                category_id: undefined // TODO: Add category selection
            });

            // 2. Trigger Callback
            if (onSuccess) {
                onSuccess(numAmount, type, isAccounting, notes);
            }

            onClose();
        } catch (err) {
            console.error('Failed to create transaction:', err);
            alert('Có lỗi xảy ra khi tạo phiếu');
        } finally {
            setIsSubmitting(false);
        }
    };



    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-[90vw] md:w-[500px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-bold text-gray-800">
                        {type === 'income' ? 'Tạo Phiếu Thu' : 'Tạo Phiếu Chi'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* Type Toggle */}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            type="button"
                            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${type === 'income' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setType('income')}
                        >
                            Thu tiền (+ Income)
                        </button>
                        <button
                            type="button"
                            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${type === 'expense' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setType('expense')}
                        >
                            Chi tiền (- Expense)
                        </button>
                    </div>

                    {/* Target Info */}
                    {targetName && (
                        <div className="text-sm bg-blue-50 text-blue-800 px-3 py-2 rounded-lg">
                            Đối tượng: <strong>{targetName}</strong> ({targetKind === 'customer' ? 'Khách hàng' : 'NCC'})
                        </div>
                    )}

                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền</label>
                        <div className="relative">
                            <CurrencyInput
                                value={amount}
                                onValueChange={setAmount}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 ring-blue-500 outline-none text-lg font-bold"
                                placeholder="0"
                                autoFocus
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">VNĐ</span>
                        </div>
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ngày chứng từ</label>
                        <input
                            type="date"
                            required
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 ring-blue-500 outline-none"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Diễn giải</label>
                        <textarea
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 ring-blue-500 outline-none text-sm"
                            placeholder="Nhập ghi chú..."
                        />
                    </div>

                    {/* Accounting Option */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isBooking"
                            checked={isAccounting}
                            onChange={(e) => setIsAccounting(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded"
                        />
                        <label htmlFor="isBooking" className="text-sm text-gray-700">
                            Hạch toán vào kết quả kinh doanh (Tính lãi lỗ)
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`flex-1 px-4 py-2 rounded-lg text-white font-bold shadow-sm transition-colors ${type === 'income' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                        >
                            {isSubmitting ? 'Đang xử lý...' : (type === 'income' ? 'Lập Phiếu Thu' : 'Lập Phiếu Chi')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
