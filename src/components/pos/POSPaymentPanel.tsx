
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatVND } from '@/lib/cashReconciliation';
import type { Customer, PaymentMethod, DiscountType, Order, DeliveryInfo, PaymentMethodConfig, POSPaymentSplit } from '@/types';
import { usePOSStore } from '@/stores/posStore';
import { CurrencyInput } from '@/components/common/CurrencyInput';
import { POSCustomerSection } from './POSCustomerSection';

interface POSPaymentPanelProps {
    className?: string; // Optional className for layout
    // Layout
    isMobile: boolean;
    isTablet: boolean;
    isTabletLandscape: boolean;
    panelHeight?: number;

    // Delivery Mode
    isDeliveryMode: boolean;
    setIsDeliveryMode: (mode: boolean) => void;
    deliveryInfo: DeliveryInfo;
    setDeliveryInfo: (info: DeliveryInfo) => void;

    // Totals
    subtotal: number;
    total: number;
    discountAmount: number;
    setDiscount: (amount: number) => void;
    taxAmount: number; // Added taxAmount
    taxRate: number;
    setTaxRate: (rate: number) => void;
    pointsToUse: number;
    setPointsToUse: (points: number) => void;

    // Payment Methods
    paymentMethodsConfig: PaymentMethodConfig[];
    paymentMethod: string;
    setPaymentMethod: (method: any) => void;
    paymentSplit: POSPaymentSplit;
    setPaymentSplit: React.Dispatch<React.SetStateAction<POSPaymentSplit>>;
    manualCash: string;
    setManualCash: (val: string) => void;

    // Customer & Settings
    customer: Customer | null;
    onSelectCustomer: (customer: Customer | null) => void;
    onShowCustomerModal: (type: 'add' | 'edit', phone?: string) => void;
    onShowCustomerLookup: () => void;
    inputRef: React.RefObject<HTMLInputElement>;
    loyalty: any;

    // Order Note & Submission
    orderNote: string;
    setOrderNote: (note: string) => void;
    isSubmitting: boolean;
    onSubmit: () => void;
    onSaveDraft: () => void;
    onPrintProvisional: () => void;
    shouldPrintReceipt: boolean;
    setShouldPrintReceipt: (print: boolean) => void;
    cartItemCount: number;
    cashReceived: number;
    setCashReceived: (amount: number) => void;
    tempDiscount: { type: DiscountType, value: number };
    setTempDiscount: (discount: { type: DiscountType, value: number }) => void;
}

// Internal reusable Numpad component
const POSNumpad = ({
    onNumber,
    onClear,
    onZero,
    onTripleZero,
    colorClass = "gray",
    activeColorClass = "green"
}: {
    onNumber: (n: number) => void,
    onClear: () => void,
    onZero: () => void,
    onTripleZero: () => void,
    colorClass?: string,
    activeColorClass?: string
}) => {
    return (
        <div className="grid grid-cols-3 gap-0.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <button
                    key={n}
                    onClick={() => onNumber(n)}
                    className={cn(
                        "h-10 bg-white rounded text-sm font-bold transition-colors border active:scale-95",
                        `hover:bg-${activeColorClass}-50 text-gray-700 border-gray-200`
                    )}
                >
                    {n}
                </button>
            ))}
            <button
                onClick={onClear}
                className="h-10 bg-red-50 text-red-500 rounded text-sm font-bold hover:bg-red-100 transition-colors border border-red-100 active:scale-95"
            >
                C
            </button>
            <button
                onClick={onZero}
                className={cn(
                    "h-10 bg-white rounded text-sm font-bold transition-colors border active:scale-95",
                    `hover:bg-${activeColorClass}-50 text-gray-700 border-gray-200`
                )}
            >
                0
            </button>
            <button
                onClick={onTripleZero}
                className={cn(
                    "h-10 bg-white rounded text-sm font-bold transition-colors border active:scale-95",
                    `hover:bg-${activeColorClass}-50 text-gray-700 border-gray-200`
                )}
            >
                000
            </button>
        </div>
    );
};

export function POSPaymentPanel({
    isMobile, isTablet, isTabletLandscape,
    isDeliveryMode, setIsDeliveryMode, deliveryInfo, setDeliveryInfo,
    subtotal, total, discountAmount, setDiscount, taxRate, setTaxRate, pointsToUse, setPointsToUse,
    paymentMethodsConfig, paymentMethod, setPaymentMethod, paymentSplit, setPaymentSplit, manualCash, setManualCash,
    customer, onSelectCustomer, onShowCustomerModal, onShowCustomerLookup, inputRef, loyalty,
    orderNote, setOrderNote, isSubmitting, onSubmit, onSaveDraft, onPrintProvisional,
    shouldPrintReceipt, setShouldPrintReceipt, cartItemCount,
    cashReceived, setCashReceived, tempDiscount, setTempDiscount,
    className // Destructure className
}: POSPaymentPanelProps) {
    // const { setCashReceived } = usePOSStore(); // Removed - passed from props
    // const [tempDiscount, setTempDiscount] = useState<{ type: DiscountType, value: number }>({ type: 'percent', value: 0 }); // Removed - passed from props

    // Payment Logic Helpers
    const handleNumpadInput = (n: number, field: string) => {
        const currentVal = paymentSplit[field] || 0;
        const newVal = currentVal * 10 + n;
        updatePaymentField(field, newVal);
    };

    const updatePaymentField = (field: string, val: number) => {
        if (field === 'cash') {
            setCashReceived(val);
            setManualCash(val.toLocaleString('vi-VN'));
        }
        setPaymentSplit(prev => ({ ...prev, [field]: val }));
    };

    // Calculate smart suggestions
    const pointsValue = pointsToUse * (loyalty?.redemptionRate || 1000);
    const paid = (Object.values(paymentSplit) as number[]).reduce((a, b) => a + b, 0) + pointsValue;
    const remainingTotal = Math.max(0, total - paid + (paymentSplit.cash || 0)); // Remaining excluding cash (to suggest cash amount)

    const generateSuggestions = (amount: number) => {
        const suggestions: number[] = [];
        const nearest10k = Math.ceil(amount / 10000) * 10000;
        if (nearest10k > amount) suggestions.push(nearest10k);
        const nearest20k = Math.ceil(amount / 20000) * 20000;
        if (nearest20k > amount && !suggestions.includes(nearest20k)) suggestions.push(nearest20k);
        const nearest50k = Math.ceil(amount / 50000) * 50000;
        if (nearest50k > amount && !suggestions.includes(nearest50k)) suggestions.push(nearest50k);
        const nearest100k = Math.ceil(amount / 100000) * 100000;
        if (nearest100k > amount && !suggestions.includes(nearest100k)) suggestions.push(nearest100k);
        [200000, 500000, 1000000].forEach(val => {
            if (val > amount && !suggestions.includes(val)) suggestions.push(val);
        });
        return suggestions.sort((a, b) => a - b).slice(0, 10);
    };

    const suggestions = generateSuggestions(Math.max(0, total - (paid - (paymentSplit.cash || 0))));

    // Calculate Change Due
    const remainingToPay = Math.max(0, total - pointsValue);
    // Note: This logic duplicates POSPage footer logic. 
    // Wait, POSPage calculated ChangeDue based on CashReceived - Remaining?
    // Let's rely on Props passed down if possible, but we don't have changeDue prop.
    // It's fine to calculate here for display if needed.
    const changeDue = Math.max(0, (paymentSplit.cash || 0) - (remainingToPay - (paid - (paymentSplit.cash || 0))));
    // Actually, simple formula: Total Paid (including cash) - Total Order.
    // If Paid > Total, difference is Change.

    return (
        <div className={cn(
            "flex flex-col bg-white border-l border-gray-200 shadow-xl z-30 transition-all duration-300",
            isMobile
                ? "fixed inset-x-0 bottom-0 rounded-t-2xl h-[85vh] transform transition-transform duration-300 ease-out translate-y-0"
                : isTabletLandscape
                    ? "w-[440px] h-full"
                    : "w-[660px] h-full"
        )}>
            <POSCustomerSection
                customer={customer}
                onSelectCustomer={onSelectCustomer}
                onShowEditModal={() => onShowCustomerModal('edit')}
                onShowAddModal={(phone) => onShowCustomerModal('add', phone)}
                onShowCustomerLookup={onShowCustomerLookup}
                inputRef={inputRef}
            />

            {/* Delivery Form */}
            {isDeliveryMode && (
                <div className="bg-white px-3 pb-3 pt-3">
                    <div className="space-y-2 bg-amber-50 p-3 rounded-xl border border-amber-100 animation-fade-in">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Người nhận</label>
                                <input
                                    type="text"
                                    value={deliveryInfo.recipient_name}
                                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, recipient_name: e.target.value })}
                                    className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:border-amber-500 focus:outline-none"
                                    placeholder="Tên người nhận"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Điện thoại</label>
                                <input
                                    type="text"
                                    value={deliveryInfo.recipient_phone}
                                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, recipient_phone: e.target.value })}
                                    className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:border-amber-500 focus:outline-none"
                                    placeholder="SĐT liên hệ"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Địa chỉ giao</label>
                            <input
                                type="text"
                                value={deliveryInfo.shipping_address}
                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, shipping_address: e.target.value })}
                                className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:border-amber-500 focus:outline-none"
                                placeholder="Số nhà, đường, phường/xã..."
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Ghi chú giao hàng</label>
                            <input
                                type="text"
                                value={deliveryInfo.delivery_notes}
                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, delivery_notes: e.target.value })}
                                className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:border-amber-500 focus:outline-none"
                                placeholder="VD: Giao giờ hành chính..."
                            />
                        </div>
                    </div>
                </div>
            )}

            {!isDeliveryMode && <div className="h-2 bg-gradient-to-b from-gray-100 to-gray-50 shrink-0"></div>}

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
                {/* Totals Section */}
                <div className="px-4 py-2 space-y-1.5 bg-white">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Tổng tiền hàng</span>
                        <span className="font-medium text-gray-900">{formatVND(subtotal)}</span>
                    </div>

                    {/* Discount */}
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Chiết khấu</span>
                        <div className="flex items-center gap-2">
                            <div className="flex bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                                <button
                                    onClick={() => {
                                        setTempDiscount({ ...tempDiscount, type: 'percent' });
                                        setDiscount((subtotal * tempDiscount.value) / 100);
                                    }}
                                    className={cn("px-4 py-1 text-xs rounded-md font-medium transition-all w-12 flex justify-center", tempDiscount.type === 'percent' ? "bg-green-500 text-white shadow-md" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}
                                >%</button>
                                <button
                                    onClick={() => {
                                        setTempDiscount({ ...tempDiscount, type: 'amount' });
                                        setDiscount(tempDiscount.value);
                                    }}
                                    className={cn("px-3 py-1 text-xs rounded-md font-medium transition-all flex justify-center", tempDiscount.type === 'amount' ? "bg-green-500 text-white shadow-md" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}
                                >VNĐ</button>
                            </div>
                            <input
                                type="number"
                                value={tempDiscount.value}
                                min="0"
                                onChange={(e) => {
                                    let val = parseFloat(e.target.value) || 0;
                                    if (tempDiscount.type === 'percent' && val > 100) val = 100;
                                    setTempDiscount({ ...tempDiscount, value: val });
                                    setDiscount(tempDiscount.type === 'percent' ? (subtotal * val) / 100 : val);
                                }}
                                className="w-24 text-right border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-green-500 font-medium"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    {/* Tax */}
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Thuế (VAT)</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="0" max="100"
                                value={taxRate}
                                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                                className="w-24 text-right border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-green-500 font-medium"
                            />
                            <span className="text-gray-400 text-xs w-10 text-right">%</span>
                        </div>
                    </div>

                    {/* Points */}
                    {customer && customer.points_balance > 0 && loyalty?.enabled && (
                        <div className="flex justify-between items-center text-sm bg-orange-50 p-2 rounded-lg border border-orange-200">
                            <div>
                                <span className="text-orange-700 font-medium">⭐ Thanh toán bằng điểm</span>
                                <span className="text-xs text-orange-500 ml-2">({customer.points_balance} điểm = {formatVND(customer.points_balance * (loyalty?.redemptionRate || 1000))})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="0"
                                    max={Math.min(customer.points_balance, Math.ceil(total / (loyalty?.redemptionRate || 1000)))}
                                    value={pointsToUse || ''}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        setPointsToUse(Math.min(val, Math.min(customer.points_balance, Math.ceil(total / (loyalty?.redemptionRate || 1000)))));
                                    }}
                                    placeholder="0"
                                    className="w-20 text-right border border-orange-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-500 font-medium bg-white"
                                />
                                <span className="text-orange-600 text-xs font-medium">= {formatVND(pointsToUse * (loyalty?.redemptionRate || 1000))}</span>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        <span className="font-bold text-gray-800 text-lg">KHÁCH CẦN TRẢ</span>
                        <div className="text-right">
                            <span className="font-bold text-2xl text-green-600">{formatVND(Math.max(0, total - pointsToUse * (loyalty?.redemptionRate || 1000)))}</span>
                        </div>
                    </div>
                </div>

                {/* Payment Methods */}
                {!isDeliveryMode && (
                    <div className="px-4 mt-2">
                        {/* Tablet Landscape Handling for Methods - assuming parent handles it or we re-render? Parent handles 'Above Customer' */}
                        {!isTabletLandscape && (
                            <div className={cn(
                                "grid gap-1 mb-2",
                                paymentMethodsConfig.filter(m => m.enabled).length <= 4 ? "grid-cols-4" : "grid-cols-5"
                            )}>
                                {paymentMethodsConfig.filter(m => m.enabled).sort((a, b) => a.sortOrder - b.sortOrder).map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => {
                                            // Logic: Auto fill remaining
                                            const paid = (Object.values(paymentSplit) as number[]).reduce((a, b) => a + b, 0) + pointsValue;
                                            const remaining = Math.max(0, total - paid);
                                            if (remaining > 0 && m.id !== 'debt') {
                                                setPaymentSplit(prev => ({ ...prev, [m.id]: (prev[m.id] || 0) + remaining }));
                                                if (m.id === 'cash') {
                                                    const newCash = (paymentSplit.cash || 0) + remaining;
                                                    setCashReceived(newCash);
                                                    setManualCash(newCash.toLocaleString('vi-VN'));
                                                }
                                            }
                                            setPaymentMethod(m.id);
                                        }}
                                        className={cn(
                                            "flex flex-col items-center justify-center py-1.5 rounded-lg border transition-all duration-200",
                                            paymentMethod === m.id
                                                ? "bg-green-50 border-green-500 text-green-700 ring-1 ring-green-500"
                                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                                        )}
                                    >
                                        <span className="text-sm">
                                            {m.iconType === 'url' ? <img src={m.icon} alt={m.name} className="w-4 h-4" /> : m.icon}
                                        </span>
                                        <span className="text-[10px] font-bold truncate mt-0.5">{m.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Cash UI */}
                        {paymentMethod === 'cash' && (
                            <div className="space-y-2 animation-fade-in bg-white border border-gray-100 rounded-xl p-2">
                                <div className="flex justify-between items-center text-sm gap-4">
                                    <span className="text-gray-700 whitespace-nowrap font-bold">Tiền khách đưa</span>
                                    <CurrencyInput
                                        className="w-28 text-right border border-gray-200 rounded-lg px-2 py-1 text-base focus:outline-none focus:border-green-500 font-bold"
                                        value={manualCash}
                                        onValueChange={(val) => updatePaymentField('cash', val)}
                                        placeholder="0"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-1/2">
                                        <POSNumpad
                                            onNumber={(n) => handleNumpadInput(n, 'cash')}
                                            onClear={() => updatePaymentField('cash', 0)}
                                            onZero={() => handleNumpadInput(0, 'cash')}
                                            onTripleZero={() => updatePaymentField('cash', (paymentSplit.cash || 0) * 1000)}
                                        />
                                    </div>
                                    <div className="w-1/2 bg-gray-50 rounded-lg p-2 border border-gray-100 flex flex-col justify-between">
                                        <div className="text-[10px] font-bold text-gray-500 uppercase">Chi tiết</div>
                                        {/* Simplified payment details view */}
                                        <div className="text-xs space-y-1">
                                            {Object.entries(paymentSplit).filter(([k, v]) => v > 0).map(([k, v]) => (
                                                <div key={k} className="flex justify-between">
                                                    <span>{k === 'cash' ? 'Mặt' : k === 'transfer' ? 'CK' : k === 'card' ? 'Thẻ' : 'Nợ'}</span>
                                                    <span className="font-bold">{formatVND(v)}</span>
                                                </div>
                                            ))}
                                            {pointsToUse > 0 && <div className="flex justify-between text-orange-600"><span>Điểm</span><span>{formatVND(pointsValue)}</span></div>}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-5 gap-1 pt-1 border-t border-dashed border-gray-100">
                                    {suggestions.map(s => (
                                        <button key={s} onClick={() => updatePaymentField('cash', s)} className="py-1.5 bg-gray-50 border border-gray-200 hover:border-green-500 text-[10px] font-bold rounded">
                                            {s.toLocaleString('vi-VN')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(paymentMethod === 'transfer' || paymentMethod === 'card') && (
                            <div className="space-y-2 animation-fade-in bg-white border border-gray-100 rounded-xl p-2">
                                <div className="flex justify-between items-center text-sm gap-4">
                                    <span className={cn("whitespace-nowrap font-bold", paymentMethod === 'transfer' ? "text-blue-700" : "text-purple-700")}>
                                        {paymentMethod === 'transfer' ? 'Tiền chuyển khoản' : 'Tiền quẹt thẻ'}
                                    </span>
                                    <CurrencyInput
                                        className={cn("w-28 text-right border rounded-lg px-2 py-1 text-base focus:outline-none font-bold", paymentMethod === 'transfer' ? "border-blue-200 focus:border-blue-500" : "border-purple-200 focus:border-purple-500")}
                                        value={paymentSplit[paymentMethod] || ''}
                                        onValueChange={(val) => updatePaymentField(paymentMethod, val)}
                                        placeholder="0"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-1/2">
                                        <POSNumpad
                                            onNumber={(n) => handleNumpadInput(n, paymentMethod)}
                                            onClear={() => updatePaymentField(paymentMethod, 0)}
                                            onZero={() => handleNumpadInput(0, paymentMethod)}
                                            onTripleZero={() => updatePaymentField(paymentMethod, (paymentSplit[paymentMethod] || 0) * 1000)}
                                            activeColorClass={paymentMethod === 'transfer' ? 'blue' : 'purple'}
                                        />
                                    </div>
                                    {/* Summary similar to cash */}
                                    <div className="w-1/2 bg-gray-50 rounded-lg p-2 border border-gray-100 flex flex-col justify-between">
                                        <div className="text-[10px] font-bold text-gray-500 uppercase">Chi tiết</div>
                                        <div className="text-xs space-y-1">
                                            {Object.entries(paymentSplit).filter(([k, v]) => v > 0).map(([k, v]) => (
                                                <div key={k} className="flex justify-between">
                                                    <span>{k === 'cash' ? 'Mặt' : k === 'transfer' ? 'CK' : k === 'card' ? 'Thẻ' : 'Nợ'}</span>
                                                    <span className="font-bold">{formatVND(v)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {paymentMethod === 'debt' && (
                            <div className="space-y-2 animation-fade-in bg-red-50 border border-red-100 rounded-xl p-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-red-700 font-bold flex items-center gap-2">📝 Ghi nợ</span>
                                    <span className="text-xl font-black text-red-700">
                                        {formatVND(Math.max(0, total - ((Object.values(paymentSplit) as number[]).reduce((a, b) => a + b, 0) - (paymentSplit.debt || 0)) - pointsValue))}
                                    </span>
                                </div>
                                {customer ? (
                                    <div className="text-xs text-red-600 pt-1 border-t border-red-200">
                                        Ghi nợ cho <span className="font-bold">{customer.name}</span>
                                        {customer.debt_balance > 0 && <span className="ml-2 text-red-500">(Nợ cũ: {formatVND(customer.debt_balance)})</span>}
                                    </div>
                                ) : (
                                    <div className="text-xs text-red-600 font-bold pt-1 border-t border-red-200">⚠ Vui lòng chọn khách hàng!</div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center gap-2 px-3 py-2">
                            <span className="text-gray-400">📝</span>
                            <input
                                type="text"
                                value={orderNote}
                                onChange={(e) => setOrderNote(e.target.value)}
                                placeholder="Ghi chú đơn hàng..."
                                className="flex-1 bg-transparent border-none text-sm p-0 focus:ring-0 focus:outline-none placeholder-gray-400 text-gray-700"
                            />
                        </div>
                    </div>
                )}
                <div className="h-6"></div>
            </div>

            <div className="h-2 bg-gradient-to-b from-gray-100 to-gray-50 shrink-0"></div>

            {/* Footer */}
            <div className="p-3 bg-white relative z-30">
                <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={shouldPrintReceipt}
                            onChange={(e) => setShouldPrintReceipt(e.target.checked)}
                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                        />
                        <span className="text-sm font-medium text-gray-600">In hóa đơn</span>
                    </div>
                    <button onClick={() => setIsDeliveryMode(!isDeliveryMode)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-bold shadow-sm mx-2", isDeliveryMode ? "bg-slate-600 text-white" : "bg-white text-gray-600")}>
                        {isDeliveryMode ? "Bán giao ngay" : "Bán giao ngay"}
                    </button>
                    {/* Change Due Display */}
                    <div className="flex items-center gap-3 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                        <span className="text-sm font-semibold text-red-700">Tiền thừa</span>
                        <span className="font-black text-xl text-red-600">{formatVND(Math.max(0, (paymentSplit.cash || 0) - Math.max(0, total - pointsValue - ((Object.values(paymentSplit) as number[]).reduce((a, b) => a + b, 0) - (paymentSplit.cash || 0)))))}</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button className="flex-1 py-3.5 border border-blue-300 text-blue-600 font-bold rounded-xl hover:bg-blue-50 text-xs uppercase tracking-wider bg-blue-50/50 shadow-sm flex items-center justify-center gap-2" onClick={onPrintProvisional}>
                        ⎙ In tạm tính (F9)
                    </button>
                    <button className="px-5 py-3.5 bg-amber-500 hover:bg-amber-600 border border-amber-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2" onClick={onSaveDraft}>
                        💾 Lưu nháp
                    </button>
                    <button
                        onClick={onSubmit}
                        disabled={isSubmitting || cartItemCount === 0}
                        className={cn(
                            "flex-[2] py-3.5 rounded-xl font-bold text-lg text-white shadow-lg uppercase tracking-wider",
                            (isSubmitting || cartItemCount === 0) ? "bg-gray-400 cursor-not-allowed" : isDeliveryMode ? "bg-amber-500 hover:bg-amber-600" : "bg-green-600 hover:bg-green-700"
                        )}
                    >
                        {isSubmitting ? 'Đang xử lý...' : isDeliveryMode ? 'LƯU ĐƠN GIAO' : 'THANH TOÁN (F1)'}
                    </button>
                </div>
            </div>
        </div>
    );
}
