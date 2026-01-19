import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { MainLayout } from '@/components/layout/MainLayout';

interface Plan {
    id: string;
    name: string;
    price: number;
    description: string;
    features: string[];
    max_branches: number;
    max_users: number;
}

export function PlansPage() {
    const navigate = useNavigate();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        try {
            const { data, error } = await supabase
                .from('plans')
                .select('*')
                .order('price', { ascending: true });

            if (error) throw error;
            setPlans(data || []);
        } catch (error) {
            console.error('Error loading plans:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6">
            <div className="text-center mb-10">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Chọn gói dịch vụ phù hợp</h1>
                <p className="text-gray-600">Nâng cấp để mở rộng quy mô cửa hàng của bạn</p>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {plans.map((plan) => (
                        <div
                            key={plan.id}
                            className={`bg-white rounded-2xl shadow-xl overflow-hidden border-2 ${plan.name === 'Startup' ? 'border-emerald-500 transform scale-105' : 'border-transparent'
                                }`}
                        >
                            {plan.name === 'Startup' && (
                                <div className="bg-emerald-500 text-white text-center py-1 text-sm font-bold">
                                    Phổ biến nhất
                                </div>
                            )}
                            <div className="p-8">
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                                <div className="flex items-baseline mb-6">
                                    <span className="text-4xl font-bold text-gray-900">
                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(plan.price)}
                                    </span>
                                    <span className="text-gray-500 ml-2">/tháng</span>
                                </div>
                                <p className="text-gray-600 mb-6">{plan.description}</p>

                                <ul className="space-y-4 mb-8">
                                    {plan.features?.map((feature, index) => (
                                        <li key={index} className="flex items-start">
                                            <svg className="h-6 w-6 text-emerald-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span className="text-gray-600">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    className={`w-full py-3 px-6 rounded-xl font-bold transition-colors ${plan.name === 'Startup'
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                        }`}
                                >
                                    {plan.price === 0 ? 'Đang sử dụng' : 'Đăng ký ngay'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default PlansPage;
