// =============================================================================
// EMPLOYEES PAGE
// Manage staff members, salaries, and permissions
// =============================================================================

import { useState, useEffect, useMemo } from 'react';
import { useUserStore, PERMISSION_GROUPS } from '@/stores/userStore';
import { useShiftStore } from '@/stores/shiftStore';
import { useAuthStore } from '@/stores/authStore';
import { formatVND } from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/types';
import {
    Users as UsersIcon,
    Plus as PlusIcon,
    Search as SearchIcon,
    Edit as EditIcon,
    Trash as TrashIcon,
    ChevronRight as ChevronRightIcon,
    Phone as PhoneIcon,
    Mail as MailIcon,
    X as XIcon
} from 'lucide-react';
// import { SalaryStatsTab } from './SalaryPage'; // Removing incorrect import, defined locally

type TabId = 'list' | 'salary';

// =============================================================================
// Main Component
// =============================================================================

export function EmployeesPage() {
    const { users, roles, fetchUsers, fetchRoles, createUser, updateUser, deleteUser, hasPermission } = useUserStore();
    const { user: authUser } = useAuthStore(); // Use authStore for permission check
    const { history, fetchHistory } = useShiftStore();

    const [activeTab, setActiveTab] = useState<TabId>('list');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewingHistoryUser, setViewingHistoryUser] = useState<UserProfile | null>(null);
    const [viewingDetailUser, setViewingDetailUser] = useState<UserProfile | null>(null);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserProfile | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState<string>('all');
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, [fetchUsers, fetchRoles]);

    // Check access - use authStore.user instead of shiftStore.currentUser
    const canManageEmployees = useMemo(() => {
        return authUser?.role === 'admin';
    }, [authUser]);

    const filteredUsers = useMemo(() => {
        // If admin, show all (filtered). If staff, show ONLY self.
        let baseList = users;
        if (authUser?.role !== 'admin') {
            baseList = users.filter(u => u.id === authUser?.id);
        }

        return baseList.filter(user => {
            const matchesSearch = user.full_name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesRole = filterRole === 'all' || (filterRole === 'admin' ? user.role === 'admin' : user.role === 'staff'); // Simplified filter for now
            // const isActive = user.is_active; // Don't filter by active status, show all so we can re-activate them
            return matchesSearch && matchesRole; // && isActive;
        });
    }, [users, searchQuery, filterRole, authUser]);

    const handleEdit = (user: UserProfile) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingUser(null);
        setIsModalOpen(true);
    };

    if (!canManageEmployees) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Truy cập bị từ chối</h1>
                    <p className="text-gray-600">Bạn không có quyền truy cập trang này. Vui lòng đăng nhập với tài khoản Admin.</p>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'list' as TabId, label: '👥 Danh sách nhân viên', count: users.filter(u => u.is_active).length },
        { id: 'salary' as TabId, label: '💰 Bảng lương tháng', count: null },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="container-app py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Quản lý nhân viên</h1>
                            <p className="text-sm text-gray-500">
                                {users.filter(u => u.is_active).length} nhân viên đang hoạt động
                            </p>
                        </div>
                        <button
                            onClick={handleCreate}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-all",
                                "bg-primary hover:bg-primary-dark shadow-sm hover:shadow"
                            )}
                        >
                            <PlusIcon className="w-5 h-5" />
                            Thêm nhân viên
                        </button>
                    </div>
                </div>
            </header>

            {/* Filters & Content */}
            <main className="container-app py-6">
                {/* Tab Navigation */}
                <div className="flex gap-2 mb-6 border-b border-gray-200">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                                activeTab === tab.id
                                    ? "border-primary text-primary"
                                    : "border-transparent text-gray-500 hover:text-gray-700"
                            )}
                        >
                            {tab.label}
                            {tab.count !== null && (
                                <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'list' && (
                    <>
                        {/* Search & Filter */}
                        <div className="flex flex-col md:flex-row gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex-1 relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm theo tên..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                            <div className="flex gap-2">
                                <select
                                    value={filterRole}
                                    onChange={(e) => setFilterRole(e.target.value)}
                                    className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white"
                                >
                                    <option value="all">Tất cả vai trò</option>
                                    <option value="admin">Quản lý (Admin)</option>
                                    <option value="staff">Nhân viên (Staff)</option>
                                </select>
                            </div>
                        </div>

                        {/* Employee Grid */}
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredUsers.map(user => (
                                <EmployeeCard
                                    key={user.id}
                                    user={user}
                                    onEdit={() => handleEdit(user)}
                                    onViewHistory={() => setViewingHistoryUser(user)}
                                    onViewDetail={() => setViewingDetailUser(user)}
                                />
                            ))}
                        </div>

                        {filteredUsers.length === 0 && (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <UsersIcon className="w-8 h-8 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">Không tìm thấy nhân viên</h3>
                                <p className="text-gray-500 mt-1">Thử thay đổi bộ lọc hoặc thêm nhân viên mới</p>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'salary' && (
                    <SalaryStatsTab
                        users={users.filter(u => u.is_active)}
                        selectedMonth={selectedMonth}
                        onMonthChange={setSelectedMonth}
                    />
                )}
            </main>

            {/* Modal */}
            {isModalOpen && (
                <EmployeeModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    initialData={editingUser || undefined}
                    onSave={async (data, password) => {
                        if (editingUser) {
                            await updateUser(editingUser.id, data);
                        } else {
                            await createUser(data, password);
                        }
                        setIsModalOpen(false);
                    }}
                />
            )}

            {/* Work History Modal */}
            {viewingHistoryUser && (
                <WorkHistoryModal
                    user={viewingHistoryUser}
                    onClose={() => setViewingHistoryUser(null)}
                />
            )}

            {/* Employee Detail Modal */}
            {viewingDetailUser && (
                <EmployeeDetailModal
                    user={viewingDetailUser}
                    onClose={() => setViewingDetailUser(null)}
                    onEdit={() => {
                        setEditingUser(viewingDetailUser);
                        setIsModalOpen(true);
                        setViewingDetailUser(null);
                    }}
                    onDelete={() => {
                        setDeleteConfirmUser(viewingDetailUser);
                        setViewingDetailUser(null);
                    }}
                    onToggleActive={async () => {
                        if (!viewingDetailUser) return;
                        const newStatus = !viewingDetailUser.is_active;
                        const action = newStatus ? 'kích hoạt' : 'tạm dừng';
                        if (window.confirm(`Bạn có chắc muốn ${action} nhân viên "${viewingDetailUser.full_name}"?`)) {
                            await updateUser(viewingDetailUser.id, { is_active: newStatus });
                            setViewingDetailUser({ ...viewingDetailUser, is_active: newStatus });
                        }
                    }}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmUser && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 10000,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: 'white', borderRadius: '16px',
                        padding: '32px', maxWidth: '400px', width: '100%',
                        textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                        <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
                            Xác nhận xóa nhân viên?
                        </h3>
                        <p style={{ color: '#6b7280', marginBottom: '24px' }}>
                            Bạn có chắc chắn muốn xóa nhân viên <strong>"{deleteConfirmUser.full_name}"</strong>?
                            <br />Hành động này không thể hoàn tác.
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setDeleteConfirmUser(null)}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '8px',
                                    border: '1px solid #d1d5db', backgroundColor: 'white',
                                    fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={async () => {
                                    await deleteUser(deleteConfirmUser.id);
                                    setDeleteConfirmUser(null);
                                }}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '8px',
                                    border: 'none', backgroundColor: '#dc2626', color: 'white',
                                    fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                🗑️ Xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// Sub-components
// =============================================================================

function EmployeeCard({ user, onEdit, onViewHistory, onViewDetail }: {
    user: UserProfile;
    onEdit: () => void;
    onViewHistory: () => void;
    onViewDetail: () => void;
}) {
    const { roles } = useUserStore();
    // Resolve role name
    const roleName = (() => {
        if (user.role_id) {
            const r = roles.find(rl => rl.id === user.role_id);
            if (r) return r.name;
        }
        return user.role === 'admin' ? 'Quản lý' : 'Nhân viên';
    })();

    const roleColor = user.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700";

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow relative group">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold",
                        roleColor
                    )}>
                        {user.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">{user.full_name}</h3>
                        <span className={cn(
                            "inline-block px-2 py-0.5 rounded text-xs font-medium",
                            roleColor
                        )}>
                            {roleName}
                        </span>
                    </div>
                </div>
                <button
                    onClick={onEdit}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <EditIcon className="w-5 h-5" />
                </button>
            </div>

            <div className="space-y-2 text-sm text-gray-600 border-t pt-4">
                <div className="flex justify-between">
                    <span>Lương theo giờ:</span>
                    <span className="font-medium text-gray-900">{formatVND(user.hourly_rate || 0)}/h</span>
                </div>
                <div className="flex justify-between">
                    <span>Email:</span>
                    <span className="font-medium text-gray-900 truncate max-w-[150px]">{user.email || '---'}</span>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 pt-3 border-t flex gap-2">
                <button
                    onClick={onViewDetail}
                    className="flex-1 px-3 py-2 text-xs font-medium text-center text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                >
                    Chi tiết
                </button>
                <button
                    onClick={onViewHistory}
                    className="flex-1 px-3 py-2 text-xs font-medium text-center text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors border border-transparent"
                >
                    Lịch sử làm việc
                </button>
            </div>
        </div>
    );
}

// =============================================================================
// Employee Detail Modal
// =============================================================================

function EmployeeDetailModal({ user, onClose, onEdit, onDelete, onToggleActive }: {
    user: UserProfile;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onToggleActive?: () => Promise<void>;
}) {
    // Inline styles for consistency
    const overlayStyle: React.CSSProperties = {
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
    };

    const modalStyle: React.CSSProperties = {
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
    };

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <div style={{ padding: '24px', position: 'relative' }}>
                    <button
                        onClick={onClose}
                        style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', color: '#9ca3af' }}
                    >✕</button>

                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <div style={{
                            width: '80px', height: '80px', borderRadius: '50%',
                            backgroundColor: user.role === 'admin' ? '#f3e8ff' : '#dbeafe',
                            color: user.role === 'admin' ? '#7e22ce' : '#1d4ed8',
                            fontSize: '32px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
                        }}>
                            {user.full_name.charAt(0).toUpperCase()}
                        </div>
                        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>{user.full_name}</h2>
                        <span style={{
                            display: 'inline-block', marginTop: '8px', padding: '4px 12px', borderRadius: '999px', fontSize: '14px', fontWeight: 500,
                            backgroundColor: user.role === 'admin' ? '#f3e8ff' : '#dbeafe',
                            color: user.role === 'admin' ? '#7e22ce' : '#1d4ed8'
                        }}>
                            {user.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}
                        </span>
                    </div>

                    <div style={{ display: 'grid', gap: '16px', marginBottom: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                            <span style={{ color: '#6b7280', fontSize: '14px' }}>Số điện thoại (ID)</span>
                            <span style={{ color: '#111827', fontWeight: 500 }}>{user.phone || 'Chưa cập nhật'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                            <span style={{ color: '#6b7280', fontSize: '14px' }}>Email</span>
                            <span style={{ color: '#111827', fontWeight: 500 }}>{user.email || 'Chưa cập nhật'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                            <span style={{ color: '#6b7280', fontSize: '14px' }}>Lương theo giờ</span>
                            <span style={{ color: '#111827', fontWeight: 500 }}>{formatVND(user.hourly_rate || 0)}/h</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                            <span style={{ color: '#6b7280', fontSize: '14px' }}>Trạng thái</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: user.is_active ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
                                    {user.is_active ? 'Đang hoạt động' : 'Đang tạm dừng'}
                                </span>
                                {onToggleActive && (
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            await onToggleActive();
                                        }}
                                        style={{
                                            padding: '4px 8px',
                                            fontSize: '12px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '4px',
                                            backgroundColor: 'white',
                                            cursor: 'pointer',
                                            color: '#6b7280'
                                        }}
                                    >
                                        {user.is_active ? 'Tạm dừng' : 'Kích hoạt'}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                            <span style={{ color: '#6b7280', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Quyền hạn ({user.role === 'admin' ? 'Tất cả' : (user.permissions?.length || 0)})</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {user.role === 'admin' ? (
                                    <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f3e8ff', color: '#7e22ce' }}>Toàn quyền hệ thống</span>
                                ) : user.permissions && user.permissions.length > 0 ? (
                                    user.permissions.slice(0, 5).map(p => (
                                        <span key={p} style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e5e7eb', color: '#374151' }}>
                                            {p}
                                        </span>
                                    ))
                                ) : (
                                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>Chưa được cấp quyền</span>
                                )}
                                {user.role !== 'admin' && user.permissions && user.permissions.length > 5 && (
                                    <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e5e7eb', color: '#374151' }}>
                                        +{user.permissions.length - 5}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <button
                            onClick={onDelete}
                            style={{
                                padding: '12px', borderRadius: '8px', border: '1px solid #fee2e2', backgroundColor: '#fef2f2', color: '#dc2626', fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                            }}
                        >
                            🗑️ Xóa nhân viên
                        </button>
                        <button
                            onClick={onEdit}
                            style={{
                                padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#111827', color: 'white', fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                            }}
                        >
                            ✏️ Chỉnh sửa
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface EmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: UserProfile;
    onSave: (data: Partial<UserProfile>, password?: string) => Promise<void>;
}

function EmployeeModal({ isOpen, onClose, initialData, onSave }: EmployeeModalProps) {
    const { roles } = useUserStore();
    const [formData, setFormData] = useState<Partial<UserProfile> & { email?: string; phone?: string }>({
        full_name: '',
        role: 'staff',
        role_id: undefined,
        hourly_rate: 20000,
        is_active: true,
        email: '',
        phone: '',
        ...initialData
    });
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPermissions, setShowPermissions] = useState(false);

    // Initial role setup
    useEffect(() => {
        if (!initialData?.role_id && !formData.role_id && roles.length > 0) {
            // If no role_id, try to map from role string
            const matchedRole = roles.find(r => r.id === initialData?.role + '-role') || roles.find(r => r.id === 'staff-role');
            if (matchedRole) {
                setFormData(prev => ({ ...prev, role_id: matchedRole.id }));
            }
        }
    }, [initialData, roles]);

    const isEdit = !!initialData?.id;

    const togglePermission = (code: string) => {
        setFormData(prev => {
            const currentPerms = prev.permissions || [];
            if (currentPerms.includes(code as any)) {
                return { ...prev, permissions: currentPerms.filter(p => p !== code) };
            } else {
                return { ...prev, permissions: [...currentPerms, code as any] };
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!formData.full_name?.trim()) {
            setError('Vui lòng nhập họ và tên');
            return;
        }
        if (!formData.role_id) {
            setError('Vui lòng chọn vai trò');
            return;
        }

        if (!isEdit && !formData.email?.trim()) {
            setError('Vui lòng nhập email đăng nhập');
            return;
        }

        if (!isEdit && password.length < 6) {
            setError('Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }

        if (!isEdit && password !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp');
            return;
        }

        setIsSaving(true);
        try {
            await onSave(formData, isEdit ? undefined : password);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Có lỗi xảy ra');
        }
        setIsSaving(false);
    };

    if (!isOpen) return null;

    // Inline styles for reliable display
    const overlayStyle: React.CSSProperties = {
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
    };

    const modalStyle: React.CSSProperties = {
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
    };

    const headerStyle: React.CSSProperties = {
        padding: '20px 24px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        backgroundColor: 'white',
        zIndex: 10
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: '14px',
        fontWeight: 500,
        color: '#374151',
        marginBottom: '6px'
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 14px',
        borderRadius: '8px',
        border: '1px solid #d1d5db',
        fontSize: '14px',
        outline: 'none'
    };

    const sectionTitleStyle: React.CSSProperties = {
        fontWeight: 600,
        color: '#111827',
        borderBottom: '1px solid #e5e7eb',
        paddingBottom: '8px',
        marginBottom: '16px',
        fontSize: '15px'
    };

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <div style={headerStyle}>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                        {isEdit ? '✏️ Chỉnh sửa nhân viên' : '➕ Thêm nhân viên mới'}
                    </h2>
                    <button onClick={onClose} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#6b7280' }}>✕</button>
                </div>

                {error && (
                    <div style={{ margin: '16px 24px 0', padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '14px' }}>
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                    <div style={{ display: 'grid', gap: '20px' }}>
                        {/* Basic Info */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Họ và tên *</label>
                                <input
                                    type="text"
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                    style={inputStyle}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Vai trò *</label>
                                <select
                                    value={formData.role_id || ''}
                                    onChange={e => {
                                        const roleId = e.target.value;
                                        const selectedRole = roles.find(r => r.id === roleId);
                                        setFormData({
                                            ...formData,
                                            role_id: roleId as any,
                                            role: selectedRole?.id === 'admin-role' ? 'admin' : 'staff'
                                        });
                                    }}
                                    style={inputStyle}
                                >
                                    <option value="">-- Chọn vai trò --</option>
                                    {roles.map(role => (
                                        <option key={role.id} value={role.id}>
                                            {role.name} {role.is_system ? '(Hệ thống)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Email (Đăng nhập) *</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    style={inputStyle}
                                    disabled={isEdit}
                                    placeholder="example@email.com"
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Lương theo giờ (VNĐ)</label>
                                <input
                                    type="number"
                                    value={formData.hourly_rate}
                                    onChange={e => setFormData({ ...formData, hourly_rate: Number(e.target.value) })}
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={labelStyle}>Số điện thoại (Tuỳ chọn)</label>
                            <input
                                type="text"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                style={inputStyle}
                                placeholder="0123 456 789"
                            />
                        </div>

                        {!isEdit && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingTop: '10px', borderTop: '1px solid #f3f4f6' }}>
                                <div>
                                    <label style={labelStyle}>Mật khẩu *</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        style={inputStyle}
                                        placeholder="Tối thiểu 6 ký tự"
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Xác nhận mật khẩu *</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={formData.is_active}
                                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                style={{ width: '16px', height: '16px' }}
                            />
                            <label htmlFor="is_active" style={{ fontSize: '14px', color: '#374151', cursor: 'pointer' }}>Đang hoạt động</label>
                        </div>

                        <div style={{ marginTop: '10px', fontSize: '12px', color: '#6b7280', backgroundColor: '#f9fafb', padding: '10px', borderRadius: '8px' }}>
                            ℹ️ <strong>Lưu ý:</strong> Quyền hạn của nhân viên sẽ được tự động áp dụng dựa trên vai trò đã chọn. Bạn có thể quản lý chi tiết quyền cho từng vai trò trong trang Cài đặt.
                        </div>

                        <div style={{ marginTop: '32px' }}>
                            <button
                                type="button"
                                onClick={() => setShowPermissions(!showPermissions)}
                                style={{ fontSize: '13px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                {showPermissions ? 'Ẩn chi tiết quyền' : 'Hiển thị chi tiết quyền (Chỉ xem)'}
                            </button>
                            {showPermissions && (
                                <div style={{ marginTop: '16px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', opacity: 0.6, pointerEvents: 'none' }}>
                                        {PERMISSION_GROUPS.map(group => (
                                            <div key={group.name} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                                                <div style={{ padding: '10px 12px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: 500, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {group.icon} {group.name}
                                                </div>
                                                <div style={{ padding: '12px' }}>
                                                    {group.permissions.map(perm => (
                                                        <label key={perm.code} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', cursor: 'pointer' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.permissions?.includes(perm.code)}
                                                                onChange={() => togglePermission(perm.code)}
                                                                style={{ width: '14px', height: '14px' }}
                                                            />
                                                            {perm.label}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', fontWeight: 500, cursor: 'pointer' }}
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            style={{
                                padding: '10px 20px', borderRadius: '8px', border: 'none',
                                backgroundColor: isSaving ? '#9ca3af' : '#22c55e',
                                color: 'white', fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer',
                                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)'
                            }}
                        >
                            {isSaving ? 'Đang lưu...' : 'Lưu nhân viên'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// =============================================================================
// ICONS & HELPERS
// =============================================================================

// ICONS & HELPERS
// Removed incompatible local icon definitions in favor of lucide-react imports


function WorkHistoryModal({ user, onClose }: { user: UserProfile; onClose: () => void }) {
    const { history, fetchHistory } = useShiftStore();
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    useEffect(() => {
        fetchHistory(user.id).finally(() => setLoading(false));
    }, [user.id, fetchHistory]);

    // Get list of available months from history
    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        const now = new Date();
        // Always include current month
        months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
        // Add months from history
        history.forEach(shift => {
            const date = new Date(shift.clock_in);
            months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
        });
        return Array.from(months).sort().reverse();
    }, [history]);

    // Filter history by selected month
    const filteredHistory = useMemo(() => {
        if (!selectedMonth) return history;
        const [year, month] = selectedMonth.split('-').map(Number);
        return history.filter(shift => {
            const date = new Date(shift.clock_in);
            return date.getFullYear() === year && date.getMonth() + 1 === month;
        });
    }, [history, selectedMonth]);

    // Calculate statistics for selected month
    const stats = useMemo(() => {
        let totalHours = 0;
        let totalMinutes = 0;
        let totalRevenue = 0;
        let completedShifts = 0;
        let activeShifts = 0;

        filteredHistory.forEach(shift => {
            if (shift.clock_out) {
                const clockIn = new Date(shift.clock_in);
                const clockOut = new Date(shift.clock_out);
                const diffMs = clockOut.getTime() - clockIn.getTime();
                const hours = diffMs / (1000 * 60 * 60);
                totalHours += Math.floor(hours);
                totalMinutes += Math.round((hours % 1) * 60);
                completedShifts++;
            } else {
                activeShifts++;
            }
            totalRevenue += (shift.total_cash_sales || 0) + (shift.total_transfer_sales || 0);
        });

        // Normalize minutes to hours
        totalHours += Math.floor(totalMinutes / 60);
        totalMinutes = totalMinutes % 60;

        const hourlyRate = user.hourly_rate || 0;
        const totalHoursDecimal = totalHours + (totalMinutes / 60);
        const calculatedSalary = Math.round(totalHoursDecimal * hourlyRate);

        return {
            totalShifts: filteredHistory.length,
            completedShifts,
            activeShifts,
            totalHours,
            totalMinutes,
            totalHoursDecimal,
            totalRevenue,
            calculatedSalary,
            hourlyRate
        };
    }, [filteredHistory, user.hourly_rate]);

    // Format month display
    const formatMonth = (monthStr: string) => {
        const [year, month] = monthStr.split('-');
        const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
            'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
        return `${monthNames[parseInt(month) - 1]}, ${year}`;
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-gradient-to-r from-blue-600 to-purple-600">
                    <div>
                        <h2 className="text-xl font-bold text-white">📊 Lịch sử làm việc & Bảng lương</h2>
                        <p className="text-sm text-blue-100">
                            Nhân viên: <span className="font-semibold text-white">{user.full_name}</span>
                            <span className="mx-2">•</span>
                            <span className={user.role === 'admin' ? 'text-yellow-300' : 'text-blue-200'}>
                                {user.role === 'admin' ? 'Quản lý' : 'Nhân viên'}
                            </span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <XIcon className="w-6 h-6 text-white" />
                    </button>
                </div>


                {/* Month Selector */}
                <div className="px-6 pt-4 flex items-center gap-4 bg-gray-50 border-b">
                    <label className="text-sm font-medium text-gray-600">Xem tháng:</label>
                    <div className="flex gap-2 pb-4 overflow-x-auto">
                        {availableMonths.map(month => (
                            <button
                                key={month}
                                onClick={() => setSelectedMonth(month)}
                                className={cn(
                                    "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                                    selectedMonth === month
                                        ? "bg-blue-600 text-white shadow-md"
                                        : "bg-white text-gray-600 hover:bg-gray-100 border"
                                )}
                            >
                                {formatMonth(month)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl text-white shadow-lg">
                            <span className="text-xs font-semibold uppercase opacity-80">Số ca làm</span>
                            <p className="text-3xl font-bold mt-1">{stats.completedShifts}</p>
                            {stats.activeShifts > 0 && (
                                <p className="text-xs text-blue-200 mt-1">+{stats.activeShifts} đang mở</p>
                            )}
                        </div>
                        <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl text-white shadow-lg">
                            <span className="text-xs font-semibold uppercase opacity-80">Giờ làm việc</span>
                            <p className="text-3xl font-bold mt-1">
                                {stats.totalHours}h{stats.totalMinutes > 0 ? stats.totalMinutes + 'p' : ''}
                            </p>
                            <p className="text-xs text-green-200 mt-1">{stats.totalHoursDecimal.toFixed(1)} giờ</p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-xl text-white shadow-lg">
                            <span className="text-xs font-semibold uppercase opacity-80">Doanh thu tạo ra</span>
                            <p className="text-2xl font-bold mt-1">{formatVND(stats.totalRevenue)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-4 rounded-xl text-white shadow-lg">
                            <span className="text-xs font-semibold uppercase opacity-80">💰 Lương tháng</span>
                            <p className="text-2xl font-bold mt-1">{formatVND(stats.calculatedSalary)}</p>
                            <p className="text-xs text-amber-200 mt-1">{formatVND(stats.hourlyRate)}/giờ</p>
                        </div>
                    </div>

                    {/* Salary Breakdown */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                        <h3 className="font-semibold text-amber-800 mb-2">📋 Chi tiết tính lương - {formatMonth(selectedMonth)}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-gray-600">Lương theo giờ:</span>
                                <span className="font-bold text-gray-900 ml-2">{formatVND(stats.hourlyRate)}</span>
                            </div>
                            <div>
                                <span className="text-gray-600">Số giờ làm:</span>
                                <span className="font-bold text-gray-900 ml-2">{stats.totalHoursDecimal.toFixed(2)} giờ</span>
                            </div>
                            <div>
                                <span className="text-gray-600">Công thức:</span>
                                <span className="font-mono text-gray-900 ml-2">{stats.totalHoursDecimal.toFixed(1)} × {(stats.hourlyRate / 1000).toFixed(0)}k</span>
                            </div>
                            <div>
                                <span className="text-gray-600">Tổng lương:</span>
                                <span className="font-bold text-green-700 ml-2">{formatVND(stats.calculatedSalary)}</span>
                            </div>
                        </div>
                    </div>

                    {/* History Table */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                            <h3 className="font-semibold text-gray-900">Chi tiết các ca làm việc</h3>
                            <span className="text-sm text-gray-500">{filteredHistory.length} ca trong tháng</span>
                        </div>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3">Ngày</th>
                                    <th className="px-4 py-3">Vào ca</th>
                                    <th className="px-4 py-3">Ra ca</th>
                                    <th className="px-4 py-3 text-center">Thời gian</th>
                                    <th className="px-4 py-3 text-right">Doanh thu</th>
                                    <th className="px-4 py-3 text-right">Lương ca</th>
                                    <th className="px-4 py-3 text-center">TT</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Đang tải dữ liệu...</td></tr>
                                ) : filteredHistory.length === 0 ? (
                                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Không có ca làm nào trong tháng này</td></tr>
                                ) : (
                                    filteredHistory.map(shift => {
                                        let duration = '';
                                        let shiftSalary = 0;
                                        if (shift.clock_out) {
                                            const clockIn = new Date(shift.clock_in);
                                            const clockOut = new Date(shift.clock_out);
                                            const diffMs = clockOut.getTime() - clockIn.getTime();
                                            const hours = Math.floor(diffMs / (1000 * 60 * 60));
                                            const mins = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                                            duration = `${hours}h${mins > 0 ? mins + 'p' : ''}`;
                                            shiftSalary = Math.round((hours + mins / 60) * (user.hourly_rate || 0));
                                        }
                                        const revenue = (shift.total_cash_sales || 0) + (shift.total_transfer_sales || 0);

                                        return (
                                            <tr key={shift.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 font-medium">
                                                    {new Date(shift.clock_in).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">
                                                    {new Date(shift.clock_in).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {shift.clock_out ? (
                                                        <span className="text-gray-600">
                                                            {new Date(shift.clock_out).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    ) : <span className="text-green-600 font-medium animate-pulse">🟢 Đang làm</span>}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {duration ? (
                                                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">{duration}</span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium">
                                                    {revenue > 0 ? formatVND(revenue) : <span className="text-gray-400">-</span>}
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-green-600">
                                                    {shiftSalary > 0 ? formatVND(shiftSalary) : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={cn(
                                                        "inline-flex px-2 py-1 rounded-full text-xs font-semibold",
                                                        shift.status === 'active' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                                                    )}>
                                                        {shift.status === 'active' ? '🟢' : '✅'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            {filteredHistory.length > 0 && (
                                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                                    <tr className="font-semibold">
                                        <td colSpan={3} className="px-4 py-3 text-gray-700">TỔNG CỘNG</td>
                                        <td className="px-4 py-3 text-center text-blue-700">
                                            {stats.totalHours}h{stats.totalMinutes > 0 ? stats.totalMinutes + 'p' : ''}
                                        </td>
                                        <td className="px-4 py-3 text-right">{formatVND(stats.totalRevenue)}</td>
                                        <td className="px-4 py-3 text-right text-green-700">{formatVND(stats.calculatedSalary)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                        💡 Lương được tính tự động dựa trên số giờ làm thực tế × mức lương/giờ
                    </p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// Salary Statistics Tab Component
// =============================================================================

interface SalaryStatsTabProps {
    users: UserProfile[];
    selectedMonth: string;
    onMonthChange: (month: string) => void;
}

function SalaryStatsTab({ users, selectedMonth, onMonthChange }: SalaryStatsTabProps) {
    const { history, fetchHistory } = useShiftStore();
    const [loading, setLoading] = useState(true);
    const [allShifts, setAllShifts] = useState<any[]>([]);

    // Generate last 6 months for selection
    const availableMonths = useMemo(() => {
        const months: string[] = [];
        const now = new Date();
        for (let i = 0; i < 6; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
        }
        return months;
    }, []);

    useEffect(() => {
        // Fetch all shifts for all users
        const fetchAllShifts = async () => {
            setLoading(true);
            try {
                // For now, use mock data or aggregate from local storage
                const savedHistory = localStorage.getItem('shift_history');
                if (savedHistory) {
                    setAllShifts(JSON.parse(savedHistory));
                }
            } catch (e) {
                console.error('Error loading shifts:', e);
            }
            setLoading(false);
        };
        fetchAllShifts();
    }, [selectedMonth]);

    // Calculate salary for each user
    const userSalaries = useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number);

        return users.map(user => {
            // Filter shifts for this user and month
            const userShifts = allShifts.filter(shift => {
                if (shift.user_id !== user.id) return false;
                const shiftDate = new Date(shift.clock_in);
                return shiftDate.getFullYear() === year && shiftDate.getMonth() + 1 === month;
            });

            let totalHours = 0;
            let totalMinutes = 0;
            let completedShifts = 0;
            let totalRevenue = 0;

            userShifts.forEach(shift => {
                if (shift.clock_out) {
                    const clockIn = new Date(shift.clock_in);
                    const clockOut = new Date(shift.clock_out);
                    const diffMs = clockOut.getTime() - clockIn.getTime();
                    const hours = diffMs / (1000 * 60 * 60);
                    totalHours += Math.floor(hours);
                    totalMinutes += Math.round((hours % 1) * 60);
                    completedShifts++;
                }
                totalRevenue += (shift.total_cash_sales || 0) + (shift.total_transfer_sales || 0);
            });

            // Normalize minutes
            totalHours += Math.floor(totalMinutes / 60);
            totalMinutes = totalMinutes % 60;

            const totalHoursDecimal = totalHours + (totalMinutes / 60);
            const calculatedSalary = Math.round(totalHoursDecimal * (user.hourly_rate || 0));

            return {
                user,
                totalShifts: completedShifts,
                totalHours,
                totalMinutes,
                totalHoursDecimal,
                totalRevenue,
                calculatedSalary,
                hourlyRate: user.hourly_rate || 0
            };
        });
    }, [users, allShifts, selectedMonth]);

    const totalSalary = userSalaries.reduce((sum, u) => sum + u.calculatedSalary, 0);
    const totalHoursAll = userSalaries.reduce((sum, u) => sum + u.totalHoursDecimal, 0);
    const totalShiftsAll = userSalaries.reduce((sum, u) => sum + u.totalShifts, 0);

    const formatMonth = (monthStr: string) => {
        const [year, month] = monthStr.split('-');
        const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
            'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
        return `${monthNames[parseInt(month) - 1]}, ${year}`;
    };

    return (
        <div className="space-y-6">
            {/* Month Selector */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl border">
                <label className="text-sm font-medium text-gray-600">📅 Chọn tháng:</label>
                <div className="flex gap-2 flex-wrap">
                    {availableMonths.map(month => (
                        <button
                            key={month}
                            onClick={() => onMonthChange(month)}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                selectedMonth === month
                                    ? "bg-blue-600 text-white shadow-md"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                        >
                            {formatMonth(month)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl text-white shadow-lg">
                    <span className="text-xs font-semibold uppercase opacity-80">Tổng số ca</span>
                    <p className="text-3xl font-bold mt-1">{totalShiftsAll}</p>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl text-white shadow-lg">
                    <span className="text-xs font-semibold uppercase opacity-80">Tổng giờ làm</span>
                    <p className="text-3xl font-bold mt-1">{totalHoursAll.toFixed(1)}h</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-xl text-white shadow-lg">
                    <span className="text-xs font-semibold uppercase opacity-80">Nhân viên</span>
                    <p className="text-3xl font-bold mt-1">{users.length}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-4 rounded-xl text-white shadow-lg">
                    <span className="text-xs font-semibold uppercase opacity-80">💰 Tổng lương</span>
                    <p className="text-2xl font-bold mt-1">{formatVND(totalSalary)}</p>
                </div>
            </div>

            {/* Salary Table */}
            <div className="bg-white rounded-xl border overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                    <h3 className="text-lg font-semibold text-white">💰 Bảng lương nhân viên - {formatMonth(selectedMonth)}</h3>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Nhân viên</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Vai trò</th>
                            <th className="px-4 py-3 text-center font-medium text-gray-600">Số ca</th>
                            <th className="px-4 py-3 text-center font-medium text-gray-600">Giờ làm</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-600">Lương/giờ</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-600">💰 Lương tháng</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Đang tải dữ liệu...</td></tr>
                        ) : userSalaries.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Không có nhân viên nào</td></tr>
                        ) : (
                            userSalaries.map(data => (
                                <tr key={data.user.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                                                data.user.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                                            )}>
                                                {data.user.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-medium text-gray-900">{data.user.full_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={cn(
                                            "px-2 py-1 rounded text-xs font-medium",
                                            data.user.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                                        )}>
                                            {data.user.role === 'admin' ? 'Quản lý' : 'Nhân viên'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="bg-gray-100 px-2 py-1 rounded text-gray-700 font-medium">{data.totalShifts}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
                                            {data.totalHours}h{data.totalMinutes > 0 ? data.totalMinutes + 'p' : ''}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-600">
                                        {formatVND(data.hourlyRate)}/h
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="font-bold text-green-600 text-lg">{formatVND(data.calculatedSalary)}</span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    {userSalaries.length > 0 && (
                        <tfoot className="bg-gray-100 border-t-2">
                            <tr className="font-semibold">
                                <td colSpan={2} className="px-4 py-3 text-gray-700">TỔNG CỘNG</td>
                                <td className="px-4 py-3 text-center">{totalShiftsAll}</td>
                                <td className="px-4 py-3 text-center text-blue-700">{totalHoursAll.toFixed(1)}h</td>
                                <td></td>
                                <td className="px-4 py-3 text-right text-green-700 text-lg">{formatVND(totalSalary)}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Info */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800">
                    💡 <strong>Công thức tính lương:</strong> Lương = Số giờ làm thực tế × Lương theo giờ
                </p>
                <p className="text-xs text-amber-600 mt-1">
                    Dữ liệu được tính từ lịch sử vào ca/kết ca của từng nhân viên trong tháng đã chọn.
                </p>
            </div>
        </div>
    );
}

export default EmployeesPage;
