import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export interface StockAuditItem {
    id: string;
    audit_id: string;
    product_id: string;
    product_name?: string;
    product_sku?: string;
    product_image?: string;
    system_qty: number;
    actual_qty: number;
    reason: string | null;
    difference: number; // Generated column in DB, but handy to have here
    created_at: string;
}

export interface StockAudit {
    id: string;
    branch_id: string;
    code: string;
    status: 'draft' | 'completed' | 'cancelled';
    notes: string | null;
    created_at: string;
    created_by: string;
    completed_at: string | null;
    completed_by: string | null;
    items?: StockAuditItem[];
}

interface StockAuditState {
    audits: StockAudit[];
    currentAudit: StockAudit | null;
    isLoading: boolean;
    error: string | null;

    fetchAudits: (branchId: string) => Promise<void>;
    getAudit: (id: string) => Promise<StockAudit | null>;
    createAudit: (branchId: string, notes?: string) => Promise<StockAudit | null>;

    // Item actions
    addItem: (auditId: string, productId: string, systemQty: number, actualQty: number) => Promise<boolean>;
    updateItem: (itemId: string, actualQty: number, reason?: string) => Promise<boolean>;
    deleteItem: (itemId: string) => Promise<boolean>;

    // Status actions
    applyAudit: (auditId: string) => Promise<boolean>;
    cancelAudit: (auditId: string) => Promise<boolean>;
}

export const useStockAuditStore = create<StockAuditState>((set, get) => ({
    audits: [],
    currentAudit: null,
    isLoading: false,
    error: null,

    fetchAudits: async (branchId: string) => {
        if (!isSupabaseConfigured()) return;
        set({ isLoading: true, error: null });
        try {
            const { data, error } = await supabase
                .from('stock_audits')
                .select('*')
                .eq('branch_id', branchId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            set({ audits: data as StockAudit[] });
        } catch (err: any) {
            console.error('Error fetching audits:', err);
            set({ error: err.message });
        } finally {
            set({ isLoading: false });
        }
    },

    getAudit: async (id: string) => {
        if (!isSupabaseConfigured()) return null;
        set({ isLoading: true, error: null });
        try {
            // Get audit details
            const { data: audit, error: auditError } = await supabase
                .from('stock_audits')
                .select('*')
                .eq('id', id)
                .single();

            if (auditError) throw auditError;

            // Get items with product details
            const { data: items, error: itemsError } = await supabase
                .from('stock_audit_items')
                .select(`
                    *,
                    product:products(name, sku, image_url)
                `)
                .eq('audit_id', id);

            if (itemsError) throw itemsError;

            const fullAudit: StockAudit = {
                ...audit,
                items: items.map((i: any) => ({
                    ...i,
                    product_name: i.product?.name,
                    product_sku: i.product?.sku,
                    product_image: i.product?.image_url
                }))
            };

            set({ currentAudit: fullAudit });
            return fullAudit;
        } catch (err: any) {
            console.error('Error fetching audit details:', err);
            set({ error: err.message });
            return null;
        } finally {
            set({ isLoading: false });
        }
    },

    createAudit: async (branchId: string, notes?: string) => {
        if (!isSupabaseConfigured()) return null;
        set({ isLoading: true, error: null });
        try {
            const today = new Date();
            const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
            const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            const code = `KK-${dateStr}-${randomSuffix}`;

            const { data, error } = await supabase
                .from('stock_audits')
                .insert({
                    branch_id: branchId,
                    code,
                    notes,
                    status: 'draft',
                    created_by: useAuthStore.getState().user?.id
                })
                .select()
                .single();

            if (error) throw error;

            const newAudit = data as StockAudit;
            set(state => ({ audits: [newAudit, ...state.audits] }));
            return newAudit;
        } catch (err: any) {
            console.error('Error creating audit:', err);
            set({ error: err.message });
            return null;
        } finally {
            set({ isLoading: false });
        }
    },

    addItem: async (auditId: string, productId: string, systemQty: number, actualQty: number) => {
        if (!isSupabaseConfigured()) return false;
        try {
            const { error } = await supabase
                .from('stock_audit_items')
                .insert({
                    audit_id: auditId,
                    product_id: productId,
                    system_qty: systemQty,
                    actual_qty: actualQty
                });

            if (error) throw error;
            return true;
        } catch (err: any) {
            console.error('Error adding audit item:', err);
            return false;
        }
    },

    updateItem: async (itemId: string, actualQty: number, reason?: string) => {
        if (!isSupabaseConfigured()) return false;
        try {
            const { error } = await supabase
                .from('stock_audit_items')
                .update({
                    actual_qty: actualQty,
                    reason: reason
                })
                .eq('id', itemId);

            if (error) throw error;
            return true;
        } catch (err: any) {
            console.error('Error updating audit item:', err);
            return false;
        }
    },

    deleteItem: async (itemId: string) => {
        if (!isSupabaseConfigured()) return false;
        try {
            const { error } = await supabase
                .from('stock_audit_items')
                .delete()
                .eq('id', itemId);

            if (error) throw error;
            return true;
        } catch (err: any) {
            console.error('Error deleting audit item:', err);
            return false;
        }
    },

    applyAudit: async (auditId: string) => {
        if (!isSupabaseConfigured()) return false;
        set({ isLoading: true });
        try {
            const { error } = await supabase.rpc('apply_inventory_audit', {
                p_audit_id: auditId
            });

            if (error) throw error;

            // Update local state
            set(state => ({
                audits: state.audits.map(a =>
                    a.id === auditId
                        ? { ...a, status: 'completed', completed_at: new Date().toISOString() }
                        : a
                ),
                currentAudit: state.currentAudit?.id === auditId
                    ? { ...state.currentAudit, status: 'completed', completed_at: new Date().toISOString() }
                    : state.currentAudit
            }));

            return true;
        } catch (err: any) {
            console.error('Error applying audit:', err);
            set({ error: err.message });
            return false;
        } finally {
            set({ isLoading: false });
        }
    },

    cancelAudit: async (auditId: string) => {
        if (!isSupabaseConfigured()) return false;
        try {
            const { error } = await supabase
                .from('stock_audits')
                .update({ status: 'cancelled' })
                .eq('id', auditId);

            if (error) throw error;

            set(state => ({
                audits: state.audits.map(a =>
                    a.id === auditId ? { ...a, status: 'cancelled' } : a
                )
            }));
            return true;
        } catch (err: any) {
            console.error('Error cancelling audit:', err);
            return false;
        }
    }
}));
