import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getBrandSlug, isSuperAdminDomain } from '@/utils/brand';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface BrandGuardProps {
    children: React.ReactNode;
}

export function BrandGuard({ children }: BrandGuardProps) {
    const [loading, setLoading] = useState(true);
    const [isValid, setIsValid] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { setBrandId } = useAuthStore();

    useEffect(() => {
        async function checkBrand() {
            setLoading(true);
            const slug = getBrandSlug();
            const isSuperAdmin = isSuperAdminDomain();

            // 1. Super Admin Domain
            if (isSuperAdmin) {
                // If accessing admin portal, we are good
                setIsValid(true);
                setLoading(false);
                return;
            }

            // 2. Landing Page or Root
            if (!slug) {
                // Determine if we are on landing page or app root
                setIsValid(true);
                setLoading(false);
                return;
            }

            // 3. Tenant Domain - Verify Brand exists
            try {
                // In a real scenario, we query the 'brands' table
                // For now, we mock it or check Supabase if table exists
                const { data, error } = await supabase
                    .from('brands')
                    .select('id')
                    .eq('slug', slug)
                    .single();

                if (data) {
                    setBrandId(data.id);
                    setIsValid(true);
                } else {
                    console.warn(`Brand not found for slug: ${slug}`);
                    // Fallback for development/demo: if it starts with "brand_", assume valid mock
                    if (slug.startsWith('demo') || slug === 'storely' || slug === 'bango') {
                        setIsValid(true);
                    } else {
                        setIsValid(false);
                    }
                }
            } catch (err) {
                console.error('Error checking brand:', err);
                // Fallback for offline/demo
                setIsValid(true);
            } finally {
                setLoading(false);
            }
        }

        checkBrand();
    }, [location.pathname]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 font-medium">Đang tải dữ liệu cửa hàng...</p>
                </div>
            </div>
        );
    }

    if (!isValid) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Không tìm thấy cửa hàng</h1>
                    <p className="text-gray-500 mb-6">
                        Địa chỉ <strong>{window.location.host}</strong> không tồn tại hoặc đã bị xóa.
                    </p>
                    <a href="/" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-primary hover:bg-primary-dark transition-all">
                        Về trang chủ
                    </a>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
