// =============================================================================
// SUPPLIER STORE - Supplier Management State
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Supplier } from '@/types';
import { generateId } from '@/lib/utils';
import { useBrandStore } from '@/stores/brandStore';

// Mock suppliers for demo
const MOCK_SUPPLIERS: Supplier[] = [
    {
        id: 'sup-001',
        code: 'NCC-001',
        name: 'Công ty CP Thực phẩm Sài Gòn',
        contact_person: 'Nguyễn Văn A',
        phone: '0901234567',
        email: 'lienhe@saigonfood.vn',
        address: '123 Nguyễn Văn Linh, Q.7, TP.HCM',
        tax_id: '0301234567',
        payment_terms: 30,
        notes: 'Nhà cung cấp chính',
        is_active: true,
        debt_balance: 5000000,
        created_at: new Date().toISOString(),
    },
    {
        id: 'sup-002',
        code: 'NCC-002',
        name: 'Đại lý Nước giải khát Miền Nam',
        contact_person: 'Trần Thị B',
        phone: '0912345678',
        email: 'order@nuocngot.vn',
        address: '456 Điện Biên Phủ, Q.3, TP.HCM',
        payment_terms: 15,
        is_active: true,
        debt_balance: 0,
        created_at: new Date().toISOString(),
    },
    {
        id: 'sup-003',
        code: 'NCC-003',
        name: 'Kho Bánh Kẹo Bình Dương',
        contact_person: 'Lê Văn C',
        phone: '0923456789',
        address: 'KCN Sóng Thần, Bình Dương',
        payment_terms: 7,
        is_active: true,
        debt_balance: 2500000,
        created_at: new Date().toISOString(),
    },
];

export interface SupplierState {
    suppliers: Supplier[];
    isLoading: boolean;
    error: string | null;

    loadSuppliers: () => Promise<void>;
    addSupplier: (supplier: Omit<Supplier, 'id' | 'created_at'>) => Promise<Supplier>;
    updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<void>;
    deleteSupplier: (id: string) => Promise<void>;
    getSupplierById: (id: string) => Supplier | undefined;

    // Debt management
    getSuppliersWithDebt: () => Supplier[];
    payDebt: (id: string, amount: number) => Promise<void>;
    addDebt: (id: string, amount: number) => Promise<void>;
}

export const useSupplierStore = create<SupplierState>()(
    persist(
        (set, get) => ({
            suppliers: [],
            isLoading: false,
            error: null,

            loadSuppliers: async () => {
                set({ isLoading: true, error: null });

                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { data, error } = await supabase
                            .from('suppliers')
                            .select('*')
                            .eq('is_active', true)
                            .order('name');

                        if (error) throw error;
                        set({ suppliers: data as Supplier[], isLoading: false });
                    } catch (err) {
                        console.error('Failed to load suppliers:', err);
                        set({ error: 'Không thể tải nhà cung cấp', isLoading: false, suppliers: MOCK_SUPPLIERS });
                    }
                } else {
                    set({ suppliers: MOCK_SUPPLIERS, isLoading: false });
                }
            },

            addSupplier: async (supplierData) => {
                const currentBrand = useBrandStore.getState().currentBrand;
                const newSupplier: Supplier = {
                    ...supplierData,
                    id: generateId(),
                    brand_id: currentBrand?.id,
                    created_at: new Date().toISOString(),
                };

                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { error } = await supabase.from('suppliers').insert(newSupplier);
                        if (error) throw error;
                    } catch (err) {
                        console.error('Failed to add supplier:', err);
                        throw err;
                    }
                }

                set((state) => ({ suppliers: [...state.suppliers, newSupplier] }));
                return newSupplier;
            },

            updateSupplier: async (id, updates) => {
                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { error } = await supabase.from('suppliers').update(updates).eq('id', id);
                        if (error) throw error;
                    } catch (err) {
                        console.error('Failed to update supplier:', err);
                        throw err;
                    }
                }

                set((state) => ({
                    suppliers: state.suppliers.map((s) => (s.id === id ? { ...s, ...updates } : s)),
                }));
            },

            deleteSupplier: async (id) => {
                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { error } = await supabase.from('suppliers').update({ is_active: false }).eq('id', id);
                        if (error) throw error;
                    } catch (err) {
                        console.error('Failed to delete supplier:', err);
                        throw err;
                    }
                }

                set((state) => ({ suppliers: state.suppliers.filter((s) => s.id !== id) }));
            },

            getSupplierById: (id) => get().suppliers.find((s) => s.id === id),

            // Debt management
            getSuppliersWithDebt: () => {
                return get().suppliers
                    .filter((s) => s.debt_balance > 0)
                    .sort((a, b) => b.debt_balance - a.debt_balance);
            },

            payDebt: async (id, amount) => {
                const supplier = get().getSupplierById(id);
                if (!supplier) return;

                const newDebt = Math.max(0, supplier.debt_balance - amount);
                await get().updateSupplier(id, { debt_balance: newDebt });
            },

            addDebt: async (id, amount) => {
                const supplier = get().getSupplierById(id);
                if (!supplier) return;

                const newDebt = supplier.debt_balance + amount;
                await get().updateSupplier(id, { debt_balance: newDebt });
            },
        }),
        {
            name: 'supplier-store',
            partialize: (state) => ({ suppliers: state.suppliers }),
        }
    )
);
