// =============================================================================
// AUTH STORE - Authentication State Management
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { createBaseState, withAsync } from './baseStore';
import type { BaseState } from './baseStore';
import { logAction } from '@/lib/audit';

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'staff' | 'owner' | 'manager';
    created_at: string;
    is_active?: boolean;
    assigned_branch_id?: string | null;
}

interface AuthState extends BaseState {
    user: AuthUser | null;
    isAuthenticated: boolean;
    brandId: string | null; // Added brandId to AuthState
    branchId: string | null; // Added branchId to AuthState

    // Actions
    login: (email: string, password: string) => Promise<boolean>;
    register: (email: string, password: string, name: string, role?: 'admin' | 'staff', phone?: string) => Promise<boolean>;
    registerTenant: (email: string, password: string, name: string, brandName: string, brandSlug: string, phone?: string, referralCode?: string) => Promise<boolean>;

    logout: () => Promise<void>;
    resetPassword: (email: string) => Promise<boolean>;
    setBranch: (branchId: string) => Promise<void>;
    setBrandId: (brandId: string) => void;
    checkSession: () => Promise<void>;
    clearError: () => void;
}

// Users for when Supabase is not configured (demo mode)
const DEMO_USERS: Array<{ id: string; email: string; password: string; name: string; role: 'admin' | 'staff' | 'owner' | 'manager' }> = [
    { id: 'admin-1', email: 'storelypos@gmail.com', password: 'Vandan1988', name: 'Admin', role: 'admin' },
];

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,
            brandId: null,
            branchId: null,
            isLoading: false, // Changed from loading to isLoading
            error: null,

            setBrandId: (brandId: string) => set({ brandId }),

            setBranch: async (branchId: string) => {
                set({ branchId });
                // Optionally update user profile in DB so it persists across devices
                if (isSupabaseConfigured() && supabase) {
                    const user = get().user;
                    if (user) {
                        try {
                            await supabase.from('user_profiles').update({ branch_id: branchId }).eq('id', user.id);
                        } catch (e) {
                            console.error("Failed to update branch in profile", e);
                        }
                    }
                }
            },

            login: async (email: string, password: string) => {
                set({ isLoading: true, error: null }); // Changed from loading to isLoading

                try {
                    if (!isSupabaseConfigured() || !supabase) {
                        // Demo mode
                        const demoUser = DEMO_USERS.find(u => u.email === email && u.password === password);
                        if (demoUser) {
                            const user: AuthUser = {
                                id: demoUser.id,
                                email: demoUser.email,
                                name: demoUser.name,
                                role: demoUser.role as any,
                                created_at: new Date().toISOString(),
                            };
                            set({ user, isAuthenticated: true, isLoading: false, brandId: 'demo-brand', branchId: 'demo-branch' }); // Changed from loading to isLoading
                            return true;
                        }
                        set({ error: 'Email hoặc mật khẩu không đúng', isLoading: false }); // Changed from loading to isLoading
                        return false;
                    }

                    // Supabase Login
                    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                        email,
                        password,
                    });

                    if (authError) {
                        set({ error: authError.message, isLoading: false }); // Changed from loading to isLoading
                        return false;
                    }

                    if (authData.user) {
                        // Fetch profile
                        const { data: profile, error: profileError } = await supabase
                            .from('user_profiles')
                            .select('*')
                            .eq('id', authData.user.id)
                            .single();

                        if (profileError) {
                            console.error('Profile fetch error:', profileError);
                        }

                        const user: AuthUser = {
                            id: authData.user.id,
                            email: authData.user.email || '',
                            name: profile?.full_name || authData.user.email?.split('@')[0] || 'User',
                            role: profile?.role || 'staff',
                            created_at: authData.user.created_at,
                            is_active: profile?.is_active ?? true,
                            assigned_branch_id: profile?.assigned_branch_id || null,
                        };

                        // If user is assigned to a specific branch, force them there
                        const effectiveBranchId = user.assigned_branch_id || profile?.branch_id || null;

                        set({
                            user,
                            isAuthenticated: true,
                            isLoading: false,
                            brandId: profile?.brand_id || null,
                            branchId: effectiveBranchId
                        });
                        await logAction('login', 'auth', user.id, { email: user.email });
                        return true;
                    }

                    set({ isLoading: false }); // Changed from loading to isLoading
                    return false;

                } catch (err: any) {
                    console.error('Login error:', err);
                    set({ error: 'Đã xảy ra lỗi khi đăng nhập', isLoading: false }); // Changed from loading to isLoading
                    return false;
                }
            },

            register: async (email: string, password: string, name: string, role: 'admin' | 'staff' = 'staff', phone?: string) => {
                set({ isLoading: true, error: null }); // Changed from loading to isLoading

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
                        set({ user: newUser, isAuthenticated: true, isLoading: false }); // Changed from loading to isLoading
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
                        set({ error: error.message, isLoading: false }); // Changed from loading to isLoading
                        return false;
                    }

                    if (data.user) {
                        // Create user profile with phone
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
                        set({ user, isAuthenticated: true, isLoading: false }); // Changed from loading to isLoading
                        await logAction('register', 'auth', user.id, { email: user.email, role });
                        return true;
                    }

                    set({ isLoading: false }); // Changed from loading to isLoading
                    return false;
                } catch {
                    set({ error: 'Đã xảy ra lỗi khi đăng ký', isLoading: false }); // Changed from loading to isLoading
                    return false;
                }
            },

            registerTenant: async (email: string, password: string, name: string, brandName: string, brandSlug: string, phone?: string, referralCode?: string) => {
                set({ isLoading: true, error: null });

                try {
                    if (!isSupabaseConfigured() || !supabase) {
                        set({ error: 'Chức năng này cần kết nối Supabase', isLoading: false });
                        return false;
                    }

                    // 1. Sign Up User
                    const { data: authData, error: authError } = await supabase.auth.signUp({
                        email,
                        password,
                        options: {
                            data: { name, role: 'owner' },
                        },
                    });

                    if (authError) throw authError;
                    if (!authData.user) throw new Error('Không tạo được tài khoản');

                    const userId = authData.user.id;

                    // 2. Create Brand
                    const { data: brandData, error: brandError } = await supabase
                        .from('brands')
                        .insert({
                            name: brandName,
                            slug: brandSlug,
                        })
                        .select()
                        .single();

                    if (brandError) throw brandError;

                    // 3. Create Main Branch
                    const { data: branchData, error: branchError } = await supabase
                        .from('branches')
                        .insert({
                            brand_id: brandData.id,
                            name: 'Chi nhánh chính',
                            phone: phone || '',
                            address: '',
                        })
                        .select()
                        .single();

                    if (branchError) throw branchError;

                    // 4. Create User Profile (Use upsert to handle if trigger already created it)
                    const { error: profileError } = await supabase.from('user_profiles').upsert({
                        id: userId,
                        full_name: name,
                        email: email,
                        phone: phone,
                        role: 'owner',
                        brand_id: brandData.id,
                        branch_id: branchData.id,
                        is_active: true,
                    });

                    if (profileError) throw profileError;

                    // 5. Handle Referral
                    if (referralCode) {
                        const { data: affiliate } = await supabase
                            .from('affiliates')
                            .select('id')
                            .eq('code', referralCode)
                            .single();

                        if (affiliate) {
                            await supabase.from('referrals').insert({
                                affiliate_id: affiliate.id,
                                brand_id: brandData.id,
                                status: 'pending'
                            });
                        }
                    }

                    // Success
                    const user: AuthUser = {
                        id: userId,
                        email: email,
                        name: name,
                        role: 'owner',
                        created_at: new Date().toISOString(),
                    };
                    set({ user, isAuthenticated: true, isLoading: false, brandId: brandData.id, branchId: branchData.id });
                    await logAction('register_tenant', 'auth', userId, { brand: brandName });
                    return true;

                } catch (err: any) {
                    console.error('Register Tenant Error:', err);
                    set({ error: err.message || 'Đăng ký thất bại', isLoading: false }); // Changed from loading to isLoading
                    return false;
                }
            },

            logout: async () => {
                set({ isLoading: true }); // Changed from loading to isLoading

                if (isSupabaseConfigured() && supabase) {
                    await supabase.auth.signOut();
                }

                set({ user: null, isAuthenticated: false, isLoading: false, error: null, brandId: null, branchId: null }); // Clear brand/branch on logout
            },

            resetPassword: async (email: string) => {
                set({ isLoading: true, error: null }); // Changed from loading to isLoading

                try {
                    if (!isSupabaseConfigured() || !supabase) {
                        // Demo mode
                        set({ isLoading: false }); // Changed from loading to isLoading
                        return true; // Pretend it worked
                    }

                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/reset-password`,
                    });

                    if (error) {
                        set({ error: error.message, isLoading: false }); // Changed from loading to isLoading
                        return false;
                    }

                    set({ isLoading: false }); // Changed from loading to isLoading
                    return true;
                } catch {
                    set({ error: 'Đã xảy ra lỗi', isLoading: false }); // Changed from loading to isLoading
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
                    set({
                        user,
                        isAuthenticated: true,
                        brandId: profile?.brand_id || null, // Load brand
                        branchId: profile?.branch_id || null // Load branch
                    });
                }
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
                brandId: state.brandId,
                branchId: state.branchId
            }),
        }
    )
);

export default useAuthStore;

// =============================================================================
// PERMISSION HELPERS - Now reads from brand_permissions table
// =============================================================================

// Cache for brand permissions
let permissionsCache: {
    brandId: string | null;
    data: {
        staff_can_view_cost_price: boolean;
        staff_can_view_purchase_price: boolean;
        staff_can_edit_selling_price: boolean;
        staff_can_edit_purchase_price: boolean;
        staff_can_delete_products: boolean;
    } | null;
    loadedAt: number;
} = { brandId: null, data: null, loadedAt: 0 };

// Load permissions from DB
export const loadBrandPermissions = async (): Promise<void> => {
    const { brandId } = useAuthStore.getState();
    if (!brandId || !supabase) return;

    // Check cache validity (1 minute)
    if (permissionsCache.brandId === brandId &&
        Date.now() - permissionsCache.loadedAt < 60000) {
        return;
    }

    try {
        const { data, error } = await supabase
            .from('brand_permissions')
            .select('*')
            .eq('brand_id', brandId)
            .single();

        if (!error && data) {
            permissionsCache = {
                brandId,
                data: {
                    staff_can_view_cost_price: data.staff_can_view_cost_price || false,
                    staff_can_view_purchase_price: data.staff_can_view_purchase_price || false,
                    staff_can_edit_selling_price: data.staff_can_edit_selling_price || false,
                    staff_can_edit_purchase_price: data.staff_can_edit_purchase_price || false,
                    staff_can_delete_products: data.staff_can_delete_products || false,
                },
                loadedAt: Date.now()
            };
        }
    } catch (err) {
        console.error('Failed to load brand permissions:', err);
    }
};

// Clear permissions cache (call on logout or brand change)
export const clearPermissionsCache = (): void => {
    permissionsCache = { brandId: null, data: null, loadedAt: 0 };
};

/**
 * Check if current user can view cost price (giá vốn)
 * Admin/Owner/Manager: Always Yes | Staff: Based on brand settings
 */
export const canViewCostPrice = (): boolean => {
    const user = useAuthStore.getState().user;
    if (!user) return false;

    // Admin, owner, manager always have access
    if (['admin', 'owner', 'manager'].includes(user.role)) return true;

    // For staff, check brand permissions
    return permissionsCache.data?.staff_can_view_cost_price || false;
};

/**
 * Check if current user can view purchase price (giá nhập)
 * Admin/Owner/Manager: Always Yes | Staff: Based on brand settings
 */
export const canViewPurchasePrice = (): boolean => {
    const user = useAuthStore.getState().user;
    if (!user) return false;

    if (['admin', 'owner', 'manager'].includes(user.role)) return true;

    return permissionsCache.data?.staff_can_view_purchase_price || false;
};

/**
 * Check if current user can edit selling price
 * Admin/Owner/Manager: Always Yes | Staff: Based on brand settings
 */
export const canEditSellingPrice = (): boolean => {
    const user = useAuthStore.getState().user;
    if (!user) return false;

    if (['admin', 'owner', 'manager'].includes(user.role)) return true;

    return permissionsCache.data?.staff_can_edit_selling_price || false;
};

/**
 * Check if current user can edit purchase price
 * Admin/Owner/Manager: Always Yes | Staff: Based on brand settings
 */
export const canEditPurchasePrice = (): boolean => {
    const user = useAuthStore.getState().user;
    if (!user) return false;

    if (['admin', 'owner', 'manager'].includes(user.role)) return true;

    return permissionsCache.data?.staff_can_edit_purchase_price || false;
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
