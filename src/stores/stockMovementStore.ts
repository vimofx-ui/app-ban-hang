// =============================================================================
// STOCK MOVEMENT STORE - Track all inventory changes
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from './authStore';

export interface StockMovement {
    id: string;
    product_id: string;
    product_name?: string; // For display
    movement_type: 'sale' | 'purchase' | 'return' | 'adjustment_in' | 'adjustment_out' | 'transfer';
    quantity: number; // Positive for IN, negative for OUT
    stock_before: number;
    stock_after: number;
    cost_price_at_time: number; // Cost at time of movement
    reference_type: 'order' | 'purchase_order' | 'manual' | 'return';
    reference_id?: string;
    reference_number?: string; // Order number, PO number, etc.
    notes?: string;
    created_at: string;
    created_by?: string;
}

interface StockMovementState {
    movements: StockMovement[];
    isLoading: boolean;

    // Actions
    loadMovements: () => Promise<void>;
    addMovement: (movement: Omit<StockMovement, 'id' | 'created_at'>) => Promise<StockMovement>;
    getMovementsByProduct: (productId: string) => StockMovement[];
    getRecentMovements: (limit?: number) => StockMovement[];
    clearMovements: () => void;
}

export const useStockMovementStore = create<StockMovementState>()(
    persist(
        (set, get) => ({
            movements: [],
            isLoading: false,

            loadMovements: async () => {
                set({ isLoading: true });

                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { data, error } = await supabase
                            .from('stock_movements')
                            .select('*, product:products(name)')
                            .order('created_at', { ascending: false })
                            .limit(500);

                        if (error) throw error;

                        const movements = (data || []).map((m: any) => ({
                            ...m,
                            product_name: m.product?.name
                        }));

                        set({ movements, isLoading: false });
                    } catch (err) {
                        console.error('Failed to load stock movements:', err);
                        set({ isLoading: false });
                    }
                } else {
                    // Demo mode - use persisted movements
                    set({ isLoading: false });
                }
            },

            addMovement: async (movementData) => {
                const userId = useAuthStore.getState().user?.id;

                const movement: StockMovement = {
                    ...movementData,
                    id: generateId(),
                    created_at: new Date().toISOString(),
                    created_by: userId,
                };

                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { error } = await supabase
                            .from('stock_movements')
                            .insert({
                                id: movement.id,
                                product_id: movement.product_id,
                                movement_type: movement.movement_type,
                                quantity: movement.quantity,
                                stock_before: movement.stock_before,
                                stock_after: movement.stock_after,
                                reference_type: movement.reference_type,
                                reference_id: movement.reference_id,
                                notes: movement.notes,
                                created_at: movement.created_at,
                                created_by: movement.created_by,
                            });

                        if (error) throw error;
                    } catch (err) {
                        console.error('Failed to save stock movement:', err);
                    }
                }

                // Add to local state
                set((state) => ({
                    movements: [movement, ...state.movements].slice(0, 1000) // Keep max 1000
                }));

                console.log(`📊 Movement logged: ${movement.movement_type} | ${movement.quantity > 0 ? '+' : ''}${movement.quantity} | ${movement.product_name || movement.product_id}`);

                return movement;
            },

            getMovementsByProduct: (productId) => {
                return get().movements.filter(m => m.product_id === productId);
            },

            getRecentMovements: (limit = 50) => {
                return get().movements.slice(0, limit);
            },

            clearMovements: () => {
                set({ movements: [] });
            }
        }),
        {
            name: 'stock-movements',
            partialize: (state) => ({
                movements: state.movements.slice(0, 500) // Persist max 500
            }),
        }
    )
);

// Selectors
export const useRecentMovements = () =>
    useStockMovementStore((state) => state.movements.slice(0, 20));
