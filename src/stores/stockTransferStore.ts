// =============================================================================
// STOCK TRANSFER STORE - Inter-branch Stock Transfers
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { generateId } from '@/lib/utils';

// Types
export interface StockTransfer {
    id: string;
    transfer_code: string;
    brand_id: string;
    from_branch_id: string;
    to_branch_id: string;
    status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
    notes?: string;
    created_by?: string;
    created_at: string;
    shipped_at?: string;
    shipped_by?: string;
    completed_at?: string;
    completed_by?: string;
    cancelled_at?: string;
    cancelled_by?: string;
    cancel_reason?: string;
    // Joined data
    from_branch?: { name: string };
    to_branch?: { name: string };
    items?: StockTransferItem[];
}

export interface StockTransferItem {
    id: string;
    transfer_id: string;
    product_id: string;
    quantity: number;
    received_quantity: number;
    notes?: string;
    // Joined data
    product?: { name: string; barcode?: string; image_url?: string; sku?: string; price?: number };
}

interface CreateTransferInput {
    brand_id: string;
    from_branch_id: string;
    to_branch_id: string;
    notes?: string;
    items: { product_id: string; quantity: number }[];
}

interface StockTransferState {
    transfers: StockTransfer[];
    currentTransfer: StockTransfer | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchTransfers: (brandId: string) => Promise<void>;
    fetchTransferById: (id: string) => Promise<StockTransfer | null>;
    createTransfer: (data: CreateTransferInput, userId: string) => Promise<StockTransfer | null>;
    shipTransfer: (id: string, userId: string) => Promise<boolean>;
    completeTransfer: (id: string, userId: string, receivedItems?: { id: string; received_quantity: number }[]) => Promise<boolean>;
    cancelTransfer: (id: string, userId: string, reason?: string) => Promise<boolean>;
    clearError: () => void;
    generateDemoTransfers: (brandId: string, branches: { id: string; name: string }[], products: { id: string; name: string }[]) => void;
}

export const useStockTransferStore = create<StockTransferState>()(
    persist(
        (set, get) => ({
            transfers: [],
            currentTransfer: null,
            isLoading: false,
            error: null,

            fetchTransfers: async (brandId: string) => {
                if (!brandId) return;
                set({ isLoading: true, error: null });

                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { data, error } = await supabase
                            .from('stock_transfers')
                            .select(`
                                *,
                                from_branch:branches!from_branch_id(name),
                                to_branch:branches!to_branch_id(name),
                                items:stock_transfer_items(
                                    id, product_id, quantity, received_quantity, notes,
                                    product:products(name, barcode, image_url, sku, price)
                                )
                            `)
                            .eq('brand_id', brandId)
                            .order('created_at', { ascending: false });

                        if (error) throw error;

                        set({ transfers: data as StockTransfer[], isLoading: false });
                    } catch (err: any) {
                        console.error('Error fetching transfers:', err);
                        set({ error: err.message, isLoading: false });
                    }
                } else {
                    // Demo mode - use persisted data
                    set({ isLoading: false });
                }
            },

            fetchTransferById: async (id: string) => {
                if (!isSupabaseConfigured() || !supabase) {
                    return get().transfers.find(t => t.id === id) || null;
                }

                try {
                    const { data, error } = await supabase
                        .from('stock_transfers')
                        .select(`
                            *,
                            from_branch:branches!from_branch_id(name),
                            to_branch:branches!to_branch_id(name),
                            items:stock_transfer_items(
                                id, product_id, quantity, received_quantity, notes,
                                product:products(name, barcode, image_url, sku, price)
                            )
                        `)
                        .eq('id', id)
                        .single();

                    if (error) throw error;

                    set({ currentTransfer: data as StockTransfer });
                    return data as StockTransfer;
                } catch (err: any) {
                    console.error('Error fetching transfer:', err);
                    return null;
                }
            },

            createTransfer: async (data: CreateTransferInput, userId: string) => {
                set({ isLoading: true, error: null });

                const transferId = generateId();
                const now = new Date().toISOString();

                if (isSupabaseConfigured() && supabase) {
                    try {
                        // Generate transfer code
                        const { data: codeResult, error: codeError } = await supabase
                            .rpc('generate_transfer_code', { p_brand_id: data.brand_id });

                        if (codeError) throw codeError;

                        const transferCode = codeResult || `TF-${Date.now()}`;

                        // Create transfer
                        const { error: transferError } = await supabase
                            .from('stock_transfers')
                            .insert({
                                id: transferId,
                                transfer_code: transferCode,
                                brand_id: data.brand_id,
                                from_branch_id: data.from_branch_id,
                                to_branch_id: data.to_branch_id,
                                status: 'pending',
                                notes: data.notes,
                                created_by: userId,
                                created_at: now
                            });

                        if (transferError) throw transferError;

                        // Create items
                        const itemsToInsert = data.items.map(item => ({
                            id: generateId(),
                            transfer_id: transferId,
                            product_id: item.product_id,
                            quantity: item.quantity,
                            received_quantity: 0
                        }));

                        const { error: itemsError } = await supabase
                            .from('stock_transfer_items')
                            .insert(itemsToInsert);

                        if (itemsError) throw itemsError;

                        // Fetch the created transfer with joins
                        const transfer = await get().fetchTransferById(transferId);

                        set({ isLoading: false });

                        // Refresh list
                        await get().fetchTransfers(data.brand_id);

                        return transfer;
                    } catch (err: any) {
                        console.error('Error creating transfer:', err);
                        set({ error: err.message, isLoading: false });
                        return null;
                    }
                } else {
                    // Demo mode
                    const demoTransfer: StockTransfer = {
                        id: transferId,
                        transfer_code: `TF-${String(get().transfers.length + 1).padStart(5, '0')}`,
                        brand_id: data.brand_id,
                        from_branch_id: data.from_branch_id,
                        to_branch_id: data.to_branch_id,
                        status: 'pending',
                        notes: data.notes,
                        created_by: userId,
                        created_at: now,
                        items: data.items.map(item => ({
                            id: generateId(),
                            transfer_id: transferId,
                            product_id: item.product_id,
                            quantity: item.quantity,
                            received_quantity: 0
                        }))
                    };

                    set(state => ({
                        transfers: [demoTransfer, ...state.transfers],
                        isLoading: false
                    }));

                    return demoTransfer;
                }
            },

            shipTransfer: async (id: string, userId: string) => {
                set({ isLoading: true, error: null });

                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { error } = await supabase
                            .rpc('ship_stock_transfer', {
                                p_transfer_id: id,
                                p_user_id: userId
                            });

                        if (error) throw error;

                        // Update local state
                        set(state => ({
                            transfers: state.transfers.map(t =>
                                t.id === id
                                    ? { ...t, status: 'in_transit' as const, shipped_at: new Date().toISOString(), shipped_by: userId }
                                    : t
                            ),
                            isLoading: false
                        }));

                        return true;
                    } catch (err: any) {
                        console.error('Error shipping transfer:', err);
                        set({ error: err.message, isLoading: false });
                        return false;
                    }
                } else {
                    // Demo mode
                    set(state => ({
                        transfers: state.transfers.map(t =>
                            t.id === id
                                ? { ...t, status: 'in_transit' as const, shipped_at: new Date().toISOString() }
                                : t
                        ),
                        isLoading: false
                    }));
                    return true;
                }
            },

            completeTransfer: async (id: string, userId: string, receivedItems?: { id: string; received_quantity: number }[]) => {
                set({ isLoading: true, error: null });

                if (isSupabaseConfigured() && supabase) {
                    try {
                        // Update received quantities if provided
                        if (receivedItems && receivedItems.length > 0) {
                            for (const item of receivedItems) {
                                await supabase
                                    .from('stock_transfer_items')
                                    .update({ received_quantity: item.received_quantity })
                                    .eq('id', item.id);
                            }
                        }

                        const { error } = await supabase
                            .rpc('complete_stock_transfer', {
                                p_transfer_id: id,
                                p_user_id: userId
                            });

                        if (error) throw error;

                        // Update local state
                        set(state => ({
                            transfers: state.transfers.map(t =>
                                t.id === id
                                    ? { ...t, status: 'completed' as const, completed_at: new Date().toISOString(), completed_by: userId }
                                    : t
                            ),
                            isLoading: false
                        }));

                        return true;
                    } catch (err: any) {
                        console.error('Error completing transfer:', err);
                        set({ error: err.message, isLoading: false });
                        return false;
                    }
                } else {
                    // Demo mode
                    set(state => ({
                        transfers: state.transfers.map(t =>
                            t.id === id
                                ? { ...t, status: 'completed' as const, completed_at: new Date().toISOString() }
                                : t
                        ),
                        isLoading: false
                    }));
                    return true;
                }
            },

            cancelTransfer: async (id: string, userId: string, reason?: string) => {
                set({ isLoading: true, error: null });

                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { error } = await supabase
                            .rpc('cancel_stock_transfer', {
                                p_transfer_id: id,
                                p_user_id: userId,
                                p_reason: reason
                            });

                        if (error) throw error;

                        // Update local state
                        set(state => ({
                            transfers: state.transfers.map(t =>
                                t.id === id
                                    ? { ...t, status: 'cancelled' as const, cancelled_at: new Date().toISOString(), cancelled_by: userId, cancel_reason: reason }
                                    : t
                            ),
                            isLoading: false
                        }));

                        return true;
                    } catch (err: any) {
                        console.error('Error cancelling transfer:', err);
                        set({ error: err.message, isLoading: false });
                        return false;
                    }
                } else {
                    // Demo mode
                    set(state => ({
                        transfers: state.transfers.map(t =>
                            t.id === id
                                ? { ...t, status: 'cancelled' as const, cancelled_at: new Date().toISOString(), cancel_reason: reason }
                                : t
                        ),
                        isLoading: false
                    }));
                    return true;
                }
            },

            clearError: () => set({ error: null }),

            // Generate demo transfers for testing
            generateDemoTransfers: (brandId: string, branches: { id: string; name: string }[], products: { id: string; name: string }[]) => {
                if (get().transfers.length > 0) return; // Don't regenerate if already have data
                if (branches.length < 2 || products.length === 0) return;

                const statuses: StockTransfer['status'][] = ['pending', 'in_transit', 'completed', 'cancelled'];
                const now = new Date();
                const demoTransfers: StockTransfer[] = [];

                // Generate 6 demo transfers with different statuses
                for (let i = 0; i < 6; i++) {
                    const fromBranch = branches[i % branches.length];
                    const toBranch = branches[(i + 1) % branches.length];
                    const status = statuses[i % 4];
                    const createdDate = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)); // Each day back

                    const transfer: StockTransfer = {
                        id: generateId(),
                        transfer_code: `CK${String(1001 + i).padStart(4, '0')}`,
                        brand_id: brandId,
                        from_branch_id: fromBranch.id,
                        to_branch_id: toBranch.id,
                        status,
                        notes: i === 0 ? 'Chuyển hàng bổ sung tồn kho' : i === 2 ? 'Chuyển hàng khẩn' : undefined,
                        created_at: createdDate.toISOString(),
                        created_by: 'demo-user',
                        from_branch: { name: fromBranch.name },
                        to_branch: { name: toBranch.name },
                        items: products.slice(0, Math.min(3, products.length)).map((p, idx) => ({
                            id: generateId(),
                            transfer_id: '',
                            product_id: p.id,
                            quantity: 5 + idx * 2,
                            received_quantity: status === 'completed' ? 5 + idx * 2 : 0,
                            product: { name: p.name }
                        }))
                    };

                    // Add status-specific timestamps
                    if (status === 'in_transit') {
                        transfer.shipped_at = new Date(createdDate.getTime() + 3600000).toISOString();
                        transfer.shipped_by = 'demo-user';
                    } else if (status === 'completed') {
                        transfer.shipped_at = new Date(createdDate.getTime() + 3600000).toISOString();
                        transfer.shipped_by = 'demo-user';
                        transfer.completed_at = new Date(createdDate.getTime() + 7200000).toISOString();
                        transfer.completed_by = 'demo-user';
                    } else if (status === 'cancelled') {
                        transfer.cancelled_at = new Date(createdDate.getTime() + 1800000).toISOString();
                        transfer.cancelled_by = 'demo-user';
                        transfer.cancel_reason = 'Hủy do thay đổi kế hoạch';
                    }

                    demoTransfers.push(transfer);
                }

                set({ transfers: demoTransfers });
            }
        }),
        {
            name: 'stock-transfer-store',
            partialize: (state) => ({
                // Chỉ lưu 20 transfers gần nhất và loại bỏ nested data để tránh QuotaExceededError
                transfers: state.transfers.slice(0, 20).map(t => ({
                    id: t.id,
                    transfer_code: t.transfer_code,
                    brand_id: t.brand_id,
                    from_branch_id: t.from_branch_id,
                    to_branch_id: t.to_branch_id,
                    status: t.status,
                    created_at: t.created_at,
                    notes: t.notes
                    // Không lưu items, from_branch, to_branch để giảm kích thước
                }))
            })
        }
    )
);

// Selectors
export const usePendingTransfers = () =>
    useStockTransferStore(state => state.transfers.filter(t => t.status === 'pending' || t.status === 'in_transit'));

export const useTransfersByStatus = (status: StockTransfer['status']) =>
    useStockTransferStore(state => state.transfers.filter(t => t.status === status));
