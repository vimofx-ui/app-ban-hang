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

                // Danh sách các subdomain đặc biệt không phải là brand
                const RESERVED_SUBDOMAINS = ['www', 'api', 'admin', 'app', 'dashboard', 'staging', 'dev'];

                // Danh sách domain chính (không có subdomain)
                const MAIN_DOMAINS = ['localhost', 'bangopos.com', 'vercel.app'];

                // Tách hostname thành các phần
                // Ví dụ: cafeabc.bangopos.com -> ['cafeabc', 'bangopos', 'com']
                // Ví dụ: cafeabc.localhost -> ['cafeabc', 'localhost']
                const parts = hostname.split('.');

                let subdomain: string | null = null;

                // Xử lý localhost
                if (hostname === 'localhost' || hostname === '127.0.0.1') {
                    // Không có subdomain trên localhost thường
                    console.log('[DomainResolver] Main localhost, no subdomain');
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

                // Xử lý subdomain.localhost (vd: cafeabc.localhost)
                if (parts.length === 2 && parts[1] === 'localhost') {
                    subdomain = parts[0];
                    console.log('[DomainResolver] Local subdomain detected:', subdomain);
                }

                // Xử lý subdomain.bangopos.com (vd: cafeabc.bangopos.com)
                if (parts.length === 3 && parts[1] === 'bangopos' && parts[2] === 'com') {
                    subdomain = parts[0];
                    console.log('[DomainResolver] Production subdomain detected:', subdomain);
                }

                // Xử lý subdomain trên Vercel preview (vd: cafeabc-bangopos.vercel.app)
                if (hostname.endsWith('.vercel.app')) {
                    // Vercel preview URLs có format: project-name.vercel.app
                    // Hoặc: branch-project-name.vercel.app
                    // Tạm thời bỏ qua subdomain trên Vercel preview
                    console.log('[DomainResolver] Vercel preview, skipping subdomain resolution');
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

    // Production: https://cafeabc.bangopos.com
    return `https://${brandSlug}.bangopos.com`;
}

/**
 * Helper để kiểm tra subdomain hợp lệ
 */
export function isValidSubdomain(slug: string): boolean {
    // Chỉ cho phép chữ thường, số và dấu gạch ngang
    const regex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
    return regex.test(slug);
}
