import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSubscriptionStore, PLANS } from '@/stores/subscriptionStore';
import { Loading } from '@/components/common/Loading';
import { CreditCard, QrCode, Building } from 'lucide-react';

export function PaymentPage() {
    const [searchParams] = useSearchParams();
    const planId = searchParams.get('plan') as 'basic' | 'pro';
    const method = searchParams.get('method') as 'vnpay' | 'momo' | 'bank';

    const navigate = useNavigate();
    const { upgradeSubscription, fetchSubscription } = useSubscriptionStore();
    const [status, setStatus] = useState<'processing' | 'success' | 'failed'>('processing');

    const plan = PLANS[planId];

    useEffect(() => {
        if (!plan) {
            navigate('/bang-gia'); // Redirect if no plan
            return;
        }

        const processPayment = async () => {
            // Simulate payment gateway delay and success
            setTimeout(async () => {
                const paymentMethod = method === 'bank' ? 'bank_transfer' : (method || 'vnpay');
                const success = await upgradeSubscription(planId, paymentMethod);
                if (success) {
                    setStatus('success');
                    // Refresh sub data
                    await fetchSubscription();
                } else {
                    setStatus('failed');
                }
            }, 3000);
        };

        processPayment();
    }, [planId, method]);

    if (!plan) return <Loading />;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                {status === 'processing' && (
                    <>
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">Đang kết nối cổng thanh toán...</h2>
                        <div className="flex items-center justify-center gap-2 text-gray-500 bg-gray-50 p-3 rounded-lg mt-4">
                            {method === 'momo' ? <span className="font-bold text-pink-600">MoMo</span> :
                                method === 'vnpay' ? <span className="font-bold text-blue-600">VNPay</span> :
                                    <Building />}
                            <span>• {plan.price.toLocaleString()} ₫</span>
                        </div>
                        <p className="text-sm text-gray-400 mt-4">Vui lòng không tắt trình duyệt</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 text-4xl">
                            ✓
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Thanh toán thành công!</h2>
                        <p className="text-gray-600 mb-6">
                            Gói <span className="font-bold text-green-700">{plan.name}</span> đã được kích hoạt.
                        </p>
                        <button
                            onClick={() => navigate('/admin')}
                            className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 w-full"
                        >
                            Về trang quản trị
                        </button>
                    </>
                )}

                {status === 'failed' && (
                    <>
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 text-4xl">
                            ✕
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Thanh toán thất bại</h2>
                        <p className="text-gray-600 mb-6">
                            Vui lòng thử lại hoặc liên hệ hỗ trợ.
                        </p>
                        <button
                            onClick={() => navigate('/bang-gia')}
                            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-bold hover:bg-gray-200 w-full"
                        >
                            Quay lại bảng giá
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
