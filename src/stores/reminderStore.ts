import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Reminder } from '@/types';
import { persist } from 'zustand/middleware';

interface ReminderState {
    reminders: Reminder[];
    loading: boolean;
    error: string | null;

    // Actions
    fetchReminders: () => Promise<void>;
    addReminder: (reminder: Omit<Reminder, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
    updateReminder: (id: string, updates: Partial<Reminder>) => Promise<void>;
    deleteReminder: (id: string) => Promise<void>;

    // Acknowledgement tracking (session only)
    acknowledgedReminders: Record<string, number>; // id -> timestamp
    acknowledgeReminder: (id: string) => void;
}

export const useReminderStore = create<ReminderState>()(
    persist(
        (set, get) => ({
            reminders: [],
            loading: false,
            error: null,
            acknowledgedReminders: {},

            fetchReminders: async () => {
                set({ loading: true });
                try {
                    if (!supabase) throw new Error('Supabase client not initialized');

                    const { data, error } = await supabase
                        .from('reminders')
                        .select('*')
                        .order('created_at', { ascending: false });

                    if (error) throw error;

                    set({ reminders: data as Reminder[], error: null });
                } catch (err: any) {
                    console.error('Error fetching reminders:', err);
                    set({ error: err.message });
                } finally {
                    set({ loading: false });
                }
            },

            addReminder: async (reminder) => {
                set({ loading: true });
                try {
                    // MOCK MODE: If supabase is null, valid for demo
                    if (!supabase) {
                        const newReminder: Reminder = {
                            id: crypto.randomUUID(),
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(), // Add updated_at
                            title: reminder.title,
                            message: reminder.message || undefined,
                            type: reminder.type || 'shift_elapsed',
                            elapsed_minutes: reminder.elapsed_minutes || undefined,
                            schedule_time: reminder.schedule_time || undefined,
                            days_of_week: reminder.days_of_week || undefined,
                            is_active: reminder.is_active ?? true,
                            repeat_interval: reminder.repeat_interval || undefined,
                            max_repeats: reminder.max_repeats || 1,
                            created_by: 'local-user'
                        };
                        set(state => ({
                            reminders: [newReminder, ...state.reminders],
                            error: null
                        }));
                        return; // Exit successfully
                    }

                    // REAL MODE
                    const { data, error } = await supabase
                        .from('reminders')
                        .insert([reminder])
                        .select()
                        .single();

                    if (error) throw error;

                    set(state => ({
                        reminders: [data as Reminder, ...state.reminders],
                        error: null
                    }));
                } catch (err: any) {
                    console.error('Error adding reminder:', err);
                    set({ error: err.message });
                } finally {
                    set({ loading: false });
                }
            },

            updateReminder: async (id, updates) => {
                set({ loading: true });
                try {
                    // MOCK MODE
                    if (!supabase) {
                        set(state => ({
                            reminders: state.reminders.map(r => r.id === id ? { ...r, ...updates } : r),
                            error: null
                        }));
                        return;
                    }

                    const { error } = await supabase
                        .from('reminders')
                        .update(updates)
                        .eq('id', id);

                    if (error) throw error;

                    set(state => ({
                        reminders: state.reminders.map(r => r.id === id ? { ...r, ...updates } : r),
                        error: null
                    }));
                } catch (err: any) {
                    console.error('Error updating reminder:', err);
                    set({ error: err.message });
                } finally {
                    set({ loading: false });
                }
            },

            deleteReminder: async (id) => {
                set({ loading: true });
                try {
                    console.log('Attempting to delete reminder:', id);

                    // MOCK MODE
                    if (!supabase) {
                        console.log('Deleting from mock state');
                        set(state => ({
                            reminders: state.reminders.filter(r => r.id !== id),
                            error: null
                        }));
                        return;
                    }

                    // REAL MODE
                    const { error, count } = await supabase
                        .from('reminders')
                        .delete({ count: 'exact' })
                        .eq('id', id);

                    if (error) {
                        console.error('Supabase delete error:', error);
                        throw error;
                    };

                    if (count === 0) {
                        throw new Error('Không tìm thấy lời nhắc hoặc không có quyền xóa (RLS blocking).');
                    }

                    set(state => ({
                        reminders: state.reminders.filter(r => r.id !== id),
                        error: null
                    }));
                } catch (err: any) {
                    console.error('Error deleting reminder:', err);
                    set({ error: err.message || 'Không thể xóa nhắc nhở' });
                    throw err; // Re-throw to let UI handle if needed
                } finally {
                    set({ loading: false });
                }
            },

            acknowledgeReminder: (id) => {
                set(state => ({
                    acknowledgedReminders: {
                        ...state.acknowledgedReminders,
                        [id]: Date.now()
                    }
                }));
            }
        }),
        {
            name: 'reminder-store',
            partialize: (state) => ({
                reminders: state.reminders, // Persist data locally too for demo
                acknowledgedReminders: state.acknowledgedReminders
            })
        }
    )
);
