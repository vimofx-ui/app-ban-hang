import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/lib/utils';
import type { Transaction, TransactionType } from '@/types';
import { isSupabaseConfigured } from '@/lib/supabase';

interface CashFlowState {
    transactions: Transaction[];
    isLoading: boolean;
    error: string | null;

    loadTransactions: () => Promise<void>;
    addTransaction: (transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
    getTransactionsByDateRange: (startDate: Date, endDate: Date) => Transaction[];
    getTransactionsByReference: (refId: string) => Transaction[];
    calculateBalance: () => number;
}

export const useCashFlowStore = create<CashFlowState>((set, get) => ({
    transactions: [],
    isLoading: false,
    error: null,

    loadTransactions: async () => {
        set({ isLoading: true });
        try {
            let data: any[] = [];

            if (isSupabaseConfigured() && supabase) {
                const { data: remoteData, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .order('transaction_date', { ascending: false });

                if (error) throw error;
                data = remoteData || [];
            } else {
                // Demo / Offline
                const localData = JSON.parse(localStorage.getItem('cash-transactions') || '[]');
                data = localData;
            }

            set({ transactions: data as Transaction[], error: null });
        } catch (err: any) {
            console.error('Error loading transactions:', err);
            set({ error: err.message });
        } finally {
            set({ isLoading: false });
        }
    },

    addTransaction: async (txData) => {
        set({ isLoading: true });
        try {
            const newTx: Transaction = {
                id: generateId(),
                created_at: new Date().toISOString(),
                ...txData,
            };

            if (isSupabaseConfigured() && supabase) {
                const { error } = await supabase
                    .from('transactions')
                    .insert(newTx);
                if (error) throw error;
            }

            // Always update local state
            set((state) => {
                const updated = [newTx, ...state.transactions];
                if (!isSupabaseConfigured()) {
                    localStorage.setItem('cash-transactions', JSON.stringify(updated));
                }
                return { transactions: updated };
            });

        } catch (err: any) {
            console.error('Error adding transaction:', err);
            set({ error: err.message });
            throw err;
        } finally {
            set({ isLoading: false });
        }
    },

    getTransactionsByDateRange: (startDate, endDate) => {
        const { transactions } = get();
        return transactions.filter(t => {
            const d = new Date(t.transaction_date);
            return d >= startDate && d <= endDate;
        });
    },

    getTransactionsByReference: (refId) => {
        return get().transactions.filter(t => t.reference_id === refId);
    },

    calculateBalance: () => {
        return get().transactions.reduce((bal, t) => {
            return t.type === 'income' ? bal + t.amount : bal - t.amount;
        }, 0);
    }
}));
