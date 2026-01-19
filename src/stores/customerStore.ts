// =============================================================================
// CUSTOMER STORE - Customer Management State
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Customer } from '@/types';
import { generateId } from '@/lib/utils';
import { createBaseState, withAsync } from './baseStore';
import type { BaseState } from './baseStore';
import { logAction } from '@/lib/audit';
import { cacheCustomers, getCachedCustomers } from '@/lib/indexedDBCache';
import { toast } from 'sonner';

// Mock customers for demo
const MOCK_CUSTOMERS: Customer[] = [
    {
        id: 'cust-001',
        code: 'KH-001',
        name: 'Nguyễn Văn Khách',
        phone: '0909123456',
        email: 'khach1@email.com',
        address: '123 Lê Lợi, Q.1, TP.HCM',
        points_balance: 150,
        total_spent: 1500000,
        total_orders: 12,
        debt_balance: 0,
        notes: 'Khách hàng thân thiết',
        is_active: true,
        created_at: new Date().toISOString(),
    },
    {
        id: 'cust-002',
        code: 'KH-002',
        name: 'Trần Thị Mua',
        phone: '0918234567',
        address: '456 Hai Bà Trưng, Q.3, TP.HCM',
        points_balance: 50,
        total_spent: 500000,
        total_orders: 5,
        debt_balance: 200000,
        notes: 'Còn nợ 200k',
        is_active: true,
        created_at: new Date().toISOString(),
    },
    {
        id: 'cust-003',
        code: 'KH-003',
        name: 'Quán Cà Phê ABC',
        phone: '0927345678',
        address: '789 Nguyễn Huệ, Q.1, TP.HCM',
        points_balance: 500,
        total_spent: 5000000,
        total_orders: 45,
        debt_balance: 0,
        notes: 'Mua sỉ, chiết khấu 5%',
        is_active: true,
        created_at: new Date().toISOString(),
    },
];

export interface CustomerState extends BaseState {
    customers: Customer[];

    loadCustomers: () => Promise<void>;
    addCustomer: (customer: Omit<Customer, 'id' | 'created_at'>) => Promise<Customer>;
    updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
    deleteCustomer: (id: string) => Promise<void>;
    getCustomerById: (id: string) => Customer | undefined;
    getCustomerByPhone: (phone: string) => Customer | undefined;
    updateCustomerDebt: (id: string, amount: number) => Promise<void>;
    addCustomerPoints: (id: string, points: number) => Promise<void>;

    // Debt management
    getCustomersWithDebt: () => Customer[];
    payDebt: (id: string, amount: number) => Promise<void>;
}

export const useCustomerStore = create<CustomerState>()(
    persist(
        (set, get) => ({
            customers: [],
            isLoading: false,
            error: null,

            loadCustomers: async () => {
                set({ isLoading: true, error: null });

                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { data, error } = await supabase
                            .from('customers')
                            .select('*')
                            .eq('is_active', true)
                            .order('name');

                        if (error) throw error;

                        const customers = data as Customer[];
                        set({ customers, isLoading: false });

                        // Cache for offline use
                        cacheCustomers(customers);

                    } catch (err) {
                        console.error('Failed to load customers:', err);

                        // Try to load from cache
                        console.log('Loading customers from cache...');
                        const cachedCustomers = await getCachedCustomers();

                        if (cachedCustomers.length > 0) {
                            set({
                                customers: cachedCustomers,
                                isLoading: false,
                                error: 'Đang hiển thị dữ liệu offline'
                            });
                            toast('Đã tải danh sách khách hàng từ bộ nhớ đệm (Offline)', { icon: '📡' });
                        } else {
                            // Only use dummy data if absolutely nothing in cache
                            const currentCustomers = get().customers;
                            if (currentCustomers.length === 0) {
                                set({ error: 'Không thể tải khách hàng', isLoading: false, customers: MOCK_CUSTOMERS });
                            } else {
                                set({ error: 'Không thể tải khách hàng', isLoading: false });
                            }
                        }
                    }
                } else {
                    // Demo mode: Try cache first, then mock
                    const cachedCustomers = await getCachedCustomers();
                    if (cachedCustomers.length > 0) {
                        set({ customers: cachedCustomers, isLoading: false });
                    } else {
                        // Only init with MOCK if no cache and no customers
                        const currentCustomers = get().customers;
                        if (currentCustomers.length === 0) {
                            set({ customers: MOCK_CUSTOMERS, isLoading: false });
                        } else {
                            set({ isLoading: false });
                        }
                    }
                }
            },

            addCustomer: async (customerData) => {
                // Auto-generate customer code if not provided
                let customerCode = customerData.code;
                if (!customerCode || customerCode.trim() === '') {
                    const now = new Date();
                    const year = now.getFullYear().toString().slice(-2);
                    const month = (now.getMonth() + 1).toString().padStart(2, '0');
                    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                    customerCode = `KH${year}${month}${random}`;
                }

                const newCustomer: Customer = {
                    ...customerData,
                    code: customerCode,
                    id: generateId(),
                    created_at: new Date().toISOString(),
                };

                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { error } = await supabase.from('customers').insert(newCustomer);
                        if (error) throw error;
                    } catch (err) {
                        console.error('Failed to add customer:', err);
                        throw err;
                    }
                }

                set((state) => ({ customers: [...state.customers, newCustomer] }));
                return newCustomer;
            },

            updateCustomer: async (id, updates) => {
                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { error } = await supabase.from('customers').update(updates).eq('id', id);
                        if (error) throw error;
                    } catch (err) {
                        console.error('Failed to update customer:', err);
                        throw err;
                    }
                }

                set((state) => ({
                    customers: state.customers.map((c) => (c.id === id ? { ...c, ...updates } : c)),
                }));
            },

            deleteCustomer: async (id) => {
                if (isSupabaseConfigured() && supabase) {
                    try {
                        const { error } = await supabase.from('customers').update({ is_active: false }).eq('id', id);
                        if (error) throw error;
                    } catch (err) {
                        console.error('Failed to delete customer:', err);
                        throw err;
                    }
                }

                set((state) => ({ customers: state.customers.filter((c) => c.id !== id) }));
            },

            getCustomerById: (id) => get().customers.find((c) => c.id === id),

            getCustomerByPhone: (phone) => get().customers.find((c) => c.phone === phone),

            updateCustomerDebt: async (id, amount) => {
                const customer = get().getCustomerById(id);
                if (!customer) return;

                const newDebt = customer.debt_balance + amount;
                await get().updateCustomer(id, { debt_balance: newDebt });
            },

            addCustomerPoints: async (id, points) => {
                const customer = get().getCustomerById(id);
                if (!customer) return;

                const newPoints = customer.points_balance + points;
                await get().updateCustomer(id, { points_balance: newPoints });
            },

            // Debt management
            getCustomersWithDebt: () => {
                return get().customers
                    .filter((c) => c.debt_balance > 0)
                    .sort((a, b) => b.debt_balance - a.debt_balance);
            },

            payDebt: async (id, amount) => {
                const customer = get().getCustomerById(id);
                if (!customer) return;

                const newDebt = Math.max(0, customer.debt_balance - amount);
                await get().updateCustomer(id, { debt_balance: newDebt });
            },
        }),
        {
            name: 'customer-store',
            partialize: (state) => ({ customers: state.customers }),
        }
    )
);
