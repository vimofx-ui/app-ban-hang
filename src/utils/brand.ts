// =============================================================================
// BRAND UTILITIES - Subdomain-based Multi-Tenant Brand Detection
// =============================================================================

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

export interface BrandInfo {
    id: string;
    name: string;
    slug: string;
    logo_url?: string;
    primary_color?: string;
}

// =============================================================================
// SUBDOMAIN DETECTION
// =============================================================================

/**
 * Extract brand slug from current hostname
 * Examples:
 *   - "abc.storelypos.com" → "abc"
 *   - "demo.localhost" → "demo"
 *   - "localhost" → null (main app)
 *   - "storelypos.com" → null (main app)
 */
export function getBrandSlug(): string | null {
    const hostname = window.location.hostname;

    // Local development: check for subdomain.localhost pattern
    if (hostname.includes('localhost')) {
        const parts = hostname.split('.');
        // "demo.localhost" → ["demo", "localhost"]
        if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
            return parts[0];
        }
        return null; // Plain "localhost"
    }

    // Production: check for subdomain.domain.tld pattern
    const parts = hostname.split('.');
    if (parts.length >= 3) {
        // "abc.storelypos.com" → ["abc", "storelypos", "com"]
        // "www.storelypos.com" → should NOT be treated as brand
        const subdomain = parts[0].toLowerCase();
        if (subdomain !== 'www' && subdomain !== 'app') {
            return subdomain;
        }
    }

    return null;
}

/**
 * Get the base domain without subdomain
 * Used for redirecting to main app or creating brand URLs
 */
export function getBaseDomain(): string {
    const hostname = window.location.hostname;

    if (hostname.includes('localhost')) {
        return 'localhost';
    }

    const parts = hostname.split('.');
    if (parts.length >= 2) {
        // Return last 2 parts (domain.tld)
        return parts.slice(-2).join('.');
    }

    return hostname;
}

/**
 * Build URL for a specific brand
 */
export function buildBrandUrl(brandSlug: string): string {
    const baseDomain = getBaseDomain();
    const protocol = window.location.protocol;
    const port = window.location.port;

    if (baseDomain === 'localhost') {
        return `${protocol}//${brandSlug}.localhost${port ? ':' + port : ''}`;
    }

    return `${protocol}//${brandSlug}.${baseDomain}`;
}

// =============================================================================
// BRAND DATA FETCHING
// =============================================================================

/**
 * Fetch brand info by slug from Supabase
 */
export async function getBrandBySlug(slug: string): Promise<BrandInfo | null> {
    if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured');
        return null;
    }

    try {
        const { data, error } = await supabase
            .from('brands')
            .select('id, name, slug, logo_url, primary_color')
            .eq('slug', slug)
            .eq('is_active', true)
            .maybeSingle();

        if (error) throw error;
        return data as BrandInfo | null;
    } catch (err) {
        console.error('Failed to fetch brand by slug:', err);
        return null;
    }
}

/**
 * Check if current subdomain matches user's brand
 */
export async function validateUserBrandAccess(
    userId: string,
    brandSlug: string
): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('brand_id, brands!inner(slug)')
            .eq('id', userId)
            .single();

        if (error) throw error;

        // @ts-ignore - brands is joined
        return data?.brands?.slug === brandSlug;
    } catch (err) {
        console.error('Failed to validate user brand access:', err);
        return false;
    }
}

// =============================================================================
// BRAND CONTEXT STORAGE
// =============================================================================

const BRAND_STORAGE_KEY = 'storely_current_brand';

/**
 * Store current brand info in localStorage
 */
export function storeBrandInfo(brand: BrandInfo): void {
    try {
        localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify(brand));
    } catch (err) {
        console.warn('Failed to store brand info:', err);
    }
}

/**
 * Get stored brand info from localStorage
 */
export function getStoredBrandInfo(): BrandInfo | null {
    try {
        const stored = localStorage.getItem(BRAND_STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (err) {
        return null;
    }
}

/**
 * Clear stored brand info
 */
export function clearStoredBrandInfo(): void {
    try {
        localStorage.removeItem(BRAND_STORAGE_KEY);
    } catch (err) {
        console.warn('Failed to clear brand info:', err);
    }
}
