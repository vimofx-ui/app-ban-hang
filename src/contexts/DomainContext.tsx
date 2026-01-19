import React, { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useDomainResolver } from '@/hooks/useDomainResolver';
import { useAuthStore } from '@/stores/authStore';

interface DomainContextType {
    brandId: string | null;
    brandSlug: string | null;
    brandName: string | null;
    isResolved: boolean;
    isLoading: boolean;
    error: string | null;
    isSubdomainAccess: boolean; // true nếu user truy cập qua subdomain
}

const DomainContext = createContext<DomainContextType>({
    brandId: null,
    brandSlug: null,
    brandName: null,
    isResolved: false,
    isLoading: true,
    error: null,
    isSubdomainAccess: false
});

export function useDomain() {
    return useContext(DomainContext);
}

interface DomainProviderProps {
    children: ReactNode;
}

/**
 * Provider component để wrap toàn bộ app
 * Tự động resolve subdomain và set brand context
 */
export function DomainProvider({ children }: DomainProviderProps) {
    const domainInfo = useDomainResolver();
    const { setBrandId } = useAuthStore();

    // Khi subdomain được resolve, set brandId vào AuthStore
    useEffect(() => {
        if (domainInfo.isResolved && domainInfo.brandId) {
            console.log('[DomainProvider] Setting brandId from subdomain:', domainInfo.brandId);
            setBrandId(domainInfo.brandId);
        }
    }, [domainInfo.isResolved, domainInfo.brandId, setBrandId]);

    const contextValue: DomainContextType = {
        ...domainInfo,
        isSubdomainAccess: domainInfo.brandSlug !== null && domainInfo.brandId !== null
    };

    // Loading state
    if (domainInfo.isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Đang tải...</p>
                </div>
            </div>
        );
    }

    // Error: Brand not found (chỉ hiện khi có subdomain nhưng không tìm thấy brand)
    if (domainInfo.isResolved && domainInfo.brandSlug && !domainInfo.brandId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Không tìm thấy cửa hàng</h1>
                    <p className="text-gray-600 mb-6">
                        Cửa hàng <strong className="text-gray-900">{domainInfo.brandSlug}</strong> không tồn tại hoặc đã bị vô hiệu hóa.
                    </p>
                    <a
                        href="https://bangopos.com"
                        className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                    >
                        Về trang chủ
                    </a>
                </div>
            </div>
        );
    }

    return (
        <DomainContext.Provider value={contextValue}>
            {children}
        </DomainContext.Provider>
    );
}
