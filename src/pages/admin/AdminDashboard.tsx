import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loading } from '@/components/common/Loading';
import { Users, Store, TrendingUp, CreditCard } from 'lucide-react';

export function AdminDashboard() {
    const [stats, setStats] = useState({
        totalBrands: 0,
        activeBrands: 0,
        totalUsers: 0,
        trialBrands: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            try {
                // 1. Count Brands
                const { count: totalBrands } = await supabase
                    .from('brands')
                    .select('*', { count: 'exact', head: true });

                const { count: activeBrands } = await supabase
                    .from('brands')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'active');

                const { count: trialBrands } = await supabase
                    .from('brands')
                    .select('*', { count: 'exact', head: true })
                    .eq('plan', 'trial');

                // 2. Count Users (Profiles)
                const { count: totalUsers } = await supabase
                    .from('user_profiles')
                    .select('*', { count: 'exact', head: true });

                setStats({
                    totalBrands: totalBrands || 0,
                    activeBrands: activeBrands || 0,
                    totalUsers: totalUsers || 0,
                    trialBrands: trialBrands || 0
                });
            } catch (error) {
                console.error('Error fetching admin stats:', error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchStats();
    }, []);

    if (isLoading) return <Loading />;

    const statCards = [
        {
            label: 'Tổng thương hiệu',
            value: stats.totalBrands,
            icon: Store,
            color: 'text-blue-600',
            bg: 'bg-blue-50'
        },
        {
            label: 'Đang hoạt động',
            value: stats.activeBrands,
            icon: TrendingUp,
            color: 'text-green-600',
            bg: 'bg-green-50'
        },
        {
            label: 'Đang dùng thử',
            value: stats.trialBrands,
            icon: CreditCard,
            color: 'text-purple-600',
            bg: 'bg-purple-50'
        },
        {
            label: 'Tổng người dùng',
            value: stats.totalUsers,
            icon: Users,
            color: 'text-orange-600',
            bg: 'bg-orange-50'
        },
    ];

    return (
        <div className="p-4 md:p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Dashboard Tổng quan</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, index) => (
                    <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-gray-500 text-sm font-medium mb-1">{stat.label}</h3>
                            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                        </div>
                        <div className={`p-3 rounded-lg ${stat.bg}`}>
                            <stat.icon className={`w-6 h-6 ${stat.color}`} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions or Recent Activity could go here */}
            <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Hoạt động gần đây</h3>
                <div className="text-sm text-gray-500 text-center py-8">
                    Chưa có hoạt động nào được ghi nhận.
                </div>
            </div>
        </div>
    );
}
