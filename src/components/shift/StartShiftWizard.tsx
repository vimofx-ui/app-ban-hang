import { useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { useUserStore } from '@/stores/userStore';
import { useShiftStore } from '@/stores/shiftStore';
import { CashCountingForm } from '@/components/cash/CashCountingForm';
import { formatVND, createEmptyCashDetails } from '@/lib/cashReconciliation';
import { ImageUploader } from '@/components/products/ProductLink';
import { cn } from '@/lib/utils';
import type { CashDetails } from '@/types';

// =============================================================================
// SUB-COMPONENTS (Previously in ShiftPage.tsx)
// =============================================================================

export function StartShiftHero({ onStart }: { onStart: () => void }) {
    return (
        <div className="h-full bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-[90vw] md:w-[450px] text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-4xl">⏱️</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Bắt đầu ca làm việc
                </h1>
                <p className="text-gray-600 mb-8">
                    Vui lòng vào ca để bắt đầu bán hàng
                </p>
                <button
                    onClick={onStart}
                    className="w-full py-4 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-primary to-primary-dark hover:shadow-lg transition-all"
                >
                    Vào ca làm việc
                </button>
            </div>
        </div>
    );
}

export function StepInit({
    staffName, setStaffName,
    manualStartTime, setManualStartTime,
    entryMode, setEntryMode,
    closedShifts, selectedPrevShiftId, setSelectedPrevShiftId,
    prevShift, settings, onNext
}: any) {
    const isGlobalManual = settings?.mode === 'manual';

    // Helper to update specific part of date time
    const updateTime = (type: 'date' | 'hour' | 'minute', val: string) => {
        const d = new Date(manualStartTime);
        if (type === 'date') {
            const [y, m, day] = val.split('-').map(Number);
            d.setFullYear(y, m - 1, day);
        } else if (type === 'hour') {
            d.setHours(parseInt(val));
        } else if (type === 'minute') {
            d.setMinutes(parseInt(val));
        }
        // Preserve local timezone format for state
        const iso = d.toLocaleString('sv').replace(' ', 'T').slice(0, 16);
        setManualStartTime(iso);
    };

    const currentReqDate = new Date(manualStartTime);
    const y = currentReqDate.getFullYear();
    const m = String(currentReqDate.getMonth() + 1).padStart(2, '0');
    const d = String(currentReqDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const hourStr = currentReqDate.getHours();
    const minStr = currentReqDate.getMinutes();

    return (
        <div className="space-y-4">
            {/* Staff Name */}
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nhân viên vào ca</label>
                <input
                    type="text"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary bg-gray-100 text-gray-500 cursor-not-allowed text-sm"
                    placeholder="Nhập tên nhân viên"
                    disabled
                />
            </div>

            {/* Time Settings (List Picker) */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <label className="block text-xs font-medium text-gray-700 mb-1">Thời gian vào ca</label>
                <div className="flex gap-2 items-center">
                    {/* Hours */}
                    <select
                        value={hourStr}
                        onChange={(e) => updateTime('hour', e.target.value)}
                        className="flex-1 px-2 py-1.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary text-center text-base font-medium"
                    >
                        {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                        ))}
                    </select>
                    <span className="font-bold text-gray-400 text-lg">:</span>
                    {/* Minutes */}
                    <select
                        value={minStr}
                        onChange={(e) => updateTime('minute', e.target.value)}
                        className="flex-1 px-2 py-1.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary text-center text-base font-medium"
                    >
                        {Array.from({ length: 60 }, (_, i) => (
                            <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                        ))}
                    </select>
                </div>
                {!isGlobalManual && (
                    <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        Đã tự động chọn giờ hiện tại.
                    </p>
                )}
            </div>

            {/* Entry Mode Selection */}
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Nguồn tiền đầu ca</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className={cn(
                        "border rounded-xl p-3 cursor-pointer transition-all relative",
                        entryMode === 'handover' ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-gray-200 hover:bg-gray-50"
                    )}>
                        <div className="flex items-center gap-2 mb-1">
                            <input
                                type="radio"
                                name="entryMode"
                                checked={entryMode === 'handover'}
                                onChange={() => setEntryMode('handover')}
                                className="w-4 h-4 text-primary"
                            />
                            <div>
                                <p className="font-semibold text-sm text-gray-900">Nhận từ ca trước</p>
                                <p className="text-[10px] text-gray-500">Kế thừa số dư cuối của ca trước</p>
                            </div>
                        </div>

                        {/* Handover Details */}
                        {entryMode === 'handover' && (
                            <div className="mt-2 pt-2 border-t border-primary/20 text-xs">
                                {closedShifts?.length > 0 ? (
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-medium text-gray-700">Chọn nhân viên bàn giao:</label>
                                        <select
                                            value={selectedPrevShiftId}
                                            onChange={(e) => setSelectedPrevShiftId(e.target.value)}
                                            className="w-full p-1.5 rounded border border-gray-300 text-xs bg-white"
                                            onClick={(e) => e.stopPropagation()} // Prevent radio click logic interference
                                        >
                                            {closedShifts.map((s: any) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.user_id} - {new Date(s.clock_out).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                </option>
                                            ))}
                                        </select>
                                        {prevShift && (
                                            <p className="text-[10px] mt-1">
                                                <strong>Số dư:</strong> {formatVND(prevShift.closing_cash || 0)}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-1.5 bg-yellow-50 text-yellow-700 text-[10px] rounded">
                                        ⚠️ Không tìm thấy ca trước đó
                                    </div>
                                )}
                            </div>
                        )}
                    </label>

                    <label className={cn(
                        "border rounded-xl p-3 cursor-pointer transition-all",
                        entryMode === 'new' ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-gray-200 hover:bg-gray-50"
                    )}>
                        <div className="flex items-center gap-2">
                            <input
                                type="radio"
                                name="entryMode"
                                checked={entryMode === 'new'}
                                onChange={() => setEntryMode('new')}
                                className="w-4 h-4 text-primary"
                            />
                            <div>
                                <p className="font-semibold text-sm text-gray-900">Nhập mới (Reset)</p>
                                <p className="text-[10px] text-gray-500">Tự nhập số tiền thực tế ban đầu</p>
                            </div>
                        </div>
                    </label>
                </div>
            </div>

            <button
                onClick={onNext}
                disabled={!staffName || (entryMode === 'handover' && !prevShift)}
                className="w-full py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
                Tiếp tục
            </button>
        </div>
    );
}

// ... (StepInit remains same)

export function StepMoney({ entryMode, details, setDetails, bankBalance, setBankBalance, startNote, setStartNote, handoverPerson, setHandoverPerson, prevShift, users, onBack, onNext }: any) {
    const handleAddImage = (url: string) => {
        if (!url) return;
        setDetails((prev: any) => ({
            ...prev,
            imgUrls: [...(prev.imgUrls || []), url]
        }));
    };

    const handleRemoveImage = (index: number) => {
        setDetails((prev: any) => ({
            ...prev,
            imgUrls: (prev.imgUrls || []).filter((_: any, i: number) => i !== index)
        }));
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full items-start">
            {/* LEFT COLUMN: Cash Counting - Increased height to show all denominations and total */}
            <div className="lg:col-span-12 xl:col-span-5 h-[650px] overflow-y-auto">
                <CashCountingForm
                    title="Bảng kê tiền mặt"
                    initialValues={details}
                    onValueChange={setDetails}
                    className="h-full border shadow-sm p-3 rounded-xl"
                />
            </div>

            {/* RIGHT COLUMN: Summary & Inputs (Expanded) */}
            <div className="lg:col-span-12 xl:col-span-7 space-y-4">
                {entryMode === 'handover' && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                        <div className="flex justify-between items-start mb-1">
                            <h3 className="text-blue-900 font-semibold text-xs">🔍 Kiểm tra bàn giao</h3>
                        </div>
                        <p className="text-[10px] text-blue-700 mb-2 leading-relaxed">
                            Dưới đây là số liệu từ ca trước (<strong>{prevShift?.user_id}</strong>).<br />
                            Bạn có thể điều chỉnh lại thực tế nếu có sai lệch.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white p-1.5 rounded border shadow-sm">
                                <p className="text-[9px] uppercase text-gray-500 font-bold">Tiền mặt</p>
                                <p className="text-xs font-bold text-gray-900">{formatVND(details.total)}</p>
                            </div>
                            <div className="bg-white p-1.5 rounded border shadow-sm">
                                <p className="text-[9px] uppercase text-gray-500 font-bold">Ngân hàng</p>
                                <p className="text-xs font-bold text-gray-900">{formatVND(bankBalance)}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
                    {/* Bank Images Section */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Ảnh tài khoản & Chứng từ</label>
                        <div className="flex flex-wrap gap-2">
                            {details.imgUrls?.map((url: string, idx: number) => (
                                <div key={idx} className="relative w-12 h-12 border rounded-lg overflow-hidden group">
                                    <img src={url} className="w-full h-full object-cover" alt="Bank" />
                                    <button
                                        onClick={() => handleRemoveImage(idx)}
                                        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Xóa ảnh"
                                    >
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                </div>
                            ))}
                            {/* Smaller, nicer uploader */}
                            <div className="w-12 h-12">
                                <ImageUploader
                                    value=""
                                    onChange={handleAddImage}
                                    style={{ width: '100%', height: '100%', padding: '0', borderStyle: 'dashed', borderWidth: '1px' }}
                                    showCamera={true}
                                    multiple={true}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-0.5">Tổng tiền mặt</label>
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                            <span className="font-bold text-lg text-primary">{formatVND(details.total)}</span>
                            <span className="text-[10px] text-gray-500 italic">(Từ bảng kê)</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Bank Balance Input */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-0.5">Tiền tài khoản (Ngân hàng)</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={bankBalance ? bankBalance.toLocaleString('vi-VN') : ''}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                                        setBankBalance(val);
                                    }}
                                    className="w-full pl-3 pr-8 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary font-mono text-base font-medium"
                                    placeholder="0"
                                />
                                <span className="absolute right-3 top-2.5 text-gray-500 font-medium text-xs">đ</span>
                            </div>
                        </div>

                        {/* Handover Person Input */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-0.5">Người giao tiền</label>
                            <input
                                list="staff-list"
                                type="text"
                                value={handoverPerson}
                                onChange={(e) => setHandoverPerson?.(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary font-medium text-sm"
                                placeholder="Nhập hoặc chọn tên..."
                            />
                            <datalist id="staff-list">
                                {users && users.map((u: any) => (
                                    <option key={u.id} value={u.full_name || u.email}>
                                        {u.email}
                                    </option>
                                ))}
                            </datalist>
                        </div>
                    </div>

                    {/* Note Input */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-0.5">Ghi chú (Nếu có)</label>
                        <textarea
                            value={startNote}
                            onChange={(e) => setStartNote?.(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary text-xs h-12 min-h-[48px] resize-none"
                            placeholder="Nhập ghi chú vào ca..."
                        />
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onBack}
                        className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
                    >
                        Quay lại
                    </button>
                    <button
                        onClick={onNext}
                        disabled={details.total === 0 && bankBalance === 0}
                        className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                        Xác nhận
                    </button>
                </div>
            </div>
        </div>
    );
}

export function StepConfirm({ staffName, startTime, details, bankBalance, handoverPerson, onBack, onConfirm, isProcessing }: any) {
    return (
        <div style={{ width: '100%', maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '24px', textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', backgroundColor: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <span style={{ fontSize: '24px' }}>✅</span>
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#14532d', marginBottom: '4px' }}>Sẵn sàng vào ca!</h2>
                <p style={{ fontSize: '14px', color: '#15803d' }}>Vui lòng kiểm tra lại thông tin lần cuối</p>
            </div>

            <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ color: '#6b7280' }}>Nhân viên</span>
                    <span style={{ fontWeight: 500, color: '#111827' }}>{staffName}</span>
                </div>
                {handoverPerson && (
                    <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={{ color: '#6b7280' }}>Người giao tiền</span>
                        <span style={{ fontWeight: 500, color: '#111827' }}>{handoverPerson}</span>
                    </div>
                )}
                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ color: '#6b7280' }}>Thời gian</span>
                    <span style={{ fontWeight: 500, color: '#111827' }}>{startTime}</span>
                </div>
                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ color: '#6b7280' }}>Tổng tiền mặt</span>
                    <span style={{ fontWeight: 'bold', color: '#111827' }}>{formatVND(details.total)}</span>
                </div>
                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ color: '#6b7280' }}>Tổng ngân hàng</span>
                    <span style={{ fontWeight: 'bold', color: '#111827' }}>{formatVND(bankBalance)}</span>
                </div>
                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', backgroundColor: '#f0fdf4' }}>
                    <span style={{ color: '#15803d', fontWeight: 500 }}>Tổng tài sản đầu ca</span>
                    <span style={{ fontWeight: 'bold', color: '#15803d', fontSize: '16px' }}>{formatVND(details.total + bankBalance)}</span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
                <button
                    onClick={onBack}
                    disabled={isProcessing}
                    style={{ flex: 1, padding: '12px', backgroundColor: '#f3f4f6', color: '#374151', borderRadius: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '14px' }}
                >
                    Quay lại
                </button>
                <button
                    onClick={onConfirm}
                    disabled={isProcessing}
                    style={{ flex: 1, padding: '12px', backgroundColor: '#22c55e', color: 'white', borderRadius: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '14px', opacity: isProcessing ? 0.7 : 1 }}
                >
                    {isProcessing ? 'Đang xử lý...' : 'Bắt đầu ca làm việc'}
                </button>
            </div>
        </div>
    );
}
