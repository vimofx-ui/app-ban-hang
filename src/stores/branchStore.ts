// =============================================================================
// BRANCH STORE - Multi-Branch/Multi-Store Management
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

// ============================================================================
// INTERFACES
// ============================================================================

export interface Branch {
    id: string;
    brand_id: string;
    name: string;
    code?: string;              // VD: "CN01", "HN02"
    address?: string;
    phone?: string;
    email?: string;
    status: 'active' | 'inactive';
    is_headquarters?: boolean;   // Flag for main branch
    created_at: string;
    updated_at: string;
}

export interface BranchState {
    branches: Branch[];
    currentBranch: Branch | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchBranches: (brandId: string) => Promise<void>;
    setCurrentBranch: (branch: Branch) => void;
    createBranch: (branch: Partial<Branch>) => Promise<Branch | null>;
    updateBranch: (id: string, updates: Partial<Branch>) => Promise<boolean>;
    deleteBranch: (id: string) => Promise<boolean>;
    getCurrentBranch: () => Branch | null; // Helper for non-hook usage
}

// ============================================================================
// STORE
// ============================================================================

export const useBranchStore = create<BranchState>()(
    persist(
        (set, get) => ({
            branches: [],
            currentBranch: null,
            isLoading: false,
            error: null,

            fetchBranches: async (brandId: string) => {
                if (!brandId) return;

                set({ isLoading: true, error: null });
                try {
                    const { data, error } = await supabase
                        .from('branches')
                        .select('*')
                        .eq('brand_id', brandId)
                        .order('created_at', { ascending: true });

                    if (error) throw error;

                    // Convert DB status (0/1) to frontend status ('active'/'inactive')
                    const branches = (data || []).map((b: any) => ({
                        ...b,
                        status: b.status === 1 ? 'active' : 'inactive'
                    })) as Branch[];

                    set({ branches, isLoading: false });

                    // Auto-select first branch if none selected or current is invalid
                    const current = get().currentBranch;
                    if (branches.length > 0) {
                        const isValid = current && branches.find(b => b.id === current.id);
                        if (!current || !isValid) {
                            set({ currentBranch: branches[0] });
                        }
                    } else {
                        set({ currentBranch: null });
                    }

                } catch (err: any) {
                    console.error('Error fetching branches:', err);
                    set({ error: err.message, isLoading: false });
                }
            },

            setCurrentBranch: (branch: Branch) => {
                set({ currentBranch: branch });
            },

            createBranch: async (branchData) => {
                set({ isLoading: true, error: null });
                try {
                    // Convert frontend status to DB status
                    const dbPayload = {
                        ...branchData,
                        status: branchData.status === 'active' ? 1 : 0
                    };

                    const { data, error } = await supabase
                        .from('branches')
                        .insert(dbPayload)
                        .select()
                        .single();

                    if (error) throw error;

                    // Convert back for local store
                    const newBranch = {
                        ...data,
                        status: data.status === 1 ? 'active' : 'inactive'
                    } as Branch;

                    set(state => ({
                        branches: [...state.branches, newBranch],
                        isLoading: false
                    }));
                    return newBranch;
                } catch (err: any) {
                    console.error('Error creating branch:', err);
                    set({ error: err.message, isLoading: false });
                    return null;
                }
            },

            updateBranch: async (id, updates) => {
                set({ isLoading: true, error: null });
                try {
                    // Convert frontend status if present
                    const dbUpdates: any = { ...updates };
                    if (updates.status) {
                        dbUpdates.status = updates.status === 'active' ? 1 : 0;
                    }

                    const { error } = await supabase
                        .from('branches')
                        .update(dbUpdates)
                        .eq('id', id);

                    if (error) throw error;

                    // Fetch again to ensure sync or optimistically update
                    set(state => ({
                        branches: state.branches.map(b => b.id === id ? { ...b, ...updates } : b),
                        currentBranch: state.currentBranch?.id === id ? { ...state.currentBranch, ...updates } : state.currentBranch,
                        isLoading: false
                    }));
                    return true;
                } catch (err: any) {
                    console.error('Error updating branch:', err);
                    set({ error: err.message, isLoading: false });
                    return false;
                }
            },

            deleteBranch: async (id) => {
                set({ isLoading: true, error: null });
                try {
                    const { error } = await supabase
                        .from('branches')
                        .delete()
                        .eq('id', id);

                    if (error) throw error;

                    set(state => ({
                        branches: state.branches.filter(b => b.id !== id),
                        currentBranch: state.currentBranch?.id === id ? null : state.currentBranch,
                        isLoading: false
                    }));
                    return true;
                } catch (err: any) {
                    console.error('Error deleting branch:', err);
                    set({ error: err.message, isLoading: false });
                    return false;
                }
            },

            getCurrentBranch: () => get().currentBranch,
        }),
        {
            name: 'branch-storage',
            partialize: (state) => ({ currentBranch: state.currentBranch }), // Only persist current branch selection
        }
    )
);
