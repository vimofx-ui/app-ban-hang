// =============================================================================
// CASH RECONCILIATION LOGIC
// Core algorithm for shift cash counting and discrepancy detection
// =============================================================================

import type { CashDenomination, CashDetails, ReconciliationResult, ReconciliationStatus } from '@/types';

// VND Cash denominations (without 500đ as requested)
export const VND_DENOMINATIONS: Omit<CashDenomination, 'quantity'>[] = [
    { value: 500000, name: '500.000đ' },
    { value: 200000, name: '200.000đ' },
    { value: 100000, name: '100.000đ' },
    { value: 50000, name: '50.000đ' },
    { value: 20000, name: '20.000đ' },
    { value: 10000, name: '10.000đ' },
    { value: 5000, name: '5.000đ' },
    { value: 2000, name: '2.000đ' },
    { value: 1000, name: '1.000đ' },
];

/**
 * Creates an empty cash details structure with all denominations set to 0
 */
export function createEmptyCashDetails(): CashDetails {
    return {
        denominations: VND_DENOMINATIONS.map(d => ({ ...d, quantity: 0 })),
        total: 0,
    };
}

/**
 * Calculates the total cash from denomination counts
 */
export function calculateCashTotal(denominations: CashDenomination[]): number {
    return denominations.reduce((total, d) => total + d.value * d.quantity, 0);
}

/**
 * Updates denomination quantity and recalculates total
 */
export function updateDenomination(
    cashDetails: CashDetails,
    denominationValue: number,
    quantity: number
): CashDetails {
    const updatedDenominations = cashDetails.denominations.map(d =>
        d.value === denominationValue ? { ...d, quantity: Math.max(0, quantity) } : d
    );

    return {
        denominations: updatedDenominations,
        total: calculateCashTotal(updatedDenominations),
    };
}

/**
 * Core reconciliation algorithm
 * 
 * Formula:
 *   Expected Cash = Opening Cash + Cash Sales - Cash Expenses
 *   Discrepancy = Actual Counted Cash - Expected Cash
 *   
 * Status:
 *   - EXACT: Discrepancy is 0
 *   - SHORT: Discrepancy is negative (missing cash)
 *   - OVER: Discrepancy is positive (excess cash)
 */
export function calculateReconciliation(
    openingCash: number,
    totalCashSales: number,
    totalCashExpenses: number,
    actualCountedCash: number
): ReconciliationResult {
    // Calculate expected cash in drawer
    const expectedCash = openingCash + totalCashSales - totalCashExpenses;

    // Calculate discrepancy
    const discrepancy = actualCountedCash - expectedCash;

    // Determine status
    let status: ReconciliationStatus;
    if (discrepancy === 0) {
        status = 'exact';
    } else if (discrepancy < 0) {
        status = 'short';
    } else {
        status = 'over';
    }

    return {
        opening_cash: openingCash,
        total_cash_sales: totalCashSales,
        total_expenses: totalCashExpenses,
        expected_cash: expectedCash,
        actual_cash: actualCountedCash,
        discrepancy,
        status,
    };
}

/**
 * Formats a number as VND currency
 */
export function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * Formats a number with thousand separators
 */
export function formatNumber(amount: number): string {
    return new Intl.NumberFormat('vi-VN').format(amount);
}

/**
 * Parses a formatted number string back to number
 */
export function parseFormattedNumber(value: string): number {
    // Remove all non-digit characters except minus sign
    const cleaned = value.replace(/[^\d-]/g, '');
    return parseInt(cleaned, 10) || 0;
}

/**
 * Gets the color class based on reconciliation status
 */
export function getReconciliationStatusColor(status: ReconciliationStatus): string {
    switch (status) {
        case 'exact':
            return 'text-green-600 bg-green-50 border-green-200';
        case 'short':
            return 'text-red-600 bg-red-50 border-red-200';
        case 'over':
            return 'text-amber-600 bg-amber-50 border-amber-200';
        default:
            return 'text-gray-600 bg-gray-50 border-gray-200';
    }
}

/**
 * Gets the label for reconciliation status
 */
export function getReconciliationStatusLabel(status: ReconciliationStatus): string {
    switch (status) {
        case 'exact':
            return 'Khớp tiền';
        case 'short':
            return 'Thiếu tiền';
        case 'over':
            return 'Thừa tiền';
        case 'pending':
            return 'Chờ kiểm tra';
        default:
            return 'Không xác định';
    }
}

/**
 * Validates cash count - ensures all quantities are non-negative integers
 */
export function validateCashCount(denominations: CashDenomination[]): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    for (const d of denominations) {
        if (d.quantity < 0) {
            errors.push(`Số lượng ${d.name} không thể âm`);
        }
        if (!Number.isInteger(d.quantity)) {
            errors.push(`Số lượng ${d.name} phải là số nguyên`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Generates a summary string for cash details
 */
export function generateCashSummary(cashDetails: CashDetails): string {
    const nonZero = cashDetails.denominations.filter(d => d.quantity > 0);

    if (nonZero.length === 0) {
        return 'Không có tiền mặt';
    }

    return nonZero
        .map(d => `${d.quantity} x ${d.name}`)
        .join(', ');
}
