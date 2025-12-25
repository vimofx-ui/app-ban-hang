// =============================================================================
// BRAND STORE - Multi-tenant Brand Management
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

export interface Brand {
    id: string;
    name: string;
    owner_id: string;
    plan: 'free' | 'basic' | 'pro';
    status: number;
    logo_url?: string;
    created_at: string;
    updated_at: string;
}

interface BrandState {
    currentBrand: Brand | null;
    brands: Brand[];
    loading: boolean;
    error: string | null;

    // Actions
    fetchCurrentBrand: () => Promise<void>;
    fetchBrands: () => Promise<void>;
    updateBrand: (id: string, updates: Partial<Brand>) => Promise<void>;
    setCurrentBrand: (brand: Brand | null) => void;
}

export const useBrandStore = create<BrandState>()(
    persist(
        (set, get) => ({
            currentBrand: null,
            brands: [],
            loading: false,
            error: null,

            fetchCurrentBrand: async () => {
                set({ loading: true, error: null });
                try {
                    // Get user's brand_id from profile
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) throw new Error('Not authenticated');

                    const { data: profile } = await supabase
                        .from('user_profiles')
                        .select('brand_id')
                        .eq('id', user.id)
                        .single();

                    if (!profile?.brand_id) {
                        set({ currentBrand: null, loading: false });
                        return;
                    }

                    const { data: brand, error } = await supabase
                        .from('brands')
                        .select('*')
                        .eq('id', profile.brand_id)
                        .single();

                    if (error) throw error;
                    set({ currentBrand: brand as Brand });
                } catch (err: any) {
                    console.error('fetchCurrentBrand error:', err);
                    set({ error: err.message });
                } finally {
                    set({ loading: false });
                }
            },

            fetchBrands: async () => {
                set({ loading: true, error: null });
                try {
                    const { data, error } = await supabase
                        .from('brands')
                        .select('*')
                        .order('created_at', { ascending: false });

                    if (error) throw error;
                    set({ brands: data as Brand[] });
                } catch (err: any) {
                    console.error('fetchBrands error:', err);
                    set({ error: err.message });
                } finally {
                    set({ loading: false });
                }
            },

            updateBrand: async (id, updates) => {
                set({ loading: true, error: null });
                try {
                    const { error } = await supabase
                        .from('brands')
                        .update({ ...updates, updated_at: new Date().toISOString() })
                        .eq('id', id);

                    if (error) throw error;

                    // Update local state
                    set(state => ({
                        currentBrand: state.currentBrand?.id === id
                            ? { ...state.currentBrand, ...updates }
                            : state.currentBrand,
                        brands: state.brands.map(b =>
                            b.id === id ? { ...b, ...updates } : b
                        )
                    }));
                } catch (err: any) {
                    console.error('updateBrand error:', err);
                    set({ error: err.message });
                } finally {
                    set({ loading: false });
                }
            },

            setCurrentBrand: (brand) => {
                set({ currentBrand: brand });
            }
        }),
        {
            name: 'brand-store',
            partialize: (state) => ({ currentBrand: state.currentBrand })
        }
    )
);
