// =============================================================================
// CUSTOMER STORE - Customer Management State (MIGRATED to Cloudflare API)
// =============================================================================
// 
// ✅ MIGRATED: This store now uses Cloudflare Workers API instead of Supabase
// Original file backup: customerStore.ts.bak
// 
// Changes made:
// - Replaced supabase.from('customers') calls with customersApi
// - Removed isSupabaseConfigured() checks
// - Added API error handling with fallback to cache
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customersApi, type Customer as ApiCustomer } from '@/lib/api';
import type { Customer } from '@/types';
import { generateId } from '@/lib/utils';
import { createBaseState, withAsync } from './baseStore';
import type { BaseState } from './baseStore';
import { logAction } from '@/lib/audit';
import { cacheCustomers, getCachedCustomers } from '@/lib/indexedDBCache';
import { toast } from 'sonner';

// Environment check: Use API or fallback to demo mode
const USE_API = import.meta.env.VITE_API_URL ? true : false;

// Mock customers for demo / offline mode
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

            // ================================================================
            // LOAD CUSTOMERS - Using new API
            // ================================================================
            loadCustomers: async () => {
                set({ isLoading: true, error: null });

                if (USE_API) {
                    try {
                        // ✅ NEW: Call Cloudflare Workers API
                        const response = await customersApi.getAll({ limit: 500 });
                        const customers = response.data as Customer[];

                        set({ customers, isLoading: false });

                        // Cache for offline use
                        cacheCustomers(customers);
                        console.log('✅ Loaded customers from API:', customers.length);

                    } catch (err) {
                        console.error('Failed to load customers from API:', err);

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
                        const currentCustomers = get().customers;
                        if (currentCustomers.length === 0) {
                            set({ customers: MOCK_CUSTOMERS, isLoading: false });
                        } else {
                            set({ isLoading: false });
                        }
                    }
                }
            },

            // ================================================================
            // ADD CUSTOMER - Using new API
            // ================================================================
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

                if (USE_API) {
                    try {
                        // ✅ NEW: Call Cloudflare Workers API
                        const newCustomer = await customersApi.create({
                            ...customerData,
                            code: customerCode,
                        });

                        set((state) => ({ customers: [...state.customers, newCustomer as Customer] }));
                        console.log('✅ Added customer via API:', newCustomer.id);
                        return newCustomer as Customer;

                    } catch (err) {
                        console.error('Failed to add customer:', err);
                        throw err;
                    }
                } else {
                    // Demo mode: Local only
                    const newCustomer: Customer = {
                        ...customerData,
                        code: customerCode,
                        id: generateId(),
                        created_at: new Date().toISOString(),
                    };
                    set((state) => ({ customers: [...state.customers, newCustomer] }));
                    return newCustomer;
                }
            },

            // ================================================================
            // UPDATE CUSTOMER - Using new API
            // ================================================================
            updateCustomer: async (id, updates) => {
                if (USE_API) {
                    try {
                        // ✅ NEW: Call Cloudflare Workers API
                        await customersApi.update(id, updates);
                        console.log('✅ Updated customer via API:', id);
                    } catch (err) {
                        console.error('Failed to update customer:', err);
                        throw err;
                    }
                }

                set((state) => ({
                    customers: state.customers.map((c) => (c.id === id ? { ...c, ...updates } : c)),
                }));
            },

            // ================================================================
            // DELETE CUSTOMER - Using new API
            // ================================================================
            deleteCustomer: async (id) => {
                if (USE_API) {
                    try {
                        // ✅ NEW: Call Cloudflare Workers API
                        await customersApi.delete(id);
                        console.log('✅ Deleted customer via API:', id);
                    } catch (err) {
                        console.error('Failed to delete customer:', err);
                        throw err;
                    }
                }

                set((state) => ({ customers: state.customers.filter((c) => c.id !== id) }));
            },

            // ================================================================
            // HELPER FUNCTIONS (unchanged - local only)
            // ================================================================
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
