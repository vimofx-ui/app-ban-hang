import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { createBaseState, withAsync } from './baseStore';
import type { BaseState } from './baseStore';

export interface Brand {
    id: string;
    name: string;
    slug: string | null;
    owner_id: string;
    plan: string;
    status: number; // Legacy
    text_status: 'trial' | 'active' | 'expired' | 'suspended' | 'deleted';
    logo_url: string | null;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
    primary_color?: string;
    secondary_color?: string;
    receipt_footer_text?: string;
    website_url?: string;
    trial_ends_at?: string; // Also add this as it's used in useSubscription
}

export interface Domain {
    id: string;
    brand_id: string;
    domain: string;
    type: 'subdomain' | 'custom';
    verified: boolean;
    ssl_status: 'pending' | 'active' | 'failed';
    created_at: string;
}

interface BrandStoreState extends BaseState {
    currentBrand: Brand | null;
    brands: Brand[]; // For Super Admin view
    domains: Domain[];

    fetchCurrentBrand: () => Promise<void>;
    fetchAllBrands: () => Promise<void>; // Super Admin only
    updateBrand: (brandId: string, updates: Partial<Brand>) => Promise<boolean>;
    softDeleteBrand: (brandId: string) => Promise<{ success: boolean; message?: string }>;
    fetchDomains: (brandId?: string) => Promise<void>;
    addDomain: (brandId: string, domain: string, type: 'subdomain' | 'custom') => Promise<boolean>;
    createBrand: (name: string) => Promise<Brand | null>;
    canAccessFeature: (feature: string) => boolean;
    setCurrentBrand: (brand: Brand | null) => void;
}

export const useBrandStore = create<BrandStoreState>((set, get) => ({
    ...createBaseState(),
    currentBrand: null,
    brands: [],
    domains: [],

    fetchCurrentBrand: async () => {
        await withAsync(set, async () => {
            if (!supabase) return;

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get user's brand_id from profile
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('brand_id')
                .eq('id', user.id)
                .single();

            if (!profile?.brand_id) return;

            const { data, error } = await supabase
                .from('brands')
                .select('*')
                .eq('id', profile.brand_id)
                .single();

            if (error) throw error;
            set({ currentBrand: data as Brand });
        });
    },

    fetchAllBrands: async () => {
        await withAsync(set, async () => {
            if (!supabase) return;

            // For Super Admin: fetch all brands including deleted
            const { data, error } = await supabase
                .from('brands')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            set({ brands: data as Brand[] });
        });
    },

    updateBrand: async (brandId: string, updates: Partial<Brand>) => {
        let success = false;
        await withAsync(set, async () => {
            if (!supabase) throw new Error('No connection');

            const { error } = await supabase
                .from('brands')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', brandId);

            if (error) throw error;

            // Refresh data
            await get().fetchCurrentBrand();
            success = true;
        });
        return success;
    },

    softDeleteBrand: async (brandId: string) => {
        if (!supabase) return { success: false, message: 'No connection' };

        try {
            set({ isLoading: true, error: null });

            const { data, error } = await supabase.rpc('soft_delete_brand', {
                p_brand_id: brandId
            });

            if (error) throw error;

            const result = data as { success: boolean; brand_name?: string; error?: string; users_disabled?: number };

            if (result.success) {
                // Refresh brands list
                await get().fetchAllBrands();
                set({ isLoading: false });
                return {
                    success: true,
                    message: `Đã xóa thương hiệu "${result.brand_name}" thành công. ${result.users_disabled} tài khoản đã bị vô hiệu hóa.`
                };
            } else {
                set({ isLoading: false, error: result.error });
                return { success: false, message: result.error };
            }
        } catch (err: any) {
            set({ isLoading: false, error: err.message });
            return { success: false, message: err.message };
        }
    },

    fetchDomains: async (brandId?: string) => {
        await withAsync(set, async () => {
            if (!supabase) return;

            const currentBrand = get().currentBrand;
            const targetBrandId = brandId || currentBrand?.id;
            if (!targetBrandId) return;

            const { data, error } = await supabase
                .from('domains')
                .select('*')
                .eq('brand_id', targetBrandId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            set({ domains: data as Domain[] });
        });
    },

    addDomain: async (brandId: string, domain: string, type: 'subdomain' | 'custom') => {
        let success = false;
        await withAsync(set, async () => {
            if (!supabase) throw new Error('No connection');

            const { error } = await supabase
                .from('domains')
                .insert({
                    brand_id: brandId,
                    domain: domain.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                    type,
                    verified: type === 'subdomain' // Subdomains are auto-verified
                });

            if (error) throw error;

            await get().fetchDomains(brandId);
            success = true;
        });
        return success;
    },

    createBrand: async (name: string) => {
        let newBrand: Brand | null = null;
        await withAsync(set, async () => {
            if (!supabase) throw new Error('No connection');

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not logged in');

            const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

            const { data, error } = await supabase
                .from('brands')
                .insert({
                    name,
                    slug,
                    owner_id: user.id,
                    plan: 'basic', // Default
                    status: 1,
                    text_status: 'active'
                })
                .select()
                .single();

            if (error) throw error;
            newBrand = data as Brand;
            set({ currentBrand: newBrand });
        });
        return newBrand;
    },

    canAccessFeature: (feature: string) => {
        const brand = get().currentBrand;
        if (!brand) return false;
        // Simple feature gate logic
        if (feature === 'multi_branch') {
            return brand.plan === 'pro' || brand.plan === 'enterprise';
        }
        return true;
    },

    setCurrentBrand: (brand: Brand | null) => set({ currentBrand: brand })
}));
