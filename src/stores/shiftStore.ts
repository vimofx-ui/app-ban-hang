// =============================================================================
// SHIFT STORE - Shift Management State
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Shift, CashDetails, ReconciliationStatus } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { generateId } from '@/lib/utils';
import { createEmptyCashDetails, calculateReconciliation } from '@/lib/cashReconciliation';

export interface ShiftState {
    // Current shift
    currentShift: Shift | null;
    isClockingIn: boolean;
    isClockingOut: boolean;

    // User info (simplified for demo)
    currentUser: {
        id: string;
        name: string;
        role: 'admin' | 'staff';
    } | null;

    // Actions
    clockIn: (userId: string, userName: string, role: 'admin' | 'staff', openingCash: number, openingCashDetails?: CashDetails, openingBankBalance?: number, customTime?: string, startNote?: string, handoverPerson?: string) => Promise<void>;
    clockOut: (closingCash: number, closingCashDetails?: CashDetails, closingBankBalance?: number, notes?: string, customEndTime?: string, finalTotalExpenses?: number) => Promise<void>;
    updateShiftTotals: (updates: Partial<Pick<Shift, 'total_cash_sales' | 'total_card_sales' | 'total_transfer_sales' | 'total_debt_sales' | 'total_expenses' | 'total_returns' | 'total_point_sales'>>) => void;
    addExpense: (amount: number, category: string, note: string) => Promise<void>;
    getReconciliation: () => { expected: number; discrepancy: number; status: ReconciliationStatus } | null;

    // History
    history: Shift[];
    fetchHistory: (userId?: string) => Promise<void>;

    // Draft state for End Shift Modal
    endShiftDraft: {
        closingCashDetails: CashDetails;
        closingBankBalance: string;
        notes: string;
        handoverTo: string;
    } | null;
    saveEndShiftDraft: (data: { closingCashDetails: CashDetails; closingBankBalance: string; notes: string; handoverTo: string }) => void;
    clearEndShiftDraft: () => void;

    // Demo mode
    setDemoUser: (name: string, role: 'admin' | 'staff') => void;
}

export const useShiftStore = create<ShiftState>()(
    persist(
        (set, get) => ({
            currentShift: null,
            isClockingIn: false,
            isClockingOut: false,
            currentUser: null,
            history: [],
            endShiftDraft: null,

            saveEndShiftDraft: (data) => set({ endShiftDraft: data }),
            clearEndShiftDraft: () => set({ endShiftDraft: null }),


            // Clock in - start a new shift
            clockIn: async (userId: string, userName: string, role: 'admin' | 'staff', openingCash: number, openingCashDetails?: CashDetails, openingBankBalance: number = 0, customTime?: string, startNote?: string, handoverPerson?: string) => {
                set({ isClockingIn: true });

                const newShift: Shift = {
                    id: generateId(),
                    user_id: userId,
                    clock_in: customTime || new Date().toISOString(),
                    clock_out: undefined,
                    opening_cash: openingCash,
                    opening_cash_details: openingCashDetails || createEmptyCashDetails(),
                    opening_bank_balance: openingBankBalance,
                    closing_cash: undefined,
                    closing_cash_details: undefined,
                    closing_bank_balance: undefined,
                    total_cash_sales: 0,
                    total_card_sales: 0,
                    total_transfer_sales: 0,
                    total_debt_sales: 0,
                    total_returns: 0,
                    total_expenses: 0,
                    total_point_sales: 0,
                    expected_cash: openingCash,
                    discrepancy_amount: undefined,
                    reconciliation_status: 'pending',
                    reconciliation_notes: undefined,
                    status: 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };

                // Try to save to Supabase
                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { error } = await supabase.from('shifts').insert({
                            id: newShift.id,
                            user_id: userId,
                            opening_cash: openingCash,
                            // Merge notes and handover info into details JSON
                            opening_cash_details: openingCashDetails ? {
                                ...openingCashDetails,
                                notes: startNote,
                                handoverFrom: handoverPerson
                            } : {
                                denominations: [],
                                total: openingCash,
                                notes: startNote,
                                handoverFrom: handoverPerson
                            },
                            opening_bank_balance: openingBankBalance,
                        });

                        if (error) {
                            console.error('Failed to save shift to Supabase:', error);
                        }
                    } catch (err) {
                        console.error('Error creating shift:', err);
                    }
                }

                set({
                    currentShift: newShift,
                    currentUser: { id: userId, name: userName, role },
                    isClockingIn: false,
                });

                console.log('✅ Shift started:', newShift);
            },

            // Clock out - end current shift
            clockOut: async (closingCash: number, closingCashDetails?: CashDetails, closingBankBalance: number = 0, notes?: string, customEndTime?: string, finalTotalExpenses?: number) => {
                const { currentShift } = get();

                if (!currentShift) {
                    console.error('No active shift to close');
                    return;
                }

                set({ isClockingOut: true });

                // Determine final expenses (override or use existing)
                const finalExpenses = finalTotalExpenses !== undefined ? finalTotalExpenses : currentShift.total_expenses;

                // Calculate reconciliation
                const reconciliation = calculateReconciliation(
                    currentShift.opening_cash,
                    currentShift.total_cash_sales,
                    finalExpenses,
                    closingCash
                );

                const updatedShift: Shift = {
                    ...currentShift,
                    clock_out: customEndTime || new Date().toISOString(),
                    closing_cash: closingCash,
                    closing_cash_details: closingCashDetails,
                    closing_bank_balance: closingBankBalance,
                    expected_cash: reconciliation.expected_cash,
                    discrepancy_amount: reconciliation.discrepancy,
                    reconciliation_status: reconciliation.status,
                    reconciliation_notes: notes,
                    status: 'reconciled',
                    updated_at: new Date().toISOString(),
                };

                // Try to update in Supabase
                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { error } = await supabase.from('shifts').update({
                            clock_out: updatedShift.clock_out,
                            closing_cash: closingCash,
                            closing_cash_details: closingCashDetails,
                            closing_bank_balance: closingBankBalance,
                            total_cash_sales: currentShift.total_cash_sales,
                            total_card_sales: currentShift.total_card_sales,
                            total_transfer_sales: currentShift.total_transfer_sales,
                            total_debt_sales: currentShift.total_debt_sales,
                            total_expenses: finalExpenses,
                            total_returns: currentShift.total_returns,
                            expected_cash: reconciliation.expected_cash,
                            discrepancy_amount: reconciliation.discrepancy,
                            reconciliation_status: reconciliation.status,
                            reconciliation_notes: notes,
                            status: 'reconciled',
                        }).eq('id', currentShift.id);

                        if (error) {
                            console.error('Failed to update shift in Supabase:', error);
                        }
                    } catch (err) {
                        console.error('Error closing shift:', err);
                    }
                }

                // Update local history
                const currentHistory = get().history;
                set({
                    history: [updatedShift, ...currentHistory],
                    currentShift: null,
                    isClockingOut: false,
                });

                // Backup to localStorage
                try {
                    localStorage.setItem('shift_history', JSON.stringify([updatedShift, ...currentHistory].slice(0, 100)));
                } catch (e) {
                    console.warn('LocalStorage error:', e);
                }

                console.log('✅ Shift ended:', updatedShift);
            },

            // Update shift totals (called after each sale)
            updateShiftTotals: (updates) => {
                set((state) => {
                    if (!state.currentShift) return state;

                    const updatedShift: Shift = {
                        ...state.currentShift,
                        ...updates,
                        expected_cash:
                            state.currentShift.opening_cash +
                            (updates.total_cash_sales ?? state.currentShift.total_cash_sales) -
                            (updates.total_expenses ?? state.currentShift.total_expenses),
                        updated_at: new Date().toISOString(),
                    };

                    return { currentShift: updatedShift };
                });
            },

            // Add expense
            addExpense: async (amount: number, category: string, note: string) => {
                const { currentShift, updateShiftTotals } = get();
                if (!currentShift) return;

                const newTotalExpenses = (currentShift.total_expenses || 0) + amount;

                // Update local state via updateShiftTotals to trigger recalculations
                updateShiftTotals({ total_expenses: newTotalExpenses });

                // Sync with database (if needed, or just update the shift record)
                if (isSupabaseConfigured() && supabase) {
                    // Optionally insert into a 'expenses' table if it existed, for now just update shift
                    const { error } = await supabase.from('shifts').update({
                        total_expenses: newTotalExpenses,
                        updated_at: new Date().toISOString()
                    }).eq('id', currentShift.id);
                    if (error) console.error('Failed to update expenses in DB:', error);
                }
            },

            // Get current reconciliation status
            getReconciliation: () => {
                const { currentShift } = get();

                if (!currentShift) return null;

                const expected =
                    currentShift.opening_cash +
                    currentShift.total_cash_sales -
                    currentShift.total_expenses;

                return {
                    expected,
                    discrepancy: 0, // Will be calculated when closing
                    status: 'pending' as ReconciliationStatus,
                };
            },

            // Set demo user (for testing without auth)
            setDemoUser: (name: string, role: 'admin' | 'staff') => {
                set({
                    currentUser: {
                        id: generateId(),
                        name,
                        role,
                    },
                });
            },

            fetchHistory: async (userId?: string) => {
                // In real app, fetch from Supabase
                if (isSupabaseConfigured() && supabase) {
                    let query = supabase.from('shifts').select('*').order('clock_in', { ascending: false });
                    if (userId) {
                        query = query.eq('user_id', userId);
                    }
                    const { data } = await query;
                    if (data) {
                        set({ history: data as Shift[] });
                        return;
                    }
                }

                // Fallback to local storage for demo
                const local = JSON.parse(localStorage.getItem('shift_history') || '[]');
                let filtered = local;
                if (userId) {
                    filtered = local.filter((s: Shift) => s.user_id === userId);
                }
                set({ history: filtered });
            }
        }),
        {
            name: 'shift-store',
            partialize: (state) => ({
                currentShift: state.currentShift,
                currentUser: state.currentUser,
                history: state.history,
                endShiftDraft: state.endShiftDraft // Persist draft
            }),
        }
    )
);

// ============= Selectors =============
export const useCurrentShift = () => useShiftStore((state) => state.currentShift);
export const useCurrentUser = () => useShiftStore((state) => state.currentUser);
export const useIsShiftActive = () => useShiftStore((state) => state.currentShift?.status === 'active');

