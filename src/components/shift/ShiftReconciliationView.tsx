
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useShiftStore } from '@/stores/shiftStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { useUserStore } from '@/stores/userStore';
import { CashCountingForm } from '@/components/cash/CashCountingForm';
import type { CashDetails } from '@/types';
import {
    createEmptyCashDetails,
    calculateReconciliation,
    formatVND,
} from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { ImageUploader } from '@/components/products/ProductLink';

interface SummaryRowProps {
    label: string;
    value: number;
    positive?: boolean;
    negative?: boolean;
    highlight?: boolean;
}

function SummaryRow({ label, value, positive, negative, highlight }: SummaryRowProps) {
    return (
        <div className="flex justify-between items-center">
            <span className={cn('text-gray-600', highlight && 'font-medium text-gray-900')}>
                {label}
            </span>
            <span className={cn(
                'font-medium',
                positive && 'text-green-600',
                negative && 'text-red-600',
                highlight && 'text-lg font-bold text-gray-900',
                !positive && !negative && !highlight && 'text-gray-900'
            )}>
                {negative && '-'}
                {formatVND(value)}
            </span>
        </div>
    );
}

function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function CheckIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    );
}

function SpinnerIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    );
}

interface ShiftReconciliationViewProps {
    onSuccess: () => void;
    onCancel: () => void;
}

export function ShiftReconciliationView({ onSuccess, onCancel }: ShiftReconciliationViewProps) {
    const { currentShift, clockOut, updateShiftTotals } = useShiftStore();
    const { shift: shiftSettings } = useSettingsStore();
    const { user: authUser } = useAuthStore();
    const { users, fetchUsers } = useUserStore();

    const [closingCashDetails, setClosingCashDetails] = useState<CashDetails>(
        createEmptyCashDetails()
    );
    const [closingBankBalance, setClosingBankBalance] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [handoverTo, setHandoverTo] = useState('');

    // Instead of local expense state management which was somewhat duplicated, we just read expenses for total
    // We assume expense management is done in Dashboard. Here is final verification.

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showReconciliationResult, setShowReconciliationResult] = useState(false);
    const [manualEndTime, setManualEndTime] = useState<string>('');

    // Save shift data before clockOut clears it
    const [savedShiftData, setSavedShiftData] = useState<any>(null);
    const [savedReconciliation, setSavedReconciliation] = useState<any>(null);

    // Permission Check
    const isAdmin = authUser?.role === 'admin';
    const canViewRevenue = isAdmin || shiftSettings?.showRevenueInReconciliation;
    const canViewDiscrepancy = isAdmin || shiftSettings?.showDiscrepancyInReconciliation;

    // Initialize
    useEffect(() => {
        const now = new Date();
        const iso = now.toLocaleString('sv').replace(' ', 'T').slice(0, 16);
        setManualEndTime(iso);
        fetchUsers();
    }, [fetchUsers]);

    // Recalculate Logic
    const reconciliation = useMemo(() => {
        if (!currentShift) return null;

        const totalShiftExpenses = currentShift.total_expenses || 0;

        const cashRec = calculateReconciliation(
            currentShift.opening_cash,
            currentShift.total_cash_sales,
            totalShiftExpenses,
            closingCashDetails.total
        );

        // Bank Reconciliation
        const bankExpected = (currentShift.opening_bank_balance || 0) + (currentShift.total_transfer_sales || 0);
        const bankActual = parseInt(closingBankBalance.replace(/\D/g, '') || '0', 10);
        const bankDiscrepancy = bankActual - bankExpected;

        return {
            ...cashRec,
            bankExpected,
            bankActual,
            bankDiscrepancy,
            finalTotalExpenses: totalShiftExpenses
        };
    }, [currentShift, closingCashDetails.total, closingBankBalance]);

    const handleCashDetailsChange = useCallback((details: CashDetails) => {
        setClosingCashDetails(details);
    }, []);

    const handleAddClosingImage = (url: string) => {
        if (!url) return;
        setClosingCashDetails((prev: any) => ({
            ...prev,
            imgUrls: [...(prev.imgUrls || []), url]
        }));
    };

    const handleRemoveClosingImage = (index: number) => {
        setClosingCashDetails((prev: any) => ({
            ...prev,
            imgUrls: (prev.imgUrls || []).filter((_: any, i: number) => i !== index)
        }));
    };

    const handleConfirmSubmit = async () => {
        if (!reconciliation || !currentShift) return;
        setIsSubmitting(true);

        // Save data before clockOut clears currentShift
        setSavedShiftData({ ...currentShift });
        setSavedReconciliation({ ...reconciliation });

        let finalEndTime = new Date().toISOString();
        if (shiftSettings?.mode === 'manual' && manualEndTime) {
            finalEndTime = new Date(manualEndTime).toISOString();
        }

        const finalDetails = { ...closingCashDetails, handoverTo };

        await clockOut(
            finalDetails.total,
            finalDetails,
            reconciliation.bankActual,
            notes,
            finalEndTime,
            reconciliation.finalTotalExpenses
        );

        setIsSubmitting(false);
        setShowConfirmModal(false);
        setShowReconciliationResult(true); // Show result modal after confirmation
    };

    const handleCloseReconciliationResult = () => {
        setShowReconciliationResult(false);
        onSuccess();
    };

    // Allow result modal to render even after shift is closed
    if (!currentShift && !showReconciliationResult) return null;

    return (
        <div className="h-full bg-gray-50 flex flex-col text-sm">
            {/* Only show header if we have currentShift (not after shift closed) */}
            {currentShift && (
                <header className="bg-white border-b border-gray-200 py-3 px-4 sticky top-0 z-10 flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">Kết ca làm việc</h1>
                        <p className="text-xs text-gray-500">
                            {currentShift?.user_id} • Vào ca lúc {formatTime(currentShift?.clock_in)}
                        </p>
                    </div>
                    <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">Đóng</button>
                </header>
            )}

            {/* Main content - only show when shift exists (before close) */}
            {currentShift && (
                <main className="flex-1 overflow-y-auto p-4">
                    <div className="grid lg:grid-cols-12 gap-4">
                        {/* Left Column */}
                        <div className="lg:col-span-5 space-y-3">
                            {shiftSettings?.mode === 'manual' && (
                                <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Thời gian kết ca</h3>
                                    <div className="flex gap-2 items-center">
                                        <select
                                            value={manualEndTime ? new Date(manualEndTime).getHours() : 0}
                                            onChange={(e) => {
                                                const d = new Date(manualEndTime);
                                                d.setHours(parseInt(e.target.value));
                                                setManualEndTime(d.toLocaleString('sv').replace(' ', 'T').slice(0, 16));
                                            }}
                                            className="flex-1 px-2 py-1.5 rounded-lg border text-center text-sm"
                                        >
                                            {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>)}
                                        </select>
                                        <span>:</span>
                                        <select
                                            value={manualEndTime ? new Date(manualEndTime).getMinutes() : 0}
                                            onChange={(e) => {
                                                const d = new Date(manualEndTime);
                                                d.setMinutes(parseInt(e.target.value));
                                                setManualEndTime(d.toLocaleString('sv').replace(' ', 'T').slice(0, 16));
                                            }}
                                            className="flex-1 px-2 py-1.5 rounded-lg border text-center text-sm"
                                        >
                                            {Array.from({ length: 60 }, (_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            <CashCountingForm
                                title="Đếm tiền trong két"
                                onValueChange={handleCashDetailsChange}
                                initialValues={closingCashDetails}
                                className="scale-[0.95] origin-top-left w-[105%] p-3"
                            />
                        </div>

                        {/* Right Column */}
                        <div className="lg:col-span-7 space-y-3">
                            {/* Summary & Bank Logic from Reconcile Page */}
                            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Nhân viên kết ca</label>
                                    <input value={authUser?.name || ''} disabled className="w-full px-3 py-2 rounded-lg border bg-gray-100 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Bàn giao tiền cho</label>
                                    <input
                                        list="staff-list-recon"
                                        value={handoverTo}
                                        onChange={(e) => setHandoverTo(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                                        placeholder="Nhập hoặc chọn tên..."
                                    />
                                    <datalist id="staff-list-recon">
                                        {users && users.map((u: any) => <option key={u.id} value={u.full_name || u.email}>{u.email}</option>)}
                                    </datalist>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                                <h3 className="text-sm font-semibold text-gray-900 mb-2">Tổng kết doanh thu & Chi phí</h3>
                                {canViewRevenue && reconciliation ? (
                                    <div className="space-y-1.5 text-xs">
                                        <SummaryRow label="Tiền mặt bán hàng" value={currentShift?.total_cash_sales || 0} positive />
                                        <SummaryRow label="Chuyển khoản" value={currentShift?.total_transfer_sales || 0} positive />
                                        <SummaryRow label="Chi phí trong ca" value={reconciliation.finalTotalExpenses || 0} positive />
                                        <SummaryRow label="Thực tế (Tiền + Bank + Chi)" value={(reconciliation.actual_cash || 0) + (reconciliation.bankActual || 0) + (reconciliation.finalTotalExpenses || 0)} highlight />
                                    </div>
                                ) : (
                                    <div className="p-3 bg-gray-50 border text-center text-gray-500 italic text-xs">Đã ẩn doanh thu</div>
                                )}
                            </div>

                            {/* Bank Check */}
                            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                                <h3 className="text-sm font-semibold text-gray-900 mb-2">Đối soát Tài khoản Ngân hàng</h3>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Tiền TK cuối ca (Thực tế)</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={closingBankBalance ? Number(closingBankBalance).toLocaleString('vi-VN') : ''}
                                        onChange={(e) => setClosingBankBalance(e.target.value.replace(/\D/g, ''))}
                                        className="w-full pl-3 pr-8 py-2 rounded-lg border font-mono text-base"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-3 top-2.5 text-gray-500 font-medium text-sm">đ</span>
                                </div>
                            </div>

                            {/* Images & Notes - Stacked for better mobile/compact view */}
                            <div className="space-y-3">
                                <div className="bg-white p-3 rounded-xl border">
                                    <label className="block text-xs font-medium text-gray-700 mb-2">Ảnh tài khoản & Chứng từ</label>
                                    <div className="flex flex-wrap gap-2">
                                        {closingCashDetails.imgUrls?.map((url: string, idx: number) => (
                                            <div key={idx} className="relative group">
                                                <img src={url} className="w-12 h-12 rounded object-cover border" onClick={() => window.open(url)} />
                                                <button
                                                    onClick={() => handleRemoveClosingImage(idx)}
                                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                        {/* Make Uploader larger and more visible */}
                                        <div className="w-12 h-12">
                                            <ImageUploader
                                                value=""
                                                onChange={handleAddClosingImage}
                                                style={{ width: '100%', height: '100%', padding: 0 }}
                                                showCamera
                                                multiple
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white p-3 rounded-xl border">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Ghi chú kết ca</label>
                                    <textarea
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        placeholder="Nhập ghi chú chi tiết..."
                                        className="w-full h-12 min-h-[48px] p-2 border rounded-lg resize-none text-xs focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {/* Validation Warning */}
                            {!handoverTo && (
                                <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>⚠️</span>
                                    <span style={{ fontSize: '13px', color: '#92400e' }}>Vui lòng nhập <strong>Bàn giao tiền cho</strong> trước khi xác nhận</span>
                                </div>
                            )}

                            <button
                                onClick={() => setShowConfirmModal(true)}
                                disabled={isSubmitting || !handoverTo.trim()}
                                className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Xem lại & Xác nhận
                            </button>
                        </div>
                    </div>
                </main>
            )}

            {/* Enhanced Confirm Modal with Discrepancy Calculation */}
            {showConfirmModal && reconciliation && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'grid', placeItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: '16px', overflowY: 'auto' }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '24px', margin: '16px 0' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '16px', textAlign: 'center' }}>
                            📊 Xác nhận kết ca
                        </h3>

                        {/* Cash Summary */}
                        <div style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>💵 Tiền mặt</h4>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                                <span style={{ color: '#6b7280' }}>Đầu ca:</span>
                                <span style={{ fontWeight: 500 }}>{formatVND(currentShift?.opening_cash || 0)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                                <span style={{ color: '#6b7280' }}>Doanh thu tiền mặt:</span>
                                <span style={{ fontWeight: 500, color: '#16a34a' }}>+{formatVND(currentShift?.total_cash_sales || 0)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px dashed #d1d5db', fontSize: '14px' }}>
                                <span style={{ fontWeight: 600 }}>Thực tế trong két:</span>
                                <span style={{ fontWeight: 'bold', color: '#111827' }}>{formatVND(closingCashDetails.total)}</span>
                            </div>
                        </div>

                        {/* Bank Summary */}
                        <div style={{ backgroundColor: '#eff6ff', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#1e40af', marginBottom: '12px' }}>🏦 Tài khoản ngân hàng</h4>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                                <span style={{ color: '#6b7280' }}>Đầu ca:</span>
                                <span style={{ fontWeight: 500 }}>{formatVND(currentShift?.opening_bank_balance || 0)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                                <span style={{ color: '#6b7280' }}>Chuyển khoản:</span>
                                <span style={{ fontWeight: 500, color: '#16a34a' }}>+{formatVND(currentShift?.total_transfer_sales || 0)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px dashed #93c5fd', fontSize: '14px' }}>
                                <span style={{ fontWeight: 600 }}>Thực tế TK:</span>
                                <span style={{ fontWeight: 'bold', color: '#1e40af' }}>{formatVND(reconciliation.bankActual)}</span>
                            </div>
                        </div>

                        {/* Expenses */}
                        <div style={{ backgroundColor: '#fef3c7', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>📤 Chi phí trong ca (Lấy từ két)</h4>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                <span style={{ color: '#92400e' }}>Tổng chi:</span>
                                <span style={{ fontWeight: 'bold', color: '#dc2626' }}>-{formatVND(reconciliation.finalTotalExpenses)}</span>
                            </div>
                        </div>

                        {/* Handover Info */}
                        {handoverTo && (
                            <div style={{ backgroundColor: '#f3e8ff', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#7c3aed', marginBottom: '8px' }}>🤝 Bàn giao</h4>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                    <span style={{ color: '#6b7280' }}>Bàn giao cho:</span>
                                    <span style={{ fontWeight: 'bold', color: '#7c3aed' }}>{handoverTo}</span>
                                </div>
                            </div>
                        )}


                        {/* Discrepancy section removed - will show AFTER confirmation */}

                        {/* Notes */}
                        {notes && (
                            <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>📝 Ghi chú:</p>
                                <p style={{ fontSize: '13px', color: '#374151' }}>{notes}</p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                style={{ flex: 1, padding: '14px', backgroundColor: '#f3f4f6', color: '#374151', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
                            >
                                ← Quay lại
                            </button>
                            <button
                                onClick={handleConfirmSubmit}
                                disabled={isSubmitting}
                                style={{ flex: 1, padding: '14px', backgroundColor: '#22c55e', color: 'white', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', opacity: isSubmitting ? 0.7 : 1 }}
                            >
                                {isSubmitting ? '⏳ Đang xử lý...' : '✓ Xác nhận kết ca'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reconciliation Result Modal - Shows AFTER confirmation */}
            {showReconciliationResult && savedReconciliation && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto', padding: '24px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center' }}>
                            ✅ Kết ca thành công
                        </h3>

                        {/* Discrepancy Calculation - Only show if allowed */}
                        {canViewDiscrepancy && (() => {
                            const totalActualCash = closingCashDetails.total;
                            const totalActualBank = savedReconciliation.bankActual;
                            const totalExpenses = savedReconciliation.finalTotalExpenses;
                            const openingCash = savedShiftData?.opening_cash || 0;
                            const openingBank = savedShiftData?.opening_bank_balance || 0;
                            const totalRevenue = (savedShiftData?.total_cash_sales || 0) + (savedShiftData?.total_transfer_sales || 0);

                            // New formula: (Closing Cash + Closing Bank + Expenses) - (Opening Cash + Opening Bank + Revenue)
                            const discrepancy = (totalActualCash + totalActualBank + totalExpenses) - (openingCash + openingBank + totalRevenue);

                            const isSurplus = discrepancy > 0;
                            const isDeficit = discrepancy < 0;
                            const isBalanced = discrepancy === 0;

                            return (
                                <div style={{ backgroundColor: '#ecfdf5', borderRadius: '12px', padding: '16px', marginBottom: '16px', border: '2px solid #10b981' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#047857', marginBottom: '12px' }}>📈 Đối soát kết ca</h4>

                                    {/* Closing Cash */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                                        <span style={{ color: '#374151', fontWeight: 500 }}>Tiền mặt kê khai (trong két):</span>
                                        <span style={{ fontWeight: 600 }}>{formatVND(totalActualCash)}</span>
                                    </div>

                                    {/* Closing Bank */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                                        <span style={{ color: '#374151', fontWeight: 500 }}>Tài khoản cuối ca:</span>
                                        <span style={{ fontWeight: 600 }}>{formatVND(totalActualBank)}</span>
                                    </div>

                                    {/* Expenses */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                                        <span style={{ color: '#374151', fontWeight: 500 }}>+ Chi phí (lấy từ két):</span>
                                        <span style={{ fontWeight: 600, color: '#dc2626' }}>{formatVND(totalExpenses)}</span>
                                    </div>

                                    <div style={{ borderTop: '1px dashed #d1d5db', marginTop: '8px', paddingTop: '8px' }}>
                                        {/* Opening Cash */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                                            <span style={{ color: '#374151', fontWeight: 500 }}>− Tiền mặt đầu ca:</span>
                                            <span style={{ fontWeight: 600 }}>{formatVND(openingCash)}</span>
                                        </div>

                                        {/* Opening Bank */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                                            <span style={{ color: '#374151', fontWeight: 500 }}>− Tài khoản đầu ca:</span>
                                            <span style={{ fontWeight: 600 }}>{formatVND(openingBank)}</span>
                                        </div>

                                        {/* Revenue - Permission controlled */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                                            <span style={{ color: '#374151', fontWeight: 500 }}>− Doanh số trong ca:</span>
                                            {canViewRevenue ? (
                                                <span style={{ fontWeight: 600, color: '#16a34a' }}>{formatVND(totalRevenue)}</span>
                                            ) : (
                                                <span style={{ fontWeight: 500, color: '#9ca3af', fontStyle: 'italic' }}>🔒 Ẩn</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Discrepancy Result - Always visible */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        paddingTop: '12px',
                                        borderTop: '2px solid #10b981',
                                        fontSize: '16px',
                                        marginTop: '8px'
                                    }}>
                                        <span style={{ fontWeight: 'bold' }}>
                                            {isBalanced ? '✅ Cân bằng' : isSurplus ? '📈 Thừa tiền' : '📉 Thiếu tiền'}
                                        </span>
                                        <span style={{
                                            fontWeight: 'bold',
                                            color: isBalanced ? '#047857' : isSurplus ? '#2563eb' : '#dc2626',
                                            fontSize: '20px'
                                        }}>
                                            {isBalanced ? '0 đ' : `${isSurplus ? '+' : ''}${formatVND(discrepancy)}`}
                                        </span>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Handover Info */}
                        {handoverTo && (
                            <div style={{ backgroundColor: '#f3e8ff', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#7c3aed', marginBottom: '8px' }}>🤝 Bàn giao</h4>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                    <span style={{ color: '#6b7280' }}>Bàn giao cho:</span>
                                    <span style={{ fontWeight: 'bold', color: '#7c3aed' }}>{handoverTo}</span>
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        {notes && (
                            <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>📝 Ghi chú:</p>
                                <p style={{ fontSize: '13px', color: '#374151' }}>{notes}</p>
                            </div>
                        )}

                        {/* Permission notice */}
                        {!isAdmin && (
                            <div style={{ backgroundColor: '#fef3c7', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>🔒</span>
                                <span style={{ fontSize: '13px', color: '#92400e' }}>Dữ liệu kết ca đã được lưu. Chỉ Admin mới có thể chỉnh sửa.</span>
                            </div>
                        )}

                        {/* Close Button */}
                        <button
                            onClick={handleCloseReconciliationResult}
                            style={{ width: '100%', padding: '14px', backgroundColor: '#22c55e', color: 'white', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
