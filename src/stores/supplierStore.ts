// =============================================================================
// SUPPLIER STORE - Manage suppliers and supplier products
// =============================================================================

import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useBrandStore } from './brandStore';
import { useAuthStore } from './authStore';

export interface Supplier {
    id: string;
    brand_id: string;
    name: string;
    code?: string;
    phone?: string;
    email?: string;
    address?: string;
    tax_code?: string;
    tax_id?: string; // Alias for tax_code
    contact_person?: string;
    bank_account?: string;
    bank_name?: string;
    payment_terms?: string;
    notes?: string;
    is_active: boolean;
    debt_balance: number; // For debt management
    created_at: string;
    updated_at: string;
}

export interface SupplierProduct {
    id: string;
    supplier_id: string;
    product_id: string;
    brand_id: string;
    supplier_sku?: string;
    last_import_price: number;
    min_order_qty: number;
    lead_time_days: number;
    last_import_date?: string;
    is_preferred: boolean;
    notes?: string;
    // Joined fields
    product_name?: string;
    product_sku?: string;
    supplier_name?: string;
}

interface SupplierState {
    suppliers: Supplier[];
    supplierProducts: SupplierProduct[];
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchSuppliers: () => Promise<void>;
    loadSuppliers: () => Promise<void>; // Alias for fetchSuppliers
    fetchSupplierProducts: (supplierId?: string) => Promise<void>;
    getSupplier: (id: string) => Supplier | undefined;
    createSupplier: (supplier: Partial<Supplier>) => Promise<Supplier | null>;
    updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<boolean>;
    deleteSupplier: (id: string) => Promise<boolean>;

    // Debt management
    getSuppliersWithDebt: () => Supplier[];
    payDebt: (supplierId: string, amount: number) => Promise<boolean>;

    // Supplier Products
    addSupplierProduct: (sp: Partial<SupplierProduct>) => Promise<boolean>;
    updateSupplierProduct: (id: string, updates: Partial<SupplierProduct>) => Promise<boolean>;
    removeSupplierProduct: (id: string) => Promise<boolean>;
    getBestSupplierForProduct: (productId: string) => SupplierProduct | null;
    getProductSuppliers: (productId: string) => SupplierProduct[];
}

export const useSupplierStore = create<SupplierState>((set, get) => ({
    suppliers: [],
    supplierProducts: [],
    isLoading: false,
    error: null,

    fetchSuppliers: async () => {
        if (!isSupabaseConfigured()) {
            console.log('[SupplierStore] Supabase not configured');
            return;
        }

        set({ isLoading: true, error: null });
        try {
            const brandId = useBrandStore.getState().currentBrand?.id || useAuthStore.getState().brandId;
            console.log('[SupplierStore] Fetching suppliers for brandId:', brandId);

            if (!brandId) throw new Error('No brand selected');

            // Query tất cả suppliers của brand (bỏ filter is_active để debug)
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .eq('brand_id', brandId)
                .order('name');

            console.log('[SupplierStore] Query result:', { data, error });

            if (error) throw error;

            // Filter is_active ở frontend thay vì DB để debug
            const activeSuppliers = (data || []).filter(s => s.is_active !== false);
            const suppliers = activeSuppliers.map(s => ({ ...s, debt_balance: s.debt_balance || 0 }));

            console.log('[SupplierStore] Loaded suppliers:', suppliers.length);
            set({ suppliers, isLoading: false });
        } catch (err: any) {
            console.error('[SupplierStore] Error:', err);
            set({ error: err.message, isLoading: false });
        }
    },

    // Alias for backward compatibility
    loadSuppliers: async () => {
        return get().fetchSuppliers();
    },

    // Get suppliers with outstanding debt
    getSuppliersWithDebt: () => {
        return get().suppliers.filter(s => (s.debt_balance || 0) > 0);
    },

    // Pay supplier debt
    payDebt: async (supplierId: string, amount: number) => {
        if (!isSupabaseConfigured()) return false;

        try {
            const supplier = get().suppliers.find(s => s.id === supplierId);
            if (!supplier) return false;

            const newBalance = Math.max(0, (supplier.debt_balance || 0) - amount);

            const { error } = await supabase
                .from('suppliers')
                .update({ debt_balance: newBalance, updated_at: new Date().toISOString() })
                .eq('id', supplierId);

            if (error) throw error;

            set(state => ({
                suppliers: state.suppliers.map(s =>
                    s.id === supplierId ? { ...s, debt_balance: newBalance } : s
                )
            }));
            return true;
        } catch (err: any) {
            set({ error: err.message });
            return false;
        }
    },

    fetchSupplierProducts: async (supplierId?: string) => {
        if (!isSupabaseConfigured()) return;

        set({ isLoading: true, error: null });
        try {
            const brandId = useBrandStore.getState().currentBrand?.id || useAuthStore.getState().brandId;
            if (!brandId) throw new Error('No brand selected');

            let query = supabase
                .from('supplier_products')
                .select(`
                    *,
                    suppliers(name),
                    products(name, sku)
                `)
                .eq('brand_id', brandId);

            if (supplierId) {
                query = query.eq('supplier_id', supplierId);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            const mapped = (data || []).map((sp: any) => ({
                ...sp,
                supplier_name: sp.suppliers?.name,
                product_name: sp.products?.name,
                product_sku: sp.products?.sku,
            }));

            set({ supplierProducts: mapped, isLoading: false });
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
        }
    },

    getSupplier: (id: string) => {
        return get().suppliers.find(s => s.id === id);
    },

    createSupplier: async (supplier: Partial<Supplier>) => {
        if (!isSupabaseConfigured()) return null;

        try {
            const brandId = useBrandStore.getState().currentBrand?.id || useAuthStore.getState().brandId;
            if (!brandId) throw new Error('No brand selected');

            const { data, error } = await supabase
                .from('suppliers')
                .insert({ ...supplier, brand_id: brandId })
                .select()
                .single();

            if (error) throw error;

            set(state => ({ suppliers: [...state.suppliers, data] }));
            return data;
        } catch (err: any) {
            set({ error: err.message });
            return null;
        }
    },

    updateSupplier: async (id: string, updates: Partial<Supplier>) => {
        if (!isSupabaseConfigured()) return false;

        try {
            const { error } = await supabase
                .from('suppliers')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            set(state => ({
                suppliers: state.suppliers.map(s =>
                    s.id === id ? { ...s, ...updates } : s
                )
            }));
            return true;
        } catch (err: any) {
            set({ error: err.message });
            return false;
        }
    },

    deleteSupplier: async (id: string) => {
        if (!isSupabaseConfigured()) return false;

        try {
            // Soft delete - set is_active = false
            const { error } = await supabase
                .from('suppliers')
                .update({ is_active: false })
                .eq('id', id);

            if (error) throw error;

            set(state => ({
                suppliers: state.suppliers.filter(s => s.id !== id)
            }));
            return true;
        } catch (err: any) {
            set({ error: err.message });
            return false;
        }
    },

    addSupplierProduct: async (sp: Partial<SupplierProduct>) => {
        if (!isSupabaseConfigured()) return false;

        try {
            const brandId = useBrandStore.getState().currentBrand?.id || useAuthStore.getState().brandId;
            if (!brandId) throw new Error('No brand selected');

            const { data, error } = await supabase
                .from('supplier_products')
                .insert({ ...sp, brand_id: brandId })
                .select()
                .single();

            if (error) throw error;

            set(state => ({ supplierProducts: [...state.supplierProducts, data] }));
            return true;
        } catch (err: any) {
            set({ error: err.message });
            return false;
        }
    },

    updateSupplierProduct: async (id: string, updates: Partial<SupplierProduct>) => {
        if (!isSupabaseConfigured()) return false;

        try {
            const { error } = await supabase
                .from('supplier_products')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            set(state => ({
                supplierProducts: state.supplierProducts.map(sp =>
                    sp.id === id ? { ...sp, ...updates } : sp
                )
            }));
            return true;
        } catch (err: any) {
            set({ error: err.message });
            return false;
        }
    },

    removeSupplierProduct: async (id: string) => {
        if (!isSupabaseConfigured()) return false;

        try {
            const { error } = await supabase
                .from('supplier_products')
                .delete()
                .eq('id', id);

            if (error) throw error;

            set(state => ({
                supplierProducts: state.supplierProducts.filter(sp => sp.id !== id)
            }));
            return true;
        } catch (err: any) {
            set({ error: err.message });
            return false;
        }
    },

    getBestSupplierForProduct: (productId: string) => {
        const suppliers = get().supplierProducts.filter(sp => sp.product_id === productId);
        if (suppliers.length === 0) return null;

        // Prefer: is_preferred > lowest price > most recent import
        const preferred = suppliers.find(sp => sp.is_preferred);
        if (preferred) return preferred;

        return suppliers.sort((a, b) => a.last_import_price - b.last_import_price)[0];
    },

    getProductSuppliers: (productId: string) => {
        return get().supplierProducts.filter(sp => sp.product_id === productId);
    },
}));
