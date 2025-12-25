// =============================================================================
// USER STORE - Employee Management & Auth State
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile, UserRole, Role } from '@/types';
import { supabase } from '@/lib/supabase';

// Define available permissions - Granular and detailed
export type Permission =
    // Bán hàng (POS)
    | 'pos_sell'              // Bán hàng cơ bản
    | 'pos_discount'          // Áp dụng giảm giá
    | 'pos_price_edit'        // Sửa giá bán trong đơn
    | 'pos_void'              // Hủy mục trong giỏ
    | 'pos_cancel_order'      // Hủy đơn hàng
    | 'pos_view_revenue'      // Xem doanh thu ca
    // Sản phẩm
    | 'product_view'          // Xem sản phẩm
    | 'product_create'        // Thêm sản phẩm mới
    | 'product_edit'          // Sửa thông tin sản phẩm
    | 'product_delete'        // Xóa sản phẩm
    | 'product_view_cost'     // Xem giá vốn
    // Kho hàng
    | 'inventory_view'        // Xem tồn kho
    | 'inventory_stocktake'   // Kiểm kê kho
    | 'inventory_adjust'      // Điều chỉnh tồn
    | 'inventory_import'      // Tạo đơn nhập hàng
    | 'inventory_receive'     // Xác nhận nhận hàng
    // Khách hàng
    | 'customer_view'         // Xem khách hàng
    | 'customer_manage'       // Thêm/Sửa/Xóa khách
    | 'customer_debt'         // Quản lý công nợ
    | 'customer_view_points'  // Xem điểm tích lũy
    | 'customer_edit_points'  // Chỉnh sửa điểm
    | 'customer_view_history' // Xem lịch sử giao dịch
    // Loyalty
    | 'loyalty_view'          // Xem chương trình Loyalty
    | 'loyalty_manage'        // Quản lý chương trình
    | 'loyalty_view_all_points' // Xem điểm tất cả khách
    | 'loyalty_adjust_points' // Điều chỉnh điểm
    // Đơn hàng
    | 'order_view'            // Xem đơn hàng
    | 'order_return'          // Xử lý trả hàng
    | 'order_export'          // Xuất dữ liệu đơn hàng
    // Báo cáo
    | 'report_sales'          // Xem báo cáo bán hàng
    | 'report_inventory'      // Xem báo cáo tồn kho
    | 'report_finance'        // Xem báo cáo tài chính
    // Nhân viên & Hệ thống
    | 'employee_view'         // Xem nhân viên
    | 'employee_manage'       // Quản lý nhân viên
    | 'employee_salary'       // Xem/Quản lý lương
    | 'settings_general'      // Cài đặt chung
    | 'settings_permissions'  // Phân quyền
    | 'view_security';        // Xem an ninh & chống gian lận

// Permission groups for better organization
export interface PermissionGroup {
    name: string;
    icon: string;
    permissions: { code: Permission; label: string }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
    {
        name: 'Bán hàng (POS)',
        icon: '🛒',
        permissions: [
            { code: 'pos_sell', label: 'Bán hàng cơ bản' },
            { code: 'pos_discount', label: 'Áp dụng giảm giá' },
            { code: 'pos_price_edit', label: 'Sửa giá bán trong đơn' },
            { code: 'pos_void', label: 'Hủy mục trong giỏ hàng' },
            { code: 'pos_cancel_order', label: 'Hủy đơn hàng' },
            { code: 'pos_view_revenue', label: 'Xem doanh thu ca làm việc' },
        ]
    },
    {
        name: 'Sản phẩm',
        icon: '📦',
        permissions: [
            { code: 'product_view', label: 'Xem danh sách sản phẩm' },
            { code: 'product_create', label: 'Thêm sản phẩm mới' },
            { code: 'product_edit', label: 'Sửa thông tin sản phẩm' },
            { code: 'product_delete', label: 'Xóa sản phẩm' },
            { code: 'product_view_cost', label: 'Xem giá vốn' },
        ]
    },
    {
        name: 'Kho hàng',
        icon: '🏪',
        permissions: [
            { code: 'inventory_view', label: 'Xem tồn kho' },
            { code: 'inventory_stocktake', label: 'Kiểm kê kho' },
            { code: 'inventory_adjust', label: 'Điều chỉnh tồn kho' },
            { code: 'inventory_import', label: 'Tạo đơn nhập hàng' },
            { code: 'inventory_receive', label: 'Xác nhận nhận hàng' },
        ]
    },
    {
        name: 'Khách hàng',
        icon: '👥',
        permissions: [
            { code: 'customer_view', label: 'Xem danh sách khách hàng' },
            { code: 'customer_manage', label: 'Thêm/Sửa/Xóa khách hàng' },
            { code: 'customer_debt', label: 'Quản lý công nợ' },
            { code: 'customer_view_points', label: 'Xem điểm tích lũy' },
            { code: 'customer_edit_points', label: 'Chỉnh sửa điểm' },
            { code: 'customer_view_history', label: 'Xem lịch sử giao dịch' },
        ]
    },
    {
        name: 'Loyalty',
        icon: '⭐',
        permissions: [
            { code: 'loyalty_view', label: 'Xem chương trình Loyalty' },
            { code: 'loyalty_manage', label: 'Quản lý chương trình' },
            { code: 'loyalty_view_all_points', label: 'Xem điểm tất cả khách' },
            { code: 'loyalty_adjust_points', label: 'Điều chỉnh điểm' },
        ]
    },
    {
        name: 'Đơn hàng',
        icon: '📋',
        permissions: [
            { code: 'order_view', label: 'Xem danh sách đơn hàng' },
            { code: 'order_return', label: 'Xử lý trả hàng' },
            { code: 'order_export', label: 'Xuất dữ liệu đơn hàng' },
        ]
    },
    {
        name: 'Báo cáo',
        icon: '📊',
        permissions: [
            { code: 'report_sales', label: 'Xem báo cáo bán hàng' },
            { code: 'report_inventory', label: 'Xem báo cáo tồn kho' },
            { code: 'report_finance', label: 'Xem báo cáo tài chính' },
        ]
    },
    {
        name: 'Nhân viên & Hệ thống',
        icon: '⚙️',
        permissions: [
            { code: 'employee_view', label: 'Xem danh sách nhân viên' },
            { code: 'employee_manage', label: 'Quản lý nhân viên' },
            { code: 'employee_salary', label: 'Xem/Quản lý lương' },
            { code: 'settings_general', label: 'Cài đặt chung' },
            { code: 'settings_permissions', label: 'Phân quyền nhân viên' },
            { code: 'view_security', label: 'Xem an ninh & chống gian lận' },
        ]
    },
];

// Flat list for compatibility
export const ALL_PERMISSIONS: { code: Permission; label: string }[] =
    PERMISSION_GROUPS.flatMap(g => g.permissions);

interface UserState {
    users: UserProfile[];
    roles: Role[];
    loading: boolean;
    error: string | null;

    // Actions
    fetchUsers: () => Promise<void>;
    createUser: (user: Partial<UserProfile>, password?: string) => Promise<UserProfile | null>;
    updateUser: (id: string, updates: Partial<UserProfile>) => Promise<void>;
    deleteUser: (id: string) => Promise<void>; // Soft delete

    // Role Actions
    fetchRoles: () => Promise<void>;
    addRole: (role: Omit<Role, 'id'>) => Promise<Role>;
    updateRole: (id: string, updates: Partial<Role>) => Promise<void>;
    deleteRole: (id: string) => Promise<void>;

    // Helpers
    hasPermission: (user: UserProfile | null, permission: Permission) => boolean;
}

export const useUserStore = create<UserState>()(
    persist(
        (set, get) => ({
            users: [],
            roles: [],
            loading: false,
            error: null,

            fetchUsers: async () => {
                set({ loading: true, error: null });
                try {
                    // In a real app with Supabase, we would fetch from the DB
                    if (supabase) {
                        const { data, error } = await supabase
                            .from('user_profiles')
                            .select('*')
                            .order('created_at', { ascending: false });

                        if (error) throw error;
                        if (data) set({ users: data as UserProfile[] });
                    } else {
                        // Mock data for demo if Supabase not connected
                        // (Would normally rely on initial mock data or empty)
                        console.log('Supabase not connected, using local state');
                    }
                } catch (err: any) {
                    set({ error: err.message });
                    console.error('Error fetching users:', err);
                } finally {
                    set({ loading: false });
                }
            },

            createUser: async (user, password) => {
                set({ loading: true, error: null });
                try {
                    console.log('Creating user:', user, 'Password:', password);

                    const newUser: UserProfile = {
                        id: crypto.randomUUID(),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        full_name: user.full_name || 'New User',
                        role: user.role || 'staff',
                        is_active: true,
                        hourly_rate: user.hourly_rate || 0,
                        permissions: user.permissions || [],
                        ...user
                    } as UserProfile;

                    if (supabase) {
                        // Helper to attempt insert
                        const attemptInsert = async (data: any) => {
                            const { error } = await supabase!.from('user_profiles').insert(data);
                            return error;
                        };

                        let error = await attemptInsert(newUser);

                        // RETRY STRATEGY: Remove potentially missing columns
                        if (error && error.code === 'PGRST204') {
                            console.warn('User profile schema mismatch, retrying with minimal data...', error.message);

                            // Build minimal user object with only essential columns
                            const minimalUser: any = {
                                id: newUser.id,
                                full_name: newUser.full_name,
                                role: newUser.role,
                                is_active: newUser.is_active,
                                created_at: newUser.created_at,
                                updated_at: newUser.updated_at
                            };

                            // Try with minimal data
                            error = await attemptInsert(minimalUser);

                            // If still failing, try without id (let DB generate)
                            if (error && error.code === 'PGRST204') {
                                delete minimalUser.id;
                                error = await attemptInsert(minimalUser);
                            }
                        }

                        if (error) {
                            console.error('Failed to create user in Supabase:', error);
                            throw error;
                        }
                    }

                    set(state => ({ users: [newUser, ...state.users] }));
                    return newUser;

                } catch (err: any) {
                    console.error('createUser error:', err);
                    set({ error: err.message });
                    return null;
                } finally {
                    set({ loading: false });
                }
            },

            updateUser: async (id, updates) => {
                set({ loading: true, error: null });
                try {
                    if (supabase) {
                        const { error } = await supabase
                            .from('user_profiles')
                            .update({ ...updates, updated_at: new Date().toISOString() })
                            .eq('id', id);

                        if (error) throw error;
                    }

                    set(state => ({
                        users: state.users.map(u => u.id === id ? { ...u, ...updates } : u)
                    }));
                } catch (err: any) {
                    set({ error: err.message });
                } finally {
                    set({ loading: false });
                }
            },

            deleteUser: async (id) => {
                // Hard delete from Supabase and local state
                try {
                    if (supabase) {
                        const { error } = await supabase
                            .from('user_profiles')
                            .delete()
                            .eq('id', id);

                        if (error) {
                            console.error('Failed to delete user from Supabase:', error);
                            throw error;
                        }
                    }

                    // Update local state
                    set(state => ({
                        users: state.users.filter(u => u.id !== id)
                    }));

                    console.log('User deleted successfully:', id);
                } catch (err: any) {
                    console.error('deleteUser error:', err);
                    throw err;
                }
            },

            // --- ROLE ACTIONS ---
            fetchRoles: async () => {
                // In real app, fetch from DB. For now, init defaults if empty.
                const currentRoles = get().roles;
                if (currentRoles.length === 0) {
                    const defaultRoles: Role[] = [
                        {
                            id: 'admin-role',
                            name: 'Quản lý (Admin)',
                            description: 'Toàn quyền truy cập hệ thống',
                            permissions: ALL_PERMISSIONS.map(p => p.code),
                            is_system: true
                        },
                        {
                            id: 'staff-role',
                            name: 'Nhân viên (Staff)',
                            description: 'Quyền bán hàng cơ bản',
                            permissions: ['pos_sell', 'pos_discount', 'product_view', 'customer_view', 'order_view'],
                            is_system: true
                        }
                    ];
                    set({ roles: defaultRoles });
                }
            },

            addRole: async (roleData) => {
                const newRole: Role = {
                    id: crypto.randomUUID(),
                    ...roleData,
                    permissions: roleData.permissions || []
                };
                set(state => ({ roles: [...state.roles, newRole] }));
                return newRole;
            },

            updateRole: async (id, updates) => {
                set(state => ({
                    roles: state.roles.map(r => r.id === id ? { ...r, ...updates } : r)
                }));
            },

            deleteRole: async (id) => {
                const role = get().roles.find(r => r.id === id);
                if (role?.is_system) {
                    throw new Error('Không thể xóa vai trò hệ thống');
                }
                set(state => ({ roles: state.roles.filter(r => r.id !== id) }));
            },

            // --- PERMISSION CHECK ---
            hasPermission: (user, permission) => {
                if (!user) return false;

                // 1. Check if Admin (Legacy or via Role)
                if (user.role === 'admin') return true;

                // 2. Check Role-based permissions
                const roles = get().roles;
                const userRole = roles.find(r => r.id === user.role_id) || roles.find(r => r.id === user.role + '-role'); // Fallback for legacy 'admin'/'staff' strings if mapped

                if (userRole) {
                    // Admin role always true
                    if (userRole.is_system && userRole.id === 'admin-role') return true;
                    if (userRole.permissions.includes(permission)) return true;
                }

                // 3. Fallback to direct permissions (Legacy support)
                return user.permissions?.includes(permission) || false;
            }
        }),
        {
            name: 'user-store',
            partialize: (state) => ({ users: state.users, roles: state.roles }), // Persist users & roles
        }
    )
);
