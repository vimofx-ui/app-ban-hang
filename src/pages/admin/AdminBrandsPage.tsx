// =============================================================================
// ADMIN BRANDS PAGE - Full CRUD for managing tenant brands
// =============================================================================

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loading } from '@/components/common/Loading';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { getPlanDisplayName, getPlanBadgeColor } from '@/hooks/useSubscription';
import { Search, Filter, RefreshCw, Calendar, Shield, MoreVertical, Trash2, AlertTriangle } from 'lucide-react';

interface Brand {
    id: string;
    name: string;
    slug: string;
    plan: 'trial' | 'basic' | 'pro';
    status: number; // Legacy (1=active, 0=inactive)
    text_status: 'trial' | 'active' | 'expired' | 'suspended' | 'deleted';
    deleted_at: string | null;
    trial_ends_at: string;
    subscription_expires_at?: string;
    created_at: string;
    owner_name?: string;
    owner_phone?: string;
    owner_email?: string;
    branches_count?: number;
    users_count?: number;
}

export function AdminBrandsPage() {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPlan, setFilterPlan] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    useEffect(() => {
        fetchBrands();
    }, []);

    const fetchBrands = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data: brandsData, error: brandsError } = await supabase
                .from('brands')
                .select('*')
                .order('created_at', { ascending: false });

            if (brandsError) throw brandsError;

            // Fetch additional info for each brand
            const enrichedBrands = await Promise.all(brandsData.map(async (brand: any) => {
                // Get owner info
                const { data: owner } = await supabase
                    .from('user_profiles')
                    .select('full_name, phone, email')
                    .eq('brand_id', brand.id)
                    .eq('role', 'owner')
                    .limit(1)
                    .single();

                // Get counts
                const { count: branchesCount } = await supabase
                    .from('branches')
                    .select('*', { count: 'exact', head: true })
                    .eq('brand_id', brand.id);

                const { count: usersCount } = await supabase
                    .from('user_profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('brand_id', brand.id);

                return {
                    ...brand,
                    owner_name: owner?.full_name || 'N/A',
                    owner_phone: owner?.phone || '',
                    owner_email: owner?.email || '',
                    branches_count: branchesCount || 0,
                    users_count: usersCount || 0,
                };
            }));

            setBrands(enrichedBrands);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const updateBrand = async (id: string, updates: Partial<Brand>) => {
        try {
            const { error } = await supabase
                .from('brands')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            fetchBrands();
        } catch (err: any) {
            alert('Lỗi: ' + err.message);
        }
    };

    const extendTrial = async (brand: Brand) => {
        const days = prompt('Gia hạn thêm bao nhiêu ngày?', '7');
        if (!days) return;

        const currentEnd = new Date(brand.trial_ends_at);
        const newEnd = new Date(currentEnd.getTime() + parseInt(days) * 24 * 60 * 60 * 1000);

        await updateBrand(brand.id, {
            trial_ends_at: newEnd.toISOString(),
            text_status: 'active'
        } as any);
    };

    const toggleStatus = async (brand: Brand) => {
        const newStatus = brand.text_status === 'active' ? 'suspended' : 'active';
        try {
            const { data, error } = await supabase!.rpc('toggle_brand_status', {
                p_brand_id: brand.id,
                p_new_status: newStatus
            });

            if (error) throw error;

            const result = data as { success: boolean; brand_name?: string; error?: string };
            if (result.success) {
                fetchBrands();
            } else {
                alert('Lỗi: ' + result.error);
            }
        } catch (err: any) {
            alert('Lỗi: ' + err.message);
        }
    };

    const deleteBrand = async (brand: Brand) => {
        const confirmText = prompt(`Nhập "XOA ${brand.name}" để xác nhận xóa thương hiệu này:`);
        if (confirmText !== `XOA ${brand.name}`) {
            alert('Xác nhận không đúng. Hủy thao tác.');
            return;
        }

        try {
            const { data, error } = await supabase!.rpc('soft_delete_brand', {
                p_brand_id: brand.id
            });

            if (error) throw error;

            const result = data as { success: boolean; brand_name?: string; error?: string };
            if (result.success) {
                alert(`Đã xóa thương hiệu "${result.brand_name}" thành công!`);
                fetchBrands();
            } else {
                alert('Lỗi: ' + result.error);
            }
        } catch (err: any) {
            alert('Lỗi: ' + err.message);
        }
    };

    const upgradePlan = async (brand: Brand, newPlan: 'basic' | 'pro') => {
        await updateBrand(brand.id, { plan: newPlan });
    };

    // Filter brands
    // Filter out deleted brands (or show them with special style)
    const filteredBrands = brands.filter(brand => {
        // Hide deleted brands unless specifically filtered
        if (brand.text_status === 'deleted' && filterStatus !== 'deleted') return false;

        const matchesSearch =
            brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (brand.slug || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            brand.owner_name?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesPlan = filterPlan === 'all' || brand.plan === filterPlan;
        const matchesStatus = filterStatus === 'all' || brand.text_status === filterStatus;

        return matchesSearch && matchesPlan && matchesStatus;
    });

    const getDaysLeft = (dateStr: string) => {
        const end = new Date(dateStr).getTime();
        const now = Date.now();
        return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    };

    if (isLoading) return <Loading />;

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Quản lý Thương hiệu</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Tổng cộng {brands.length} thương hiệu • {brands.filter(b => b.text_status === 'active').length} đang hoạt động
                        </p>
                    </div>
                    <button
                        onClick={fetchBrands}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Làm mới
                    </button>
                </div>

                <ErrorAlert message={error} />

                {/* Search & Filters */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Tìm kiếm tên, slug, email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>
                        <div className="flex gap-4">
                            <div className="relative">
                                <Filter className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <select
                                    value={filterPlan}
                                    onChange={(e) => setFilterPlan(e.target.value)}
                                    className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                >
                                    <option value="all">Tất cả gói</option>
                                    <option value="trial">Dùng thử</option>
                                    <option value="basic">Cơ bản</option>
                                    <option value="pro">Chuyên nghiệp</option>
                                </select>
                            </div>
                            <div className="relative">
                                <Shield className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                >
                                    <option value="all">Tất cả trạng thái</option>
                                    <option value="active">Hoạt động</option>
                                    <option value="suspended">Đang khóa</option>
                                    <option value="expired">Hết hạn</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile View - Cards */}
                <div className="grid grid-cols-1 gap-4 sm:hidden">
                    {filteredBrands.map(brand => {
                        const planColors = getPlanBadgeColor(brand.plan);
                        const daysLeft = getDaysLeft(brand.trial_ends_at);
                        const isExpired = brand.plan === 'trial' && daysLeft <= 0;

                        return (
                            <div key={brand.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-900">{brand.name}</h3>
                                        <p className="text-sm text-gray-500">{brand.slug}.bangopos.com</p>
                                    </div>
                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${planColors.bg} ${planColors.text}`}>
                                        {getPlanDisplayName(brand.plan)}
                                    </span>
                                </div>

                                <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <p className="text-gray-500">Người đại diện</p>
                                        <p className="font-medium text-gray-900">{brand.owner_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Liên hệ</p>
                                        <p className="font-medium text-gray-900">{brand.owner_phone || '---'}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Chi nhánh/User</p>
                                        <p className="font-medium text-gray-900">{brand.branches_count} CN / {brand.users_count} NV</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Trạng thái</p>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${brand.text_status === 'active' ? 'bg-green-100 text-green-800' : brand.text_status === 'deleted' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {brand.text_status === 'active' ? 'Hoạt động' : brand.text_status === 'deleted' ? 'Đã xóa' : 'Đã khóa'}
                                        </span>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 pt-3 flex justify-end gap-2">
                                    {brand.plan === 'trial' && (
                                        <button onClick={() => extendTrial(brand)} className="p-2 text-blue-600 bg-blue-50 rounded-lg text-sm">
                                            Gia hạn
                                        </button>
                                    )}
                                    <button
                                        onClick={() => toggleStatus(brand)}
                                        className={`p-2 rounded-lg text-sm font-medium ${brand.text_status === 'active' ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'
                                            }`}
                                    >
                                        {brand.text_status === 'active' ? 'Khóa' : 'Mở'}
                                    </button>
                                    <button
                                        onClick={() => deleteBrand(brand)}
                                        className="p-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-red-100 hover:text-red-600"
                                        title="Xóa thương hiệu"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Desktop View - Table */}
                <div className="hidden sm:block bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thương hiệu</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chủ sở hữu</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Gói</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quy mô</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Thời hạn</th>
                                <th scope="col" className="relative px-6 py-3">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredBrands.map(brand => {
                                const planColors = getPlanBadgeColor(brand.plan);
                                const daysLeft = getDaysLeft(brand.trial_ends_at);
                                const isExpired = brand.plan === 'trial' && daysLeft <= 0;

                                return (
                                    <tr key={brand.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                                                    {brand.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{brand.name}</div>
                                                    <div className="text-sm text-gray-500">{brand.slug}.bangopos.com</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{brand.owner_name}</div>
                                            <div className="text-sm text-gray-500">{brand.owner_phone || brand.owner_email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${planColors.bg} ${planColors.text}`}>
                                                {getPlanDisplayName(brand.plan)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${brand.text_status === 'active' ? 'bg-green-100 text-green-800' :
                                                brand.text_status === 'suspended' ? 'bg-red-100 text-red-800' : brand.text_status === 'deleted' ? 'bg-gray-200 text-gray-500' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {brand.text_status === 'active' ? 'Hoạt động' :
                                                    brand.text_status === 'suspended' ? 'Đã khóa' : brand.text_status === 'deleted' ? 'Đã xóa' : 'Hết hạn'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                                            {brand.branches_count} CN • {brand.users_count} NV
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {brand.plan === 'trial' ? (
                                                <div className={`text-sm font-medium ${isExpired ? 'text-red-600' : 'text-gray-900'}`}>
                                                    {isExpired ? 'Đã hết hạn' : `${daysLeft} ngày`}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">---</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2">
                                                {brand.plan === 'trial' && (
                                                    <button
                                                        onClick={() => extendTrial(brand)}
                                                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded-md"
                                                    >
                                                        +Gia hạn
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => toggleStatus(brand)}
                                                    className={`${brand.text_status === 'active' ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'
                                                        } hover:opacity-80 px-3 py-1 rounded-md transition-colors`}
                                                >
                                                    {brand.text_status === 'active' ? 'Khóa' : 'Mở'}
                                                </button>
                                                <button
                                                    onClick={() => deleteBrand(brand)}
                                                    className="text-gray-600 bg-gray-100 hover:bg-red-100 hover:text-red-600 px-2 py-1 rounded-md transition-colors"
                                                    title="Xóa thương hiệu"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Empty State */}
                {filteredBrands.length === 0 && (
                    <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                            <Search className="h-8 w-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">Không tìm thấy kết quả</h3>
                        <p className="mt-1 text-gray-500">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
