// =============================================================================
// AUTH STORE - Authentication State Management
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'staff';
    created_at: string;
    is_active?: boolean;
}

interface AuthState {
    user: AuthUser | null;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;

    // Actions
    login: (email: string, password: string) => Promise<boolean>;
    register: (email: string, password: string, name: string, role?: 'admin' | 'staff', phone?: string) => Promise<boolean>;
    logout: () => Promise<void>;
    resetPassword: (email: string) => Promise<boolean>;
    checkSession: () => Promise<void>;
    clearError: () => void;
}

// Users for when Supabase is not configured (demo mode)
const DEMO_USERS: Array<{ id: string; email: string; password: string; name: string; role: 'admin' | 'staff' }> = [
    { id: 'admin-1', email: 'storelypos@gmail.com', password: 'Vandan1988', name: 'Admin', role: 'admin' },
];

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            loading: false,
            error: null,

            login: async (email: string, password: string) => {
                set({ loading: true, error: null });

                try {
                    if (!isSupabaseConfigured() || !supabase) {
                        // Demo mode - check demo users
                        const demoUser = DEMO_USERS.find(
                            u => u.email === email && u.password === password
                        );

                        if (demoUser) {
                            const user: AuthUser = {
                                id: demoUser.id,
                                email: demoUser.email,
                                name: demoUser.name,
                                role: demoUser.role,
                                created_at: new Date().toISOString(),
                            };
                            set({ user, isAuthenticated: true, loading: false });
                            return true;
                        } else {
                            set({ error: 'Email hoặc mật khẩu không đúng', loading: false });
                            return false;
                        }
                    }

                    // Supabase auth
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email,
                        password,
                    });

                    if (error) {
                        set({ error: error.message, loading: false });
                        return false;
                    }

                    if (data.user) {
                        // Get user profile
                        const { data: profile } = await supabase
                            .from('user_profiles')
                            .select('*')
                            .eq('id', data.user.id)
                            .single();

                        const user: AuthUser = {
                            id: data.user.id,
                            email: data.user.email || '',
                            name: profile?.full_name || data.user.email?.split('@')[0] || 'User',
                            role: profile?.role || 'staff',
                            created_at: data.user.created_at,
                            is_active: profile?.is_active ?? true,
                        };
                        set({ user, isAuthenticated: true, loading: false });
                        return true;
                    }

                    set({ loading: false });
                    return false;
                } catch {
                    set({ error: 'Đã xảy ra lỗi khi đăng nhập', loading: false });
                    return false;
                }
            },

            register: async (email: string, password: string, name: string, role: 'admin' | 'staff' = 'staff', phone?: string) => {
                set({ loading: true, error: null });

                try {
                    if (!isSupabaseConfigured() || !supabase) {
                        // Demo mode - create a fake user
                        const newUser: AuthUser = {
                            id: `user-${Date.now()}`,
                            email,
                            name,
                            role,
                            created_at: new Date().toISOString(),
                        };
                        DEMO_USERS.push({ ...newUser, password });
                        set({ user: newUser, isAuthenticated: true, loading: false });
                        return true;
                    }

                    // Supabase auth
                    const { data, error } = await supabase.auth.signUp({
                        email,
                        password,
                        options: {
                            data: { name, role },
                            emailRedirectTo: `${window.location.origin}/login`,
                        },
                    });

                    if (error) {
                        set({ error: error.message, loading: false });
                        return false;
                    }

                    if (data.user) {
                        // Create user profile with phone
                        // Note: Schema uses id (FK to auth.users), full_name, and we add email/phone
                        await supabase.from('user_profiles').insert({
                            id: data.user.id,
                            full_name: name,
                            role,
                            is_active: true,
                        });

                        const user: AuthUser = {
                            id: data.user.id,
                            email: data.user.email || '',
                            name,
                            role,
                            created_at: data.user.created_at,
                        };
                        set({ user, isAuthenticated: true, loading: false });
                        return true;
                    }

                    set({ loading: false });
                    return false;
                } catch {
                    set({ error: 'Đã xảy ra lỗi khi đăng ký', loading: false });
                    return false;
                }
            },

            logout: async () => {
                set({ loading: true });

                if (isSupabaseConfigured() && supabase) {
                    await supabase.auth.signOut();
                }

                set({ user: null, isAuthenticated: false, loading: false, error: null });
            },

            resetPassword: async (email: string) => {
                set({ loading: true, error: null });

                try {
                    if (!isSupabaseConfigured() || !supabase) {
                        // Demo mode
                        set({ loading: false });
                        return true; // Pretend it worked
                    }

                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/reset-password`,
                    });

                    if (error) {
                        set({ error: error.message, loading: false });
                        return false;
                    }

                    set({ loading: false });
                    return true;
                } catch {
                    set({ error: 'Đã xảy ra lỗi', loading: false });
                    return false;
                }
            },

            checkSession: async () => {
                if (!isSupabaseConfigured() || !supabase) {
                    // In demo mode, keep existing session
                    return;
                }

                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    const { data: profile } = await supabase
                        .from('user_profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();

                    const user: AuthUser = {
                        id: session.user.id,
                        email: session.user.email || '',
                        name: profile?.full_name || session.user.email?.split('@')[0] || 'User',
                        role: profile?.role || 'staff',
                        created_at: session.user.created_at,
                        is_active: profile?.is_active ?? true,
                    };
                    set({ user, isAuthenticated: true });
                }
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);

export default useAuthStore;

// =============================================================================
// PERMISSION HELPERS
// =============================================================================

/**
 * Check if current user can view cost price (giá vốn)
 * Admin: Yes | Staff: No
 */
export const canViewCostPrice = (): boolean => {
    const user = useAuthStore.getState().user;
    return user?.role === 'admin';
};

/**
 * Check if current user can view purchase price (giá nhập)
 * Admin: Yes | Staff: No
 */
export const canViewPurchasePrice = (): boolean => {
    const user = useAuthStore.getState().user;
    return user?.role === 'admin';
};

/**
 * Check if current user can edit selling price
 * Admin: Yes | Staff: No
 */
export const canEditSellingPrice = (): boolean => {
    const user = useAuthStore.getState().user;
    return user?.role === 'admin';
};

/**
 * Check if current user can edit purchase price
 * Admin: Yes | Staff: No
 */
export const canEditPurchasePrice = (): boolean => {
    const user = useAuthStore.getState().user;
    return user?.role === 'admin';
};

/**
 * Check if current user can delete a product
 * Admin: Always | Staff: Only own products within 2 days
 */
export const canDeleteProduct = (product: { created_by?: string; created_at?: string }): boolean => {
    const user = useAuthStore.getState().user;
    if (!user) return false;

    // Admin can always delete
    if (user.role === 'admin') return true;

    // Staff can only delete their own products within 2 days
    if (product.created_by !== user.id) return false;

    if (!product.created_at) return false;

    const created = new Date(product.created_at);
    const now = new Date();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

    return (now.getTime() - created.getTime()) < twoDaysMs;
};

/**
 * Get deletion error message for staff
 */
export const getDeleteErrorMessage = (product: { created_by?: string; created_at?: string }): string => {
    const user = useAuthStore.getState().user;
    if (!user || user.role === 'admin') return '';

    if (product.created_by !== user.id) {
        return 'Bạn không thể xóa sản phẩm do người khác tạo';
    }

    if (product.created_at) {
        const created = new Date(product.created_at);
        const now = new Date();
        const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

        if ((now.getTime() - created.getTime()) >= twoDaysMs) {
            return 'Sản phẩm đã tạo quá 2 ngày, không thể xóa';
        }
    }

    return '';
};
