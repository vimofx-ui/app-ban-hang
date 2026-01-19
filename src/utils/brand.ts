import { supabase } from '@/lib/supabase';
import type { Brand } from '@/stores/brandStore';

export type BrandInfo = Brand;

export function getBrandSlug(): string | null {
    const host = window.location.hostname;

    // Localhost handling for development
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
        // Try getting from local storage or query param for testing
        const params = new URLSearchParams(window.location.search);
        const brandParam = params.get('brand');
        if (brandParam) return brandParam;

        // Default to null (or specific fallback if configured)
        return localStorage.getItem('dev_brand_slug');
    }

    const parts = host.split('.');

    // Standard domain: brand.bangopos.com -> parts length >= 3
    // Cloudflare Pages: project.pages.dev -> treat as root
    if (host.endsWith('.pages.dev') || host.endsWith('.vercel.app')) return null;

    if (parts.length < 3) return null; // Root domain

    return parts[0];
}

export function isSuperAdminDomain(): boolean {
    const slug = getBrandSlug();
    return slug === 'admin';
}

export function getAppUrl(subdomain: string): string {
    const protocol = window.location.protocol;
    const host = window.location.host;
    const parts = host.split('.');

    if (host.includes('localhost')) {
        return `${protocol}//${host}?brand=${subdomain}`;
    }

    // Replace subdomain or add if missing
    if (parts.length >= 3) {
        parts[0] = subdomain;
        return `${protocol}//${parts.join('.')}`;
    }

    return `${protocol}//${subdomain}.${host}`;
}

export const getBrandBySlug = async (slug: string): Promise<BrandInfo | null> => {
    if (!supabase) return null;
    try {
        const { data, error } = await supabase.from('brands').select('*').eq('slug', slug).maybeSingle();
        if (error) {
            console.warn('Error fetching brand by slug:', error);
            return null;
        }
        return data as BrandInfo;
    } catch (e) {
        console.error(e);
        return null;
    }
};

export const validateUserBrandAccess = async (userId: string, slug: string): Promise<boolean> => {
    if (!supabase) return false;
    // Check if user has profile linked to this brand or is owner
    // This logic depends on schema. Assuming user_profiles has brand_id.
    const { data } = await supabase.from('user_profiles').select('brand_id, role').eq('id', userId).single();
    if (!data) return false;

    // Also fetch brand id
    const brand = await getBrandBySlug(slug);
    if (!brand) return false;

    // Check permissions
    // If Admin/SuperAdmin, allow?
    if (data.role === 'admin' && slug === 'admin') return true;

    return data.brand_id === brand.id;
};

export const storeBrandInfo = (brand: BrandInfo) => {
    try {
        localStorage.setItem('current_brand_info', JSON.stringify(brand));
    } catch (e) {
        // Ignore storage errors
    }
};
