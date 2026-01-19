import React, { useState } from 'react';
import { X, Check, CreditCard, Building2, Smartphone, Upload, AlertCircle } from 'lucide-react';
import { useBilling, type Plan } from '@/hooks/useBilling';

interface UpgradePlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPlanId?: string;
}

export function UpgradePlanModal({ isOpen, onClose, currentPlanId }: UpgradePlanModalProps) {
    const { plans, createInvoice } = useBilling();
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
    const [step, setStep] = useState<'select' | 'payment' | 'confirm'>('select');
    const [paymentMethod, setPaymentMethod] = useState<string>('transfer');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [transactionCode, setTransactionCode] = useState('');

    if (!isOpen) return null;

    const handleSelectPlan = (plan: Plan) => {
        if (plan.id === currentPlanId) return;
        setSelectedPlan(plan);
        setStep('payment');
    };

    const handleSubmitPayment = async () => {
        if (!selectedPlan) return;

        setIsSubmitting(true);
        const result = await createInvoice(selectedPlan.id, billingPeriod, paymentMethod);
        setIsSubmitting(false);

        if (result.success) {
            setStep('confirm');
        } else {
            alert('Lỗi: ' + result.error);
        }
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };

    const getYearlyDiscount = (plan: Plan) => {
        const monthlyTotal = plan.price_monthly * 12;
        const savings = monthlyTotal - plan.price_yearly;
        const percent = Math.round((savings / monthlyTotal) * 100);
        return percent;
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-xl font-bold text-gray-900">
                        {step === 'select' && 'Chọn gói dịch vụ'}
                        {step === 'payment' && 'Thanh toán'}
                        {step === 'confirm' && 'Xác nhận'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {/* Step 1: Select Plan */}
                    {step === 'select' && (
                        <>
                            {/* Billing Period Toggle */}
                            <div className="flex justify-center mb-8">
                                <div className="bg-gray-100 p-1 rounded-lg flex">
                                    <button
                                        onClick={() => setBillingPeriod('monthly')}
                                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${billingPeriod === 'monthly'
                                            ? 'bg-white shadow text-gray-900'
                                            : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                    >
                                        Hàng tháng
                                    </button>
                                    <button
                                        onClick={() => setBillingPeriod('yearly')}
                                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${billingPeriod === 'yearly'
                                            ? 'bg-white shadow text-gray-900'
                                            : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                    >
                                        Hàng năm <span className="text-green-600 ml-1">(-20%)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Plans Grid */}
                            <div className="grid md:grid-cols-3 gap-6">
                                {plans.map((plan) => {
                                    const isCurrent = plan.id === currentPlanId;
                                    const price = billingPeriod === 'yearly' ? plan.price_yearly : plan.price_monthly;
                                    const isPro = plan.name.toLowerCase().includes('pro');

                                    return (
                                        <div
                                            key={plan.id}
                                            className={`relative rounded-2xl border-2 p-6 transition-all ${isPro
                                                ? 'border-blue-500 bg-blue-50/30 shadow-lg scale-105'
                                                : 'border-gray-200 hover:border-gray-300'
                                                } ${isCurrent ? 'opacity-60' : ''}`}
                                        >
                                            {isPro && (
                                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full">
                                                    Phổ biến nhất
                                                </div>
                                            )}

                                            <h3 className="text-lg font-bold text-gray-900 mb-2">{plan.name}</h3>

                                            <div className="mb-4">
                                                <span className="text-3xl font-bold text-gray-900">
                                                    {price === 0 ? 'Miễn phí' : formatPrice(price)}
                                                </span>
                                                {price > 0 && (
                                                    <span className="text-gray-500 text-sm">
                                                        /{billingPeriod === 'yearly' ? 'năm' : 'tháng'}
                                                    </span>
                                                )}
                                            </div>

                                            <ul className="space-y-3 mb-6 text-sm">
                                                <li className="flex items-center gap-2">
                                                    <Check size={16} className="text-green-600" />
                                                    <span>{plan.max_branches === -1 ? 'Không giới hạn' : plan.max_branches} chi nhánh</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <Check size={16} className="text-green-600" />
                                                    <span>{plan.max_users === -1 ? 'Không giới hạn' : plan.max_users} nhân viên</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <Check size={16} className="text-green-600" />
                                                    <span>{plan.max_products === -1 ? 'Không giới hạn' : plan.max_products} sản phẩm</span>
                                                </li>
                                                {plan.features?.reports && (
                                                    <li className="flex items-center gap-2">
                                                        <Check size={16} className="text-green-600" />
                                                        <span>Báo cáo nâng cao</span>
                                                    </li>
                                                )}
                                                {plan.features?.api && (
                                                    <li className="flex items-center gap-2">
                                                        <Check size={16} className="text-green-600" />
                                                        <span>API tích hợp</span>
                                                    </li>
                                                )}
                                            </ul>

                                            <button
                                                onClick={() => handleSelectPlan(plan)}
                                                disabled={isCurrent}
                                                className={`w-full py-3 rounded-lg font-medium transition-colors ${isCurrent
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : isPro
                                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                        : 'bg-gray-900 text-white hover:bg-gray-800'
                                                    }`}
                                            >
                                                {isCurrent ? 'Gói hiện tại' : 'Chọn gói này'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* Step 2: Payment */}
                    {step === 'payment' && selectedPlan && (
                        <div className="max-w-lg mx-auto">
                            <div className="bg-gray-50 rounded-xl p-4 mb-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-sm text-gray-500">Gói đã chọn</p>
                                        <p className="font-bold text-lg">{selectedPlan.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-500">{billingPeriod === 'yearly' ? 'Năm' : 'Tháng'}</p>
                                        <p className="font-bold text-lg text-blue-600">
                                            {formatPrice(billingPeriod === 'yearly' ? selectedPlan.price_yearly : selectedPlan.price_monthly)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <h3 className="font-semibold mb-4">Chọn phương thức thanh toán</h3>

                            <div className="space-y-3 mb-6">
                                <label className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${paymentMethod === 'transfer' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                                    }`}>
                                    <input
                                        type="radio"
                                        name="payment"
                                        value="transfer"
                                        checked={paymentMethod === 'transfer'}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="sr-only"
                                    />
                                    <Building2 size={24} className="text-gray-600" />
                                    <div>
                                        <p className="font-medium">Chuyển khoản ngân hàng</p>
                                        <p className="text-sm text-gray-500">Xác nhận trong 24h</p>
                                    </div>
                                </label>

                                <label className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${paymentMethod === 'momo' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                                    }`}>
                                    <input
                                        type="radio"
                                        name="payment"
                                        value="momo"
                                        checked={paymentMethod === 'momo'}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="sr-only"
                                    />
                                    <Smartphone size={24} className="text-pink-500" />
                                    <div>
                                        <p className="font-medium">Ví MoMo</p>
                                        <p className="text-sm text-gray-500">Thanh toán tức thì (Sắp ra mắt)</p>
                                    </div>
                                </label>

                                <label className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${paymentMethod === 'vnpay' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                                    }`}>
                                    <input
                                        type="radio"
                                        name="payment"
                                        value="vnpay"
                                        checked={paymentMethod === 'vnpay'}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="sr-only"
                                    />
                                    <CreditCard size={24} className="text-blue-600" />
                                    <div>
                                        <p className="font-medium">VNPay / Thẻ ATM</p>
                                        <p className="text-sm text-gray-500">Thanh toán tức thì (Sắp ra mắt)</p>
                                    </div>
                                </label>
                            </div>

                            {paymentMethod === 'transfer' && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                                    <h4 className="font-medium text-yellow-800 mb-2">Thông tin chuyển khoản</h4>
                                    <div className="text-sm space-y-1 text-yellow-700">
                                        <p><strong>Ngân hàng:</strong> Vietcombank</p>
                                        <p><strong>Số tài khoản:</strong> 1234567890</p>
                                        <p><strong>Chủ TK:</strong> CONG TY BANGO</p>
                                        <p><strong>Nội dung:</strong> NANGCAP [Mã đơn hàng]</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('select')}
                                    className="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                                >
                                    Quay lại
                                </button>
                                <button
                                    onClick={handleSubmitPayment}
                                    disabled={isSubmitting || (paymentMethod !== 'transfer')}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? 'Đang xử lý...' : 'Tạo yêu cầu thanh toán'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Confirmation */}
                    {step === 'confirm' && (
                        <div className="max-w-md mx-auto text-center py-8">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check size={32} className="text-green-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Yêu cầu đã được tạo!</h3>
                            <p className="text-gray-600 mb-6">
                                Vui lòng chuyển khoản theo thông tin bên trên.
                                Sau khi xác nhận thanh toán, gói của bạn sẽ được kích hoạt trong vòng 24h.
                            </p>
                            <button
                                onClick={onClose}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                            >
                                Đóng
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
