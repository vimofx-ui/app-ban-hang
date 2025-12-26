// =============================================================================
// BRAND GUARD - Route Guard for Multi-Tenant Brand Validation
// =============================================================================

import { useEffect, useState } from 'react';
import { getBrandSlug, getBrandBySlug, validateUserBrandAccess, storeBrandInfo, type BrandInfo } from '@/utils/brand';
import { useBrandStore } from '@/stores/brandStore';
import { useAuthStore } from '@/stores/authStore';

interface BrandGuardProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

type BrandGuardStatus = 'loading' | 'valid' | 'invalid' | 'no-subdomain';

/**
 * BrandGuard Component
 * 
 * Validates the current subdomain against the database and user's access.
 * - If no subdomain: renders children (main app)
 * - If valid subdomain + user access: sets brand context and renders children
 * - If invalid subdomain: shows error/redirect
 */
export function BrandGuard({ children, fallback }: BrandGuardProps) {
    const [status, setStatus] = useState<BrandGuardStatus>('loading');
    const [brandInfo, setBrandInfo] = useState<BrandInfo | null>(null);
    const { setCurrentBrand } = useBrandStore();
    const { user, isAuthenticated } = useAuthStore();

    useEffect(() => {
        const validateBrand = async () => {
            const slug = getBrandSlug();

            // No subdomain - main app, allow through
            if (!slug) {
                setStatus('no-subdomain');
                return;
            }

            // Fetch brand by slug
            const brand = await getBrandBySlug(slug);

            if (!brand) {
                setStatus('invalid');
                console.error(`Brand not found for slug: ${slug}`);
                return;
            }

            // If user is authenticated, validate they have access to this brand
            if (isAuthenticated && user?.id) {
                const hasAccess = await validateUserBrandAccess(user.id, slug);
                if (!hasAccess) {
                    console.warn(`User ${user.id} does not have access to brand: ${slug}`);
                    // Still allow - they might be logging in, let auth flow handle it
                }
            }

            // Brand is valid - set context
            setBrandInfo(brand);
            setCurrentBrand({
                id: brand.id,
                name: brand.name,
                slug: brand.slug,
                logo_url: brand.logo_url,
                // Add other fields as needed
            });
            storeBrandInfo(brand);
            setStatus('valid');
        };

        validateBrand();
    }, [user?.id, isAuthenticated, setCurrentBrand]);

    // Loading state
    if (status === 'loading') {
        return (
            fallback || (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f9fafb'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            border: '4px solid #e5e7eb',
                            borderTopColor: '#16a34a',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 16px'
                        }} />
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        <p style={{ color: '#6b7280', fontSize: '14px' }}>Đang tải thông tin cửa hàng...</p>
                    </div>
                </div>
            )
        );
    }

    // Invalid brand
    if (status === 'invalid') {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#fef2f2'
            }}>
                <div style={{ textAlign: 'center', maxWidth: '400px', padding: '32px' }}>
                    <div style={{ fontSize: '64px', marginBottom: '16px' }}>🏪</div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#991b1b', marginBottom: '8px' }}>
                        Không tìm thấy cửa hàng
                    </h1>
                    <p style={{ color: '#b91c1c', marginBottom: '24px' }}>
                        Địa chỉ cửa hàng không tồn tại hoặc đã bị vô hiệu hóa.
                    </p>
                    <a
                        href="https://storelypos.com"
                        style={{
                            display: 'inline-block',
                            padding: '12px 24px',
                            backgroundColor: '#16a34a',
                            color: 'white',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontWeight: 600
                        }}
                    >
                        Về trang chủ Storely
                    </a>
                </div>
            </div>
        );
    }

    // Valid brand or no subdomain - render app
    return <>{children}</>;
}

/**
 * Hook to get current brand context
 */
export function useCurrentBrand(): BrandInfo | null {
    const { currentBrand } = useBrandStore();

    if (currentBrand) {
        return {
            id: currentBrand.id,
            name: currentBrand.name,
            slug: currentBrand.slug || '',
            logo_url: currentBrand.logo_url,
            primary_color: currentBrand.primary_color
        };
    }

    return null;
}

/**
 * Hook to check if we're in a subdomain context
 */
export function useIsSubdomainContext(): boolean {
    return getBrandSlug() !== null;
}
