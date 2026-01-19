import { useEffect } from 'react';
import { useSubscriptionStore, PLANS } from '@/stores/subscriptionStore';
import { Loading } from '@/components/common/Loading';
import { Check } from 'lucide-react';

export function PricingPage() {
    const { subscription, fetchSubscription, upgradeSubscription, isLoading } = useSubscriptionStore();

    useEffect(() => {
        fetchSubscription();
    }, []);

    const handleUpgrade = async (planId: 'basic' | 'pro') => {
        if (confirm(`Bạn có chắc chắn muốn nâng cấp lên ${PLANS[planId].name}?`)) {
            const success = await upgradeSubscription(planId as any, 'vnpay');
            if (success) {
                alert('Nâng cấp thành công! (Mô phỏng)');
            } else {
                alert('Có lỗi xảy ra.');
            }
        }
    };

    if (isLoading) return <Loading />;

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center">
                    <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                        Chọn gói dịch vụ phù hợp
                    </h2>
                    <p className="mt-4 text-xl text-gray-600">
                        Giải pháp quản lý bán hàng toàn diện cho doanh nghiệp của bạn
                    </p>
                </div>

                <div className="mt-16 grid gap-8 lg:grid-cols-3 lg:gap-x-8">
                    {/* Basic Plan */}
                    <div className="relative p-8 bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col">
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold text-gray-900">{PLANS.basic.name}</h3>
                            <p className="mt-4 flex items-baseline text-gray-900">
                                <span className="text-5xl font-extrabold tracking-tight">{PLANS.basic.price.toLocaleString()}</span>
                                <span className="ml-1 text-xl font-semibold text-gray-500">₫/tháng</span>
                            </p>
                            <p className="mt-6 text-gray-500">Dành cho cửa hàng nhỏ, mới bắt đầu kinh doanh.</p>

                            <ul role="list" className="mt-6 space-y-6">
                                {PLANS.basic.features.map((feature) => (
                                    <li key={feature} className="flex">
                                        <Check className="flex-shrink-0 w-6 h-6 text-green-500" aria-hidden="true" />
                                        <span className="ml-3 text-gray-500">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <button
                            onClick={() => handleUpgrade('basic')}
                            disabled={subscription?.plan === 'basic' || subscription?.plan === 'pro'}
                            className={`mt-8 block w-full py-3 px-6 border border-transparent rounded-md text-center font-medium ${subscription?.plan === 'basic'
                                    ? 'bg-green-100 text-green-800 cursor-default'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                        >
                            {subscription?.plan === 'basic' ? 'Đang sử dụng' : 'Nâng cấp ngay'}
                        </button>
                    </div>

                    {/* Pro Plan */}
                    <div className="relative p-8 bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col ring-2 ring-green-600">
                        <div className="absolute top-0 right-0 -mt-5 -mr-5 flex justify-center">
                            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold tracking-wide uppercase bg-green-100 text-green-600 shadow-sm border border-green-200">
                                Phổ biến nhất
                            </span>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold text-gray-900">{PLANS.pro.name}</h3>
                            <p className="mt-4 flex items-baseline text-gray-900">
                                <span className="text-5xl font-extrabold tracking-tight">{PLANS.pro.price.toLocaleString()}</span>
                                <span className="ml-1 text-xl font-semibold text-gray-500">₫/tháng</span>
                            </p>
                            <p className="mt-6 text-gray-500">Đầy đủ tính năng cao cấp cho chuỗi cửa hàng.</p>

                            <ul role="list" className="mt-6 space-y-6">
                                {PLANS.pro.features.map((feature) => (
                                    <li key={feature} className="flex">
                                        <Check className="flex-shrink-0 w-6 h-6 text-green-500" aria-hidden="true" />
                                        <span className="ml-3 text-gray-500">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <button
                            onClick={() => handleUpgrade('pro')}
                            disabled={subscription?.plan === 'pro'}
                            className={`mt-8 block w-full py-3 px-6 border border-transparent rounded-md text-center font-medium ${subscription?.plan === 'pro'
                                    ? 'bg-green-100 text-green-800 cursor-default'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                        >
                            {subscription?.plan === 'pro' ? 'Đang sử dụng' : 'Nâng cấp ngay'}
                        </button>
                    </div>

                    {/* Enterprise / Contact */}
                    <div className="relative p-8 bg-gray-50 border border-gray-200 rounded-2xl shadow-sm flex flex-col">
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold text-gray-900">Doanh nghiệp</h3>
                            <p className="mt-4 flex items-baseline text-gray-900">
                                <span className="text-3xl font-bold tracking-tight">Liên hệ</span>
                            </p>
                            <p className="mt-6 text-gray-500">Giải pháp tùy chỉnh cho quy mô lớn.</p>

                            <ul role="list" className="mt-6 space-y-6">
                                <li className="flex">
                                    <Check className="flex-shrink-0 w-6 h-6 text-gray-400" aria-hidden="true" />
                                    <span className="ml-3 text-gray-500">Không giới hạn chi nhánh</span>
                                </li>
                                <li className="flex">
                                    <Check className="flex-shrink-0 w-6 h-6 text-gray-400" aria-hidden="true" />
                                    <span className="ml-3 text-gray-500">Hỗ trợ kỹ thuật 24/7 riêng</span>
                                </li>
                                <li className="flex">
                                    <Check className="flex-shrink-0 w-6 h-6 text-gray-400" aria-hidden="true" />
                                    <span className="ml-3 text-gray-500">Tùy chỉnh tính năng</span>
                                </li>
                            </ul>
                        </div>
                        <button
                            className="mt-8 block w-full py-3 px-6 border border-gray-300 rounded-md text-center font-medium bg-white text-gray-700 hover:bg-gray-50"
                        >
                            Liên hệ tư vấn
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
