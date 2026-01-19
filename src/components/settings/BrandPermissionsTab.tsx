// Brand Permissions Tab - Configure staff permissions per brand
import { useState, useEffect } from 'react';
import { useAuthStore, loadBrandPermissions, clearPermissionsCache } from '@/stores/authStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { toast } from 'sonner';

interface BrandPermission {
    staff_can_view_cost_price: boolean;
    staff_can_view_purchase_price: boolean;
    staff_can_edit_selling_price: boolean;
    staff_can_edit_purchase_price: boolean;
    staff_can_delete_products: boolean;
    staff_can_view_reports: boolean;
    staff_can_manage_inventory: boolean;
    staff_can_process_orders: boolean;
}

export function BrandPermissionsTab() {
    const { brandId, user } = useAuthStore();
    const [permissions, setPermissions] = useState<BrandPermission>({
        staff_can_view_cost_price: false,
        staff_can_view_purchase_price: false,
        staff_can_edit_selling_price: false,
        staff_can_edit_purchase_price: false,
        staff_can_delete_products: false,
        staff_can_view_reports: false,
        staff_can_manage_inventory: true,
        staff_can_process_orders: true,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Only owner/admin can edit permissions
    const canEdit = user?.role === 'owner' || user?.role === 'admin';

    useEffect(() => {
        loadPermissions();
    }, [brandId]);

    const loadPermissions = async () => {
        if (!brandId || !isSupabaseConfigured() || !supabase) {
            setIsLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('brand_permissions')
                .select('*')
                .eq('brand_id', brandId)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (data) {
                setPermissions({
                    staff_can_view_cost_price: data.staff_can_view_cost_price || false,
                    staff_can_view_purchase_price: data.staff_can_view_purchase_price || false,
                    staff_can_edit_selling_price: data.staff_can_edit_selling_price || false,
                    staff_can_edit_purchase_price: data.staff_can_edit_purchase_price || false,
                    staff_can_delete_products: data.staff_can_delete_products || false,
                    staff_can_view_reports: data.staff_can_view_reports || false,
                    staff_can_manage_inventory: data.staff_can_manage_inventory ?? true,
                    staff_can_process_orders: data.staff_can_process_orders ?? true,
                });
            }
        } catch (err) {
            console.error('Error loading permissions:', err);
            toast.error('Không thể tải cài đặt phân quyền');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!brandId || !canEdit || !isSupabaseConfigured() || !supabase) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('brand_permissions')
                .upsert({
                    brand_id: brandId,
                    ...permissions,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'brand_id' });

            if (error) throw error;

            // Refresh cache
            clearPermissionsCache();
            await loadBrandPermissions();

            toast.success('Đã lưu cài đặt phân quyền');
        } catch (err) {
            console.error('Error saving permissions:', err);
            toast.error('Không thể lưu cài đặt phân quyền');
        } finally {
            setIsSaving(false);
        }
    };

    const updatePermission = <K extends keyof BrandPermission>(key: K, value: BrandPermission[K]) => {
        setPermissions(prev => ({ ...prev, [key]: value }));
    };

    const Toggle = ({ checked, onChange, label, disabled = false }: {
        checked: boolean;
        onChange: (v: boolean) => void;
        label: string;
        disabled?: boolean;
    }) => (
        <div className="flex items-center justify-between py-3">
            <span className={`font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>{label}</span>
            <div
                className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    } ${checked ? 'bg-green-500' : 'bg-gray-200'}`}
                onClick={() => !disabled && onChange(!checked)}
            >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${checked ? 'left-[22px]' : 'left-0.5'
                    }`} />
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-10 bg-gray-100 rounded"></div>
                    <div className="h-10 bg-gray-100 rounded"></div>
                    <div className="h-10 bg-gray-100 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                <div className="mb-4">
                    <h2 className="text-lg font-bold text-gray-900">🔐 Phân quyền nhân viên</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Cấu hình những gì nhân viên (role = staff) được phép xem và thao tác
                    </p>
                </div>

                {!canEdit && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                        ⚠️ Bạn cần quyền Admin hoặc Owner để thay đổi cài đặt phân quyền
                    </div>
                )}

                {/* Price Permissions */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        💰 Giá cả
                    </h3>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-1">
                        <Toggle
                            checked={permissions.staff_can_view_cost_price}
                            onChange={(v) => updatePermission('staff_can_view_cost_price', v)}
                            label="Xem giá vốn (bình quân)"
                            disabled={!canEdit}
                        />
                        <Toggle
                            checked={permissions.staff_can_view_purchase_price}
                            onChange={(v) => updatePermission('staff_can_view_purchase_price', v)}
                            label="Xem giá nhập"
                            disabled={!canEdit}
                        />
                        <Toggle
                            checked={permissions.staff_can_edit_selling_price}
                            onChange={(v) => updatePermission('staff_can_edit_selling_price', v)}
                            label="Sửa giá bán"
                            disabled={!canEdit}
                        />
                        <Toggle
                            checked={permissions.staff_can_edit_purchase_price}
                            onChange={(v) => updatePermission('staff_can_edit_purchase_price', v)}
                            label="Sửa giá nhập"
                            disabled={!canEdit}
                        />
                    </div>
                </div>

                {/* Product Permissions */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        📦 Sản phẩm & Kho
                    </h3>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-1">
                        <Toggle
                            checked={permissions.staff_can_delete_products}
                            onChange={(v) => updatePermission('staff_can_delete_products', v)}
                            label="Xóa sản phẩm"
                            disabled={!canEdit}
                        />
                        <Toggle
                            checked={permissions.staff_can_manage_inventory}
                            onChange={(v) => updatePermission('staff_can_manage_inventory', v)}
                            label="Quản lý tồn kho"
                            disabled={!canEdit}
                        />
                    </div>
                </div>

                {/* Operations Permissions */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        📊 Vận hành
                    </h3>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-1">
                        <Toggle
                            checked={permissions.staff_can_process_orders}
                            onChange={(v) => updatePermission('staff_can_process_orders', v)}
                            label="Xử lý đơn hàng"
                            disabled={!canEdit}
                        />
                        <Toggle
                            checked={permissions.staff_can_view_reports}
                            onChange={(v) => updatePermission('staff_can_view_reports', v)}
                            label="Xem báo cáo doanh thu/lợi nhuận"
                            disabled={!canEdit}
                        />
                    </div>
                </div>

                {/* Save Button */}
                {canEdit && (
                    <div className="text-right">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`px-6 py-2.5 rounded-lg font-semibold text-white transition-all ${isSaving
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-emerald-500 hover:bg-emerald-600'
                                }`}
                        >
                            {isSaving ? '⏳ Đang lưu...' : '✓ Lưu thay đổi'}
                        </button>
                    </div>
                )}
            </div>

            {/* Info Card */}
            <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-sm text-blue-800">
                <strong>💡 Lưu ý:</strong>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>Admin, Owner và Manager luôn có tất cả các quyền</li>
                    <li>Cài đặt này chỉ áp dụng cho nhân viên (role = Staff)</li>
                    <li>Thay đổi sẽ có hiệu lực ngay lập tức</li>
                </ul>
            </div>
        </div>
    );
}
