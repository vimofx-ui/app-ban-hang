import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface DomainInfo {
    brandId: string | null;
    brandSlug: string | null;
    brandName: string | null;
    isResolved: boolean;
    isLoading: boolean;
    error: string | null;
}

/**
 * Hook để phân giải subdomain thành brand_id
 * 
 * Cách hoạt động:
 * 1. Đọc hostname từ window.location (vd: cafeabc.localhost, cafeabc.bangopos.com)
 * 2. Tách phần subdomain (cafeabc)
 * 3. Query database để tìm brand có slug = subdomain
 * 4. Trả về brandId nếu tìm thấy
 * 
 * Các trường hợp đặc biệt:
 * - localhost:5173 -> Không có subdomain, trả về null (dùng brand mặc định từ auth)
 * - www.bangopos.com -> Bỏ qua "www", trả về null  
 * - admin.bangopos.com -> Có thể là reserved subdomain
 * - cafeabc.localhost:5173 -> Subdomain "cafeabc" cho testing local
 */
export function useDomainResolver() {
    const [domainInfo, setDomainInfo] = useState<DomainInfo>({
        brandId: null,
        brandSlug: null,
        brandName: null,
        isResolved: false,
        isLoading: true,
        error: null
    });

    useEffect(() => {
        const resolveDomain = async () => {
            try {
                const hostname = window.location.hostname;
                console.log('[DomainResolver] Hostname:', hostname);

                // Get root domain from env or default to bangopos.com
                const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || 'bangopos.com';

                // Danh sách các subdomain đặc biệt không phải là brand
                const RESERVED_SUBDOMAINS = ['www', 'api', 'admin', 'app', 'dashboard', 'staging', 'dev', 'pos'];

                let subdomain: string | null = null;

                // Xử lý localhost
                if (hostname === 'localhost' || hostname === '127.0.0.1') {
                    console.log('[DomainResolver] Main localhost, no subdomain');
                    // Reset
                }
                // Xử lý subdomain.localhost (vd: cafeabc.localhost)
                else if (hostname.endsWith('.localhost')) {
                    const parts = hostname.split('.');
                    if (parts.length > 1) {
                        subdomain = parts[0];
                        console.log('[DomainResolver] Local subdomain detected:', subdomain);
                    }
                }
                // Xử lý Production Domain (vd: cafeabc.yourdomain.com)
                else if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
                    // domain: cafeabc.yourdomain.com
                    // root: yourdomain.com
                    // -> cafeabc
                    const partToRemove = `.${ROOT_DOMAIN}`;
                    subdomain = hostname.substring(0, hostname.length - partToRemove.length);
                    console.log('[DomainResolver] Production subdomain detected:', subdomain);
                }
                // Xử lý Vercel/Cloudflare Preview
                else if (hostname.endsWith('.vercel.app') || hostname.endsWith('.pages.dev')) {
                    console.log('[DomainResolver] Preview environment, skipping subdomain');
                }

                // Nếu subdomain là reserved, bỏ qua
                if (subdomain && RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) {
                    console.log('[DomainResolver] Reserved subdomain, skipping:', subdomain);
                    subdomain = null;
                }

                if (!subdomain) {
                    setDomainInfo({
                        brandId: null,
                        brandSlug: null,
                        brandName: null,
                        isResolved: true,
                        isLoading: false,
                        error: null
                    });
                    return;
                }

                // Nếu subdomain là reserved, bỏ qua
                if (subdomain && RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) {
                    console.log('[DomainResolver] Reserved subdomain, skipping:', subdomain);
                    setDomainInfo({
                        brandId: null,
                        brandSlug: null,
                        brandName: null,
                        isResolved: true,
                        isLoading: false,
                        error: null
                    });
                    return;
                }

                // Nếu không có subdomain
                if (!subdomain) {
                    console.log('[DomainResolver] No subdomain found');
                    setDomainInfo({
                        brandId: null,
                        brandSlug: null,
                        brandName: null,
                        isResolved: true,
                        isLoading: false,
                        error: null
                    });
                    return;
                }

                // Query database để tìm brand
                console.log('[DomainResolver] Looking up brand for slug:', subdomain);

                if (!supabase) {
                    throw new Error('Supabase not initialized');
                }

                // Tìm trong bảng brands theo slug
                const { data: brand, error } = await supabase
                    .from('brands')
                    .select('id, slug, name')
                    .eq('slug', subdomain.toLowerCase())
                    .single();

                if (error) {
                    if (error.code === 'PGRST116') {
                        // Không tìm thấy brand
                        console.log('[DomainResolver] Brand not found for slug:', subdomain);
                        setDomainInfo({
                            brandId: null,
                            brandSlug: subdomain,
                            brandName: null,
                            isResolved: true,
                            isLoading: false,
                            error: 'Brand not found'
                        });
                        return;
                    }
                    throw error;
                }

                console.log('[DomainResolver] Brand found:', brand);
                setDomainInfo({
                    brandId: brand.id,
                    brandSlug: brand.slug,
                    brandName: brand.name,
                    isResolved: true,
                    isLoading: false,
                    error: null
                });

            } catch (err) {
                console.error('[DomainResolver] Error:', err);
                setDomainInfo({
                    brandId: null,
                    brandSlug: null,
                    brandName: null,
                    isResolved: true,
                    isLoading: false,
                    error: err instanceof Error ? err.message : 'Unknown error'
                });
            }
        };

        resolveDomain();
    }, []);

    return domainInfo;
}

/**
 * Helper function để tạo URL với subdomain
 * Dùng cho việc redirect hoặc share link
 */
export function getBrandUrl(brandSlug: string): string {
    const isLocalhost = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.endsWith('.localhost');

    if (isLocalhost) {
        // Local dev: http://cafeabc.localhost:5173
        const port = window.location.port ? `:${window.location.port}` : '';
        return `http://${brandSlug}.localhost${port}`;
    }

    // Production: https://cafeabc.yourdomain.com
    const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || 'bangopos.com';
    return `https://${brandSlug}.${ROOT_DOMAIN}`;
}

/**
 * Helper để kiểm tra subdomain hợp lệ
 */
export function isValidSubdomain(slug: string): boolean {
    // Chỉ cho phép chữ thường, số và dấu gạch ngang
    const regex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
    return regex.test(slug);
}
