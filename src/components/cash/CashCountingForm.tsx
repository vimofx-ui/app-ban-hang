// =============================================================================
// CASH COUNTING FORM COMPONENT
// A form for counting cash by denominations
// =============================================================================

import { useState, useCallback, useMemo } from 'react';
import type { CashDetails, CashDenomination } from '@/types';
import {
    createEmptyCashDetails,
    updateDenomination,
    formatVND,
    formatNumber,
    validateCashCount,
} from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';

interface CashCountingFormProps {
    initialValues?: CashDetails;
    onValueChange?: (details: CashDetails) => void;
    disabled?: boolean;
    title?: string;
    className?: string;
}

export function CashCountingForm({
    initialValues,
    onValueChange,
    disabled = false,
    title = 'Đếm tiền mặt',
    className,
}: CashCountingFormProps) {
    const [cashDetails, setCashDetails] = useState<CashDetails>(
        initialValues || createEmptyCashDetails()
    );

    const handleQuantityChange = useCallback(
        (denominationValue: number, value: string) => {
            const quantity = parseInt(value, 10) || 0;
            const updated = updateDenomination(cashDetails, denominationValue, quantity);
            setCashDetails(updated);
            onValueChange?.(updated);
        },
        [cashDetails, onValueChange]
    );

    const handleIncrement = useCallback(
        (denominationValue: number) => {
            const current = cashDetails.denominations.find(d => d.value === denominationValue);
            if (current) {
                const updated = updateDenomination(cashDetails, denominationValue, current.quantity + 1);
                setCashDetails(updated);
                onValueChange?.(updated);
            }
        },
        [cashDetails, onValueChange]
    );

    const handleDecrement = useCallback(
        (denominationValue: number) => {
            const current = cashDetails.denominations.find(d => d.value === denominationValue);
            if (current && current.quantity > 0) {
                const updated = updateDenomination(cashDetails, denominationValue, current.quantity - 1);
                setCashDetails(updated);
                onValueChange?.(updated);
            }
        },
        [cashDetails, onValueChange]
    );

    const handleClear = useCallback(() => {
        const empty = createEmptyCashDetails();
        setCashDetails(empty);
        onValueChange?.(empty);
    }, [onValueChange]);

    const validation = useMemo(
        () => validateCashCount(cashDetails.denominations),
        [cashDetails.denominations]
    );

    return (
        <div className={cn('rounded-xl border border-gray-200 bg-white p-6 shadow-sm', className)}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <button
                    type="button"
                    onClick={handleClear}
                    disabled={disabled}
                    className="text-sm text-gray-500 hover:text-gray-700 hover:underline disabled:opacity-50"
                >
                    Xóa tất cả
                </button>
            </div>

            {/* Denomination inputs */}
            <div className="space-y-3">
                {cashDetails.denominations.map((denom) => (
                    <DenominationRow
                        key={denom.value}
                        denomination={denom}
                        disabled={disabled}
                        onQuantityChange={(value) => handleQuantityChange(denom.value, value)}
                        onIncrement={() => handleIncrement(denom.value)}
                        onDecrement={() => handleDecrement(denom.value)}
                    />
                ))}
            </div>

            {/* Total */}
            <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                    <span className="text-lg font-medium text-gray-600">Tổng cộng:</span>
                    <span className="text-2xl font-bold text-primary">
                        {formatVND(cashDetails.total)}
                    </span>
                </div>
            </div>

            {/* Validation errors */}
            {!validation.valid && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                    <ul className="text-sm text-red-600 space-y-1">
                        {validation.errors.map((error, idx) => (
                            <li key={idx}>{error}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// Denomination Row Sub-component
// =============================================================================

interface DenominationRowProps {
    denomination: CashDenomination;
    disabled: boolean;
    onQuantityChange: (value: string) => void;
    onIncrement: () => void;
    onDecrement: () => void;
}

function DenominationRow({
    denomination,
    disabled,
    onQuantityChange,
    onIncrement,
    onDecrement,
}: DenominationRowProps) {
    const subtotal = denomination.value * denomination.quantity;

    return (
        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
            {/* Denomination label */}
            <div className="w-24 shrink-0">
                <span className="font-medium text-gray-900 text-sm">{denomination.name}</span>
            </div>

            {/* Quantity controls */}
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={onDecrement}
                    disabled={disabled || denomination.quantity <= 0}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Giảm số lượng"
                >
                    <MinusIcon />
                </button>

                <input
                    type="number"
                    value={denomination.quantity}
                    onChange={(e) => onQuantityChange(e.target.value)}
                    disabled={disabled}
                    className="w-16 h-8 text-center font-medium border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:bg-gray-100 text-sm"
                    min="0"
                    aria-label={`Số lượng ${denomination.name}`}
                />

                <button
                    type="button"
                    onClick={onIncrement}
                    disabled={disabled}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Tăng số lượng"
                >
                    <PlusIcon />
                </button>
            </div>

            {/* Subtotal */}
            <div className="flex-1 text-right">
                <span className={cn(
                    'font-medium text-sm',
                    subtotal > 0 ? 'text-gray-900' : 'text-gray-400'
                )}>
                    {subtotal > 0 ? formatNumber(subtotal) : '-'}
                </span>
            </div>
        </div>
    );
}

// =============================================================================
// Icons
// =============================================================================

function PlusIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    );
}

function MinusIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    );
}

export default CashCountingForm;
