import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useAffiliateStore } from '@/stores/affiliateStore';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Users, Check } from 'lucide-react';

export function AffiliateRegisterPage() {
    const navigate = useNavigate();
    const { registerTenant, isLoading: isAuthLoading, error: authError } = useAuthStore();
    const { registerAffiliate, isLoading: isAffiliateLoading } = useAffiliateStore();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: '',
        phone: '',
        brandName: '' // Will use this to create a demo brand for them
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        // 1. Register User & Brand (SaaS logic)
        // Note: modify register in authStore to accept metadata or handle brand creation manually if needed.
        // Assuming current authStore.register handles basic user creation.
        // We'll treat them as a "Demo Brand" owner primarily.

        // Generate a slug for the brand
        const slug = formData.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000);

        // Use registerTenant to create User + Brand + Main Branch
        // Params: registerTenant(email, password, name, brandName, brandSlug, phone, referralCode?)
        const success = await registerTenant(formData.email, formData.password, formData.fullName, formData.brandName || 'Demo Store', slug, formData.phone);


        if (success) {
            // 2. Auto-register as Affiliate
            // We need to wait for the session to be established? 
            // The register function in authStore updates the session.

            // Try to register as affiliate immediately
            await registerAffiliate();

            navigate('/doi-tac');
        }
    };

    const isLoading = isAuthLoading || isAffiliateLoading;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <div className="h-12 w-12 bg-green-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                        <Users size={28} />
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Đăng ký Đối tác
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Tham gia mạng lưới Bango POS & nhận hoa hồng trọn đời
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
                    <ErrorAlert message={authError} />

                    <form className="space-y-4" onSubmit={handleRegister}>
                        <div>
                            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                                Họ và tên
                            </label>
                            <div className="mt-1">
                                <input
                                    id="fullName"
                                    name="fullName"
                                    type="text"
                                    required
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="brandName" className="block text-sm font-medium text-gray-700">
                                Tên gian hàng Demo (để bạn dùng thử)
                            </label>
                            <div className="mt-1">
                                <input
                                    id="brandName"
                                    name="brandName"
                                    type="text"
                                    placeholder="VD: Cửa hàng Mẫu"
                                    required
                                    value={formData.brandName}
                                    onChange={handleChange}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                                Số điện thoại
                            </label>
                            <div className="mt-1">
                                <input
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    required
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                Email
                            </label>
                            <div className="mt-1">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Mật khẩu
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        <div className="flex items-start">
                            <div className="flex items-center h-5">
                                <input
                                    id="terms"
                                    name="terms"
                                    type="checkbox"
                                    required
                                    className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                                />
                            </div>
                            <div className="ml-3 text-sm">
                                <label htmlFor="terms" className="font-medium text-gray-700">
                                    Tôi đồng ý với <a href="#" className="text-green-600 hover:text-green-500">Chính sách đối tác</a>
                                </label>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-70"
                            >
                                {isLoading ? 'Đang tạo tài khoản...' : 'Đăng ký ngay'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-gray-500">Đã có tài khoản?</span>
                            </div>
                        </div>

                        <div className="mt-6">
                            <Link
                                to="/doi-tac/dang-nhap"
                                className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Đăng nhập lại
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
