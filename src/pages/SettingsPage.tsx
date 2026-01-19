// =============================================================================
// SETTINGS PAGE - Comprehensive App Configuration
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { useSettingsStore, type Promotion, type PromotionType, type PrintTemplateType } from '@/stores/settingsStore';
import { useUserStore } from '@/stores/userStore';
import type { Role } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { formatVND } from '@/lib/cashReconciliation';
import { testPrint, print } from '@/lib/printService';
import {
    SalesReceiptTemplate, CashVoucherTemplate, PurchaseReceiptTemplate,
    StockCheckTemplate, ReturnReceiptTemplate, OrderFormTemplate,
    TransferReceiptTemplate, SupplierReturnTemplate,
    generateSalesReceiptHTML, generateCashVoucherHTML, generatePurchaseReceiptHTML,
    generateStockCheckHTML, generateReturnReceiptHTML, generateOrderFormHTML,
    generateTransferReceiptHTML, generateSupplierReturnHTML
} from '@/components/print';
import { BarcodeLabelTemplate } from '@/components/print/templates/BarcodeLabelTemplate';
import { BrandSettingsTab } from '@/components/settings/BrandSettingsTab';
import { DomainSettings } from '@/components/settings/DomainSettings';
import { BrandPermissionsTab } from '@/components/settings/BrandPermissionsTab';

type TabId = 'general' | 'brand' | 'domain' | 'permissions' | 'print' | 'receipt' | 'labels' | 'loyalty' | 'payment' | 'promotions' | 'expiry' | 'stock' | 'notifications' | 'debt' | 'shift';

interface Tab {
    id: TabId;
    label: string;
    icon: string;
}

export function SettingsPage() {
    const [activeTab, setActiveTab] = useState<TabId>('general');
    const {
        loyalty, paymentMethods, defaultPaymentMethod, receipt, allowNegativeStock,
        expiry, stockAlerts, promotionSettings,
        notifications, debt, shift, posCategories, printSettings,
        updateLoyalty, updatePaymentMethod, addPaymentMethod, deletePaymentMethod,
        reorderPaymentMethods, setDefaultPaymentMethod,
        updateReceipt, setAllowNegativeStock,
        updateExpiry, updateStockAlerts, addPromotion, updatePromotion, deletePromotion, updatePromotionSettings,
        updateNotifications, updateDebt, updateShiftSettings, updatePosCategories,
        updatePrintSettings, updatePrinter, updatePrintTemplate,
        labelConfig, updateLabelConfig // Added labelConfig hooks
    } = useSettingsStore();
    const { users, updateUser, roles, fetchRoles, addRole, updateRole, deleteRole, hasPermission } = useUserStore();
    const { user: authUser } = useAuthStore();

    // Modal states
    const [showPromoModal, setShowPromoModal] = useState(false);
    const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);

    // Role Modal
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);

    useEffect(() => {
        fetchRoles();
    }, [fetchRoles]);


    // Temp Shift Mode State
    const [tempShiftMode, setTempShiftMode] = useState<'auto' | 'manual'>(shift?.mode || 'manual');
    useEffect(() => {
        if (shift?.mode) setTempShiftMode(shift.mode);
    }, [shift?.mode]);

    const [saveSuccess, setSaveSuccess] = useState(false);

    // Print settings states
    const [selectedTemplate, setSelectedTemplate] = useState<PrintTemplateType>('sales_receipt');
    const [isPrinting, setIsPrinting] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const tabs: Tab[] = [
        { id: 'general', label: 'Chung', icon: '⚙️' },
        { id: 'brand', label: 'Thông tin cửa hàng', icon: '🏪' },
        { id: 'domain', label: 'Tên miền', icon: '🌐' },
        { id: 'promotions', label: 'Khuyến mãi', icon: '🎉' },
        { id: 'expiry', label: 'Hạn sử dụng', icon: '📅' },
        { id: 'stock', label: 'Tồn kho', icon: '📦' },
        { id: 'shift', label: 'Ca làm việc', icon: '⏱️' },
        { id: 'notifications', label: 'Thông báo', icon: '📱' },
        { id: 'debt', label: 'Công nợ', icon: '💰' },
        { id: 'loyalty', label: 'Tích điểm', icon: '🎁' },
        { id: 'payment', label: 'Thanh toán', icon: '💳' },
        { id: 'receipt', label: 'Hóa đơn', icon: '🧾' },
        { id: 'print', label: 'In ấn', icon: '🖨️' },
        { id: 'permissions', label: 'Phân quyền', icon: '🔐' },
    ];

    const isAdmin = authUser?.role === 'admin';

    // Style constants converted to Tailwind classes where applicable
    // Kept standard React functional components for reusability

    const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
        <div className="flex items-center justify-between py-3">
            <span className="font-medium text-gray-700">{label}</span>
            <div
                className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors duration-200 ${checked ? 'bg-green-500' : 'bg-gray-200'}`}
                onClick={() => onChange(!checked)}
            >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${checked ? 'left-[22px]' : 'left-0.5'}`} />
            </div>
        </div>
    );

    // Promotion type labels
    const promoTypeLabels: Record<PromotionType, string> = {
        'percentage': '% Giảm giá',
        'fixed_amount': 'Giảm cố định',
        'buy_x_get_y': 'Mua X tặng Y',
        'bundle': 'Combo',
        'happy_hour': 'Happy Hour',
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-4 py-4 md:px-6">
                <h1 className="text-lg md:text-xl font-bold text-gray-900">⚙️ Cài đặt hệ thống</h1>
            </header>

            {/* Mobile Tabs - Horizontal Scroll */}
            <div className="md:hidden bg-white border-b border-gray-200 overflow-x-auto">
                <div className="flex px-4 py-2 space-x-2 min-w-max">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                                ${activeTab === tab.id
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'text-gray-600 hover:bg-gray-100'}
                            `}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 md:p-6 flex flex-col md:flex-row gap-6">
                {/* Desktop Sidebar Tabs */}
                <div className="hidden md:block w-48 flex-shrink-0">
                    <div className="bg-white rounded-xl border border-gray-200 p-2 sticky top-4 shadow-sm">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors mb-1
                                    ${activeTab === tab.id
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                                `}
                            >
                                <span>{tab.icon}</span>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* ==================== GENERAL ==================== */}
                    {activeTab === 'general' && (
                        <div>
                            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                <h2 className="text-lg font-bold text-gray-900 mb-4">Cài đặt chung</h2>

                                <Toggle
                                    checked={allowNegativeStock}
                                    onChange={setAllowNegativeStock}
                                    label="Cho phép bán khi hết hàng (tồn kho âm)"
                                />

                                <div className="border-t border-gray-100 mt-4 pt-4">
                                    <h3 className="text-base font-semibold mb-3">Thông tin cửa hàng</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Tên cửa hàng</label>
                                            <input
                                                type="text"
                                                value={receipt.storeName}
                                                onChange={(e) => updateReceipt({ storeName: e.target.value })}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Số điện thoại</label>
                                            <input
                                                type="text"
                                                value={receipt.storePhone}
                                                onChange={(e) => updateReceipt({ storePhone: e.target.value })}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                            />
                                        </div>
                                        <div className="col-span-1 md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Địa chỉ</label>
                                            <input
                                                type="text"
                                                value={receipt.storeAddress}
                                                onChange={(e) => updateReceipt({ storeAddress: e.target.value })}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==================== BRAND ==================== */}
                    {activeTab === 'brand' && (
                        <BrandSettingsTab />
                    )}

                    {/* ==================== DOMAIN ==================== */}
                    {activeTab === 'domain' && (
                        <DomainSettings />
                    )}

                    {/* ==================== PROMOTIONS ==================== */}
                    {activeTab === 'promotions' && (
                        <div>
                            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 mb-1">Quản lý Khuyến mãi</h2>
                                        <p className="text-sm text-gray-500 m-0">Tạo và quản lý các chương trình khuyến mãi</p>
                                    </div>
                                    <button
                                        className="px-5 py-2.5 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                                        onClick={() => { setEditingPromo(null); setShowPromoModal(true); }}
                                    >
                                        + Thêm khuyến mãi
                                    </button>
                                </div>

                                <div className="border-b border-gray-200 mb-4 pb-4">
                                    <Toggle
                                        checked={promotionSettings.stackable}
                                        onChange={(v) => updatePromotionSettings({ stackable: v })}
                                        label="Cho phép áp dụng nhiều khuyến mãi cùng lúc"
                                    />
                                </div>

                                {/* Promotions List */}
                                {promotionSettings.promotions.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400">
                                        <div className="text-5xl mb-4">🎉</div>
                                        <p>Chưa có khuyến mãi nào. Bấm "Thêm khuyến mãi" để tạo mới.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {promotionSettings.promotions.map((promo) => {
                                            const isActive = promo.active && new Date(promo.startDate) <= new Date() && new Date(promo.endDate) >= new Date();
                                            return (
                                                <div key={promo.id} className={`p-4 border rounded-xl transition-colors ${isActive ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-200'}`}>
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-semibold text-base">{promo.name}</span>
                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                                                    {isActive ? '● Đang chạy' : '○ Tạm dừng'}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {promoTypeLabels[promo.type]} • {promo.startDate} → {promo.endDate}
                                                            </div>
                                                            {promo.type === 'percentage' && (
                                                                <div className="text-sm text-green-600 font-semibold mt-1">
                                                                    Giảm {promo.discountValue}%
                                                                </div>
                                                            )}
                                                            {promo.type === 'fixed_amount' && (
                                                                <div className="text-sm text-green-600 font-semibold mt-1">
                                                                    Giảm {formatVND(promo.discountValue || 0)}
                                                                </div>
                                                            )}
                                                            {promo.type === 'buy_x_get_y' && (
                                                                <div className="text-sm text-green-600 font-semibold mt-1">
                                                                    Mua {promo.buyQuantity} tặng {promo.getQuantity}
                                                                </div>
                                                            )}
                                                            {promo.couponCode && (
                                                                <div className="text-xs text-gray-400 mt-1">
                                                                    Mã: <code className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-600 font-mono">{promo.couponCode}</code>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                className="px-3 py-1.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                                                                onClick={() => updatePromotion(promo.id, { active: !promo.active })}
                                                            >
                                                                {promo.active ? 'Tắt' : 'Bật'}
                                                            </button>
                                                            <button
                                                                className="px-3 py-1.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                                                                onClick={() => { setEditingPromo(promo); setShowPromoModal(true); }}
                                                            >
                                                                Sửa
                                                            </button>
                                                            <button
                                                                className="px-3 py-1.5 bg-gray-100 text-red-600 border border-gray-200 rounded-lg text-xs font-medium hover:bg-red-50 hover:border-red-200 transition-colors"
                                                                onClick={() => deletePromotion(promo.id)}
                                                            >
                                                                Xóa
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Promotion Types Info */}
                            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                <h3 className="text-base font-semibold mb-4">💡 Các loại khuyến mãi</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                    {[
                                        { icon: '🏷️', name: '% Giảm giá', desc: 'Giảm X% trên tổng đơn' },
                                        { icon: '💰', name: 'Giảm cố định', desc: 'Giảm số tiền cố định' },
                                        { icon: '🎁', name: 'Mua X tặng Y', desc: 'Mua 2 tặng 1, v.v.' },
                                        { icon: '📦', name: 'Combo', desc: 'Gói sản phẩm giá ưu đãi' },
                                        { icon: '⏰', name: 'Happy Hour', desc: 'Giảm giá theo khung giờ' },
                                    ].map((type) => (
                                        <div key={type.name} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                            <div className="text-xl mb-1">{type.icon}</div>
                                            <div className="font-semibold text-sm text-gray-900">{type.name}</div>
                                            <div className="text-xs text-gray-500">{type.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==================== EXPIRY DATE ==================== */}
                    {activeTab === 'expiry' && (
                        <div>
                            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                <h2 className="text-lg font-bold text-gray-900 mb-4">Quản lý Hạn sử dụng</h2>

                                <Toggle
                                    checked={expiry.enabled}
                                    onChange={(v) => updateExpiry({ enabled: v })}
                                    label="Bật theo dõi hạn sử dụng sản phẩm"
                                />

                                {expiry.enabled && (
                                    <div className="border-t border-gray-100 mt-4 pt-4">
                                        <Toggle
                                            checked={expiry.blockSaleOnExpiry}
                                            onChange={(v) => updateExpiry({ blockSaleOnExpiry: v })}
                                            label="Chặn bán sản phẩm đã hết hạn"
                                        />
                                        <Toggle
                                            checked={expiry.showExpiryOnReceipt}
                                            onChange={(v) => updateExpiry({ showExpiryOnReceipt: v })}
                                            label="Hiển thị HSD trên hóa đơn"
                                        />

                                        <div className="mt-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Cảnh báo trước khi hết hạn (ngày)</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {[7, 14, 30, 60, 90].map((day) => (
                                                    <button
                                                        key={day}
                                                        className={`px-4 py-2 rounded-lg text-sm transition-all ${expiry.alertDays.includes(day)
                                                            ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-500 font-semibold'
                                                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                                            }`}
                                                        onClick={() => {
                                                            const newDays = expiry.alertDays.includes(day)
                                                                ? expiry.alertDays.filter(d => d !== day)
                                                                : [...expiry.alertDays, day].sort((a, b) => a - b);
                                                            updateExpiry({ alertDays: newDays });
                                                        }}
                                                    >
                                                        {day} ngày
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Auto Markdown */}
                            {expiry.enabled && (
                                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                    <h3 className="text-base font-semibold mb-4">Tự động giảm giá sản phẩm sắp hết hạn</h3>

                                    <Toggle
                                        checked={expiry.autoMarkdownEnabled}
                                        onChange={(v) => updateExpiry({ autoMarkdownEnabled: v })}
                                        label="Bật auto markdown"
                                    />

                                    {expiry.autoMarkdownEnabled && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Áp dụng trước HSD (ngày)</label>
                                                <input
                                                    type="number"
                                                    value={expiry.autoMarkdownDays}
                                                    onChange={(e) => updateExpiry({ autoMarkdownDays: Number(e.target.value) })}
                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Phần trăm giảm giá (%)</label>
                                                <input
                                                    type="number"
                                                    value={expiry.autoMarkdownPercent}
                                                    onChange={(e) => updateExpiry({ autoMarkdownPercent: Number(e.target.value) })}
                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800 border border-yellow-100">
                                        <strong>💡 Ví dụ:</strong> Sản phẩm còn {expiry.autoMarkdownDays} ngày trước HSD sẽ tự động giảm {expiry.autoMarkdownPercent}%
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ==================== SHIFT SETTINGS ==================== */}
                    {activeTab === 'shift' && (
                        <div>
                            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                <h2 className="text-lg font-bold text-gray-900 mb-1">Cài đặt Ca làm việc</h2>
                                <p className="text-sm text-gray-500 mb-5">
                                    Cấu hình cách thức vào ca và kết ca
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div
                                        className={`p-4 rounded-xl cursor-pointer transition-all border ${tempShiftMode === 'auto'
                                            ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500'
                                            : 'bg-white border-gray-200 hover:border-emerald-300'
                                            }`}
                                        onClick={() => setTempShiftMode('auto')}
                                    >
                                        <div className="font-semibold text-gray-900 mb-1">⚡ Vào ca Tự động</div>
                                        <div className="text-sm text-gray-500">
                                            Hệ thống tự động ghi nhận thời gian thực khi ấn "Vào ca". Không thể chỉnh sửa giờ vào ca.
                                        </div>
                                    </div>

                                    <div
                                        className={`p-4 rounded-xl cursor-pointer transition-all border ${tempShiftMode === 'manual'
                                            ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500'
                                            : 'bg-white border-gray-200 hover:border-emerald-300'
                                            }`}
                                        onClick={() => setTempShiftMode('manual')}
                                    >
                                        <div className="font-semibold text-gray-900 mb-1">🕒 Vào ca Thủ công</div>
                                        <div className="text-sm text-gray-500">
                                            Cho phép chọn giờ vào ca và kết ca thủ công. Phù hợp khi cần nhập liệu lại cho ca trước.
                                        </div>
                                    </div>
                                </div>

                                {/* Visibility Settings */}
                                <div className="border-t border-gray-100 mt-5 pt-5">
                                    <h3 className="text-base font-semibold mb-3">📊 Hiển thị khi kết ca</h3>

                                    <Toggle
                                        checked={shift?.showDiscrepancyInReconciliation ?? true}
                                        onChange={(v) => updateShiftSettings({ showDiscrepancyInReconciliation: v })}
                                        label="Cho phép xem chênh lệch (thừa/thiếu)"
                                    />
                                    <p className="text-xs text-gray-400 mt-1 mb-3 pl-1">
                                        Khi tắt, nhân viên không thấy phần đối soát chênh lệch khi kết ca.
                                    </p>

                                    <Toggle
                                        checked={shift?.showRevenueInReconciliation ?? true}
                                        onChange={(v) => updateShiftSettings({ showRevenueInReconciliation: v })}
                                        label="Cho phép xem doanh thu trong ca"
                                    />
                                    <p className="text-xs text-gray-400 mt-1 pl-1">
                                        Khi tắt, nhân viên không thấy doanh số bán hàng trong ca. Chênh lệch vẫn có thể ẩn riêng.
                                    </p>
                                </div>

                                <div className="mt-6 text-right">
                                    <button
                                        onClick={() => {
                                            updateShiftSettings({ mode: tempShiftMode });
                                            setSaveSuccess(true);
                                            setTimeout(() => setSaveSuccess(false), 2000);
                                        }}
                                        className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-white transition-all ${saveSuccess ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'
                                            }`}
                                    >
                                        {saveSuccess ? (
                                            <>
                                                <span>✓</span>
                                                Đã lưu thành công
                                            </>
                                        ) : (
                                            'Lưu thay đổi'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==================== STOCK ALERTS ==================== */}
                    {activeTab === 'stock' && (
                        <div>
                            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                <h2 className="text-lg font-bold text-gray-900 mb-4">Cảnh báo Tồn kho</h2>

                                <Toggle
                                    checked={stockAlerts.enabled}
                                    onChange={(v) => updateStockAlerts({ enabled: v })}
                                    label="Bật cảnh báo tồn kho thấp"
                                />

                                {stockAlerts.enabled && (
                                    <div className="border-t border-gray-100 mt-4 pt-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Ngưỡng tồn kho thấp (mặc định)</label>
                                                <input
                                                    type="number"
                                                    value={stockAlerts.lowStockThreshold}
                                                    onChange={(e) => updateStockAlerts({ lowStockThreshold: Number(e.target.value) })}
                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                />
                                                <p className="text-xs text-gray-400 mt-1">
                                                    Cảnh báo khi số lượng ≤ {stockAlerts.lowStockThreshold}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Ngưỡng tồn kho nghiêm trọng</label>
                                                <input
                                                    type="number"
                                                    value={stockAlerts.criticalStockThreshold}
                                                    onChange={(e) => updateStockAlerts({ criticalStockThreshold: Number(e.target.value) })}
                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                />
                                                <p className="text-xs text-red-500 mt-1">
                                                    ⚠️ Cảnh báo đỏ khi số lượng ≤ {stockAlerts.criticalStockThreshold}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 space-y-1">
                                            <Toggle
                                                checked={stockAlerts.showOnDashboard}
                                                onChange={(v) => updateStockAlerts({ showOnDashboard: v })}
                                                label="Hiển thị cảnh báo trên Dashboard"
                                            />
                                            <Toggle
                                                checked={stockAlerts.emailNotification}
                                                onChange={(v) => updateStockAlerts({ emailNotification: v })}
                                                label="Gửi email khi tồn kho thấp"
                                            />
                                            <Toggle
                                                checked={stockAlerts.autoReorderEnabled}
                                                onChange={(v) => updateStockAlerts({ autoReorderEnabled: v })}
                                                label="Tự động tạo đơn nhập hàng"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Stock Alert Preview */}
                            {stockAlerts.enabled && (
                                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                    <h3 className="text-base font-semibold mb-4">👁️ Xem trước mức cảnh báo</h3>
                                    <div className="flex flex-col md:flex-row gap-4">
                                        <div className="flex-1 p-4 bg-red-50 rounded-lg border-l-4 border-red-600">
                                            <div className="font-semibold text-red-600">🔴 Nghiêm trọng</div>
                                            <div className="text-2xl font-bold text-red-600">≤ {stockAlerts.criticalStockThreshold}</div>
                                            <div className="text-xs text-red-800">Cần nhập hàng ngay</div>
                                        </div>
                                        <div className="flex-1 p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-600">
                                            <div className="font-semibold text-yellow-600">🟡 Thấp</div>
                                            <div className="text-2xl font-bold text-yellow-600">≤ {stockAlerts.lowStockThreshold}</div>
                                            <div className="text-xs text-yellow-800">Nên nhập thêm hàng</div>
                                        </div>
                                        <div className="flex-1 p-4 bg-green-50 rounded-lg border-l-4 border-green-600">
                                            <div className="font-semibold text-green-600">🟢 Đủ hàng</div>
                                            <div className="text-2xl font-bold text-green-600">&gt; {stockAlerts.lowStockThreshold}</div>
                                            <div className="text-xs text-green-800">Tồn kho ổn định</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ==================== NOTIFICATIONS ==================== */}
                    {activeTab === 'notifications' && (
                        <div>
                            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                <h2 className="text-lg font-bold text-gray-900 mb-2">Cài đặt Thông báo</h2>
                                <p className="text-sm text-gray-500 mb-5">Gửi tin nhắn SMS và Email tự động cho khách hàng</p>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* SMS Settings */}
                                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                        <h3 className="text-base font-semibold mb-3">📱 SMS</h3>
                                        <Toggle
                                            checked={notifications.smsEnabled}
                                            onChange={(v) => updateNotifications({ smsEnabled: v })}
                                            label="Bật gửi SMS"
                                        />
                                        {notifications.smsEnabled && (
                                            <div className="mt-3 space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nhà cung cấp SMS</label>
                                                    <select
                                                        value={notifications.smsProvider}
                                                        onChange={(e) => updateNotifications({ smsProvider: e.target.value as 'esms' | 'speedsms' | 'fpt' | 'none' })}
                                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                    >
                                                        <option value="none">-- Chọn --</option>
                                                        <option value="esms">eSMS.vn</option>
                                                        <option value="speedsms">SpeedSMS</option>
                                                        <option value="fpt">FPT SMS</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                                                    <input
                                                        type="password"
                                                        value={notifications.smsApiKey || ''}
                                                        onChange={(e) => updateNotifications({ smsApiKey: e.target.value })}
                                                        placeholder="Nhập API Key..."
                                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Sender ID (Brandname)</label>
                                                    <input
                                                        type="text"
                                                        value={notifications.smsSenderId || ''}
                                                        onChange={(e) => updateNotifications({ smsSenderId: e.target.value })}
                                                        placeholder="VD: MYSHOP"
                                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Email Settings */}
                                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                        <h3 className="text-base font-semibold mb-3">📧 Email</h3>
                                        <Toggle
                                            checked={notifications.emailEnabled}
                                            onChange={(v) => updateNotifications({ emailEnabled: v })}
                                            label="Bật gửi Email"
                                        />
                                        {notifications.emailEnabled && (
                                            <div className="mt-3 space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nhà cung cấp Email</label>
                                                    <select
                                                        value={notifications.emailProvider}
                                                        onChange={(e) => updateNotifications({ emailProvider: e.target.value as 'gmail' | 'sendgrid' | 'mailgun' | 'none' })}
                                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                    >
                                                        <option value="none">-- Chọn --</option>
                                                        <option value="gmail">Gmail SMTP</option>
                                                        <option value="sendgrid">SendGrid</option>
                                                        <option value="mailgun">Mailgun</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key / App Password</label>
                                                    <input
                                                        type="password"
                                                        value={notifications.emailApiKey || ''}
                                                        onChange={(e) => updateNotifications({ emailApiKey: e.target.value })}
                                                        placeholder="Nhập API Key..."
                                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ Email gửi</label>
                                                    <input
                                                        type="email"
                                                        value={notifications.emailFrom || ''}
                                                        onChange={(e) => updateNotifications({ emailFrom: e.target.value })}
                                                        placeholder="no-reply@yourshop.com"
                                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Notification Types */}
                            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                <h3 className="text-base font-semibold mb-4">Loại thông báo</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Toggle checked={notifications.orderConfirmation} onChange={(v) => updateNotifications({ orderConfirmation: v })} label="Xác nhận đơn hàng" />
                                    <Toggle checked={notifications.shippingUpdate} onChange={(v) => updateNotifications({ shippingUpdate: v })} label="Cập nhật giao hàng" />
                                    <Toggle checked={notifications.birthdayWish} onChange={(v) => updateNotifications({ birthdayWish: v })} label="Chúc mừng sinh nhật" />
                                    <Toggle checked={notifications.loyaltyReminder} onChange={(v) => updateNotifications({ loyaltyReminder: v })} label="Nhắc điểm tích lũy" />
                                    <Toggle checked={notifications.debtReminder} onChange={(v) => updateNotifications({ debtReminder: v })} label="Nhắc công nợ" />
                                    <Toggle checked={notifications.promotionBlast} onChange={(v) => updateNotifications({ promotionBlast: v })} label="Thông báo khuyến mãi" />
                                </div>
                            </div>

                            {/* Message Templates */}
                            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                <h3 className="text-base font-semibold mb-4">Mẫu tin nhắn</h3>
                                <p className="text-xs text-gray-500 mb-4 bg-blue-50 p-2 rounded border border-blue-100">
                                    Sử dụng biến: <code className="text-blue-700">{'{customer_name}'}</code>, <code className="text-blue-700">{'{order_number}'}</code>, <code className="text-blue-700">{'{total}'}</code>, <code className="text-blue-700">{'{store_name}'}</code>, <code className="text-blue-700">{'{coupon_code}'}</code>, <code className="text-blue-700">{'{debt_amount}'}</code>, <code className="text-blue-700">{'{due_date}'}</code>
                                </p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận đơn hàng</label>
                                        <textarea
                                            value={notifications.templates.orderConfirmation}
                                            onChange={(e) => updateNotifications({ templates: { ...notifications.templates, orderConfirmation: e.target.value } })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[80px]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Sinh nhật</label>
                                        <textarea
                                            value={notifications.templates.birthdayWish}
                                            onChange={(e) => updateNotifications({ templates: { ...notifications.templates, birthdayWish: e.target.value } })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[80px]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nhắc công nợ</label>
                                        <textarea
                                            value={notifications.templates.debtReminder}
                                            onChange={(e) => updateNotifications({ templates: { ...notifications.templates, debtReminder: e.target.value } })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[80px]"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==================== DEBT MANAGEMENT ==================== */}
                    {activeTab === 'debt' && (
                        <div>
                            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                <h2 className="text-lg font-bold text-gray-900 mb-2">Quản lý Công nợ</h2>
                                <p className="text-sm text-gray-500 mb-5">Cài đặt hạn mức tín dụng và chính sách công nợ cho khách hàng</p>

                                <Toggle
                                    checked={debt.enabled}
                                    onChange={(v) => updateDebt({ enabled: v })}
                                    label="Bật quản lý công nợ nâng cao"
                                />

                                {debt.enabled && (
                                    <div className="border-t border-gray-100 mt-4 pt-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Hạn mức mặc định (VNĐ)</label>
                                                <input
                                                    type="number"
                                                    value={debt.defaultCreditLimit}
                                                    onChange={(e) => updateDebt({ defaultCreditLimit: Number(e.target.value) })}
                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                />
                                                <p className="text-xs text-gray-400 mt-1">
                                                    = {formatVND(debt.defaultCreditLimit)}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Hạn mức tối đa (VNĐ)</label>
                                                <input
                                                    type="number"
                                                    value={debt.maxCreditLimit}
                                                    onChange={(e) => updateDebt({ maxCreditLimit: Number(e.target.value) })}
                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                />
                                                <p className="text-xs text-gray-400 mt-1">
                                                    = {formatVND(debt.maxCreditLimit)}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Cảnh báo khi đạt (%)</label>
                                                <input
                                                    type="number"
                                                    value={debt.warningThreshold}
                                                    onChange={(e) => updateDebt({ warningThreshold: Number(e.target.value) })}
                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                />
                                                <p className="text-xs text-yellow-600 mt-1">
                                                    ⚠️ Cảnh báo khi nợ ≥ {debt.warningThreshold}% hạn mức
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <Toggle
                                                checked={debt.blockSaleOnOverLimit}
                                                onChange={(v) => updateDebt({ blockSaleOnOverLimit: v })}
                                                label="Chặn bán khi vượt hạn mức"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Overdue Settings */}
                            {debt.enabled && (
                                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                    <h3 className="text-base font-semibold mb-4">Quản lý Nợ quá hạn</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Số ngày tính quá hạn</label>
                                            <input
                                                type="number"
                                                value={debt.overdueDays}
                                                onChange={(e) => updateDebt({ overdueDays: Number(e.target.value) })}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                            />
                                            <p className="text-xs text-gray-400 mt-1">
                                                Nợ quá {debt.overdueDays} ngày sẽ tính là quá hạn
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Lãi suất quá hạn (%/tháng)</label>
                                            <input
                                                type="number"
                                                value={debt.interestRate}
                                                onChange={(e) => updateDebt({ interestRate: Number(e.target.value) })}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all disabled:bg-gray-50 disabled:text-gray-400"
                                                disabled={!debt.applyInterest}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-2">
                                        <Toggle
                                            checked={debt.applyInterest}
                                            onChange={(v) => updateDebt({ applyInterest: v })}
                                            label="Áp dụng lãi suất cho nợ quá hạn"
                                        />
                                        <Toggle
                                            checked={debt.sendOverdueReminder}
                                            onChange={(v) => updateDebt({ sendOverdueReminder: v })}
                                            label="Gửi nhắc nhở tự động khi sắp/quá hạn"
                                        />
                                    </div>

                                    {debt.sendOverdueReminder && (
                                        <div className="mt-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Ngày gửi nhắc nhở (so với hạn thanh toán)</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {[-7, -3, 0, 3, 7, 14, 30].map((day) => (
                                                    <button
                                                        key={day}
                                                        className={`px-3 py-2 rounded-lg text-sm transition-all ${debt.reminderDays.includes(day)
                                                            ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-500 font-semibold'
                                                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                                            }`}
                                                        onClick={() => {
                                                            const newDays = debt.reminderDays.includes(day)
                                                                ? debt.reminderDays.filter(d => d !== day)
                                                                : [...debt.reminderDays, day].sort((a, b) => a - b);
                                                            updateDebt({ reminderDays: newDays });
                                                        }}
                                                    >
                                                        {day < 0 ? `${Math.abs(day)} ngày trước` : day === 0 ? 'Ngày đến hạn' : `${day} ngày sau`}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Debt Preview */}
                            {debt.enabled && (
                                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                    <h3 className="text-base font-semibold mb-4">📊 Ví dụ minh họa</h3>
                                    <div className="bg-gray-50 p-4 rounded-xl text-sm border border-gray-100">
                                        <p className="mb-2">
                                            <strong>Khách hàng A</strong> có hạn mức: <span className="text-green-600 font-bold">{formatVND(debt.defaultCreditLimit)}</span>
                                        </p>
                                        <p className="mb-2">
                                            Hiện đang nợ: {formatVND(debt.defaultCreditLimit * 0.85)} ({85}% hạn mức)
                                            <span className="text-red-600 font-bold ml-2">⚠️ Cảnh báo</span>
                                        </p>
                                        <p>
                                            Nợ quá {debt.overdueDays} ngày {debt.applyInterest ? `+ lãi ${debt.interestRate}%/tháng` : ''}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ==================== LOYALTY ==================== */}
                    {activeTab === 'loyalty' && (
                        <div>
                            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                <h2 className="text-lg font-bold text-gray-900 mb-4">Tích điểm khách hàng</h2>
                                <Toggle checked={loyalty.enabled} onChange={(v) => updateLoyalty({ enabled: v })} label="Bật tính năng tích điểm" />
                                {loyalty.enabled && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-100">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">VNĐ/1 điểm</label>
                                            <input
                                                type="number"
                                                value={loyalty.pointsPerAmount}
                                                onChange={(e) => updateLoyalty({ pointsPerAmount: Number(e.target.value) })}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">1 điểm = VNĐ</label>
                                            <input
                                                type="number"
                                                value={loyalty.redemptionRate}
                                                onChange={(e) => updateLoyalty({ redemptionRate: Number(e.target.value) })}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Tối thiểu để đổi</label>
                                            <input
                                                type="number"
                                                value={loyalty.minPointsToRedeem}
                                                onChange={(e) => updateLoyalty({ minPointsToRedeem: Number(e.target.value) })}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ==================== PAYMENT ==================== */}
                    {activeTab === 'payment' && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Phương thức thanh toán</h2>
                            <div className="flex flex-col gap-3">
                                {paymentMethods.map((method) => (
                                    <div key={method.id} className={`flex items-center justify-between p-4 border rounded-xl transition-all ${method.enabled ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{method.icon}</span>
                                            <span className="font-semibold text-gray-900">{method.name}</span>
                                        </div>
                                        <Toggle checked={method.enabled} onChange={(v) => updatePaymentMethod(method.id, { enabled: v })} label="" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ==================== RECEIPT ==================== */}
                    {activeTab === 'receipt' && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Cài đặt hóa đơn</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên cửa hàng</label>
                                    <input
                                        type="text"
                                        value={receipt.storeName}
                                        onChange={(e) => updateReceipt({ storeName: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                                    <input
                                        type="text"
                                        value={receipt.storePhone}
                                        onChange={(e) => updateReceipt({ storePhone: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                                    <input
                                        type="text"
                                        value={receipt.storeAddress}
                                        onChange={(e) => updateReceipt({ storeAddress: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Lời cảm ơn</label>
                                    <input
                                        type="text"
                                        value={receipt.footerText}
                                        onChange={(e) => updateReceipt({ footerText: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Khổ giấy</label>
                                    <select
                                        value={receipt.paperWidth}
                                        onChange={(e) => updateReceipt({ paperWidth: e.target.value as '58mm' | '80mm' })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                    >
                                        <option value="58mm">58mm</option>
                                        <option value="80mm">80mm</option>
                                    </select>
                                </div>
                                <div className="pt-7">
                                    <Toggle checked={receipt.showQRCode} onChange={(v) => updateReceipt({ showQRCode: v })} label="Hiển thị QR" />
                                </div>
                            </div>
                        </div>
                    )}


                    {/* ==================== PERMISSIONS ==================== */}
                    {activeTab === 'permissions' && (
                        <BrandPermissionsTab />
                    )}

                    {/* ==================== PRINT ==================== */}
                    {activeTab === 'print' && (
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
                            {/* LEFT COLUMN - Settings */}
                            <div>
                                {/* Store Info with Logo Upload */}
                                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                    <h2 className="text-lg font-bold text-gray-900 mb-4">🏪 Thông tin cửa hàng</h2>

                                    {/* Logo Upload */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Logo cửa hàng</label>
                                        <div className="flex items-center gap-4">
                                            <div className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center bg-gray-50 overflow-hidden">
                                                {printSettings.storeLogo ? (
                                                    <img src={printSettings.storeLogo} alt="Logo" className="w-full h-full object-contain" />
                                                ) : (
                                                    <span className="text-3xl opacity-30">🏪</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <input
                                                    ref={logoInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onload = (ev) => {
                                                                updatePrintSettings({ storeLogo: ev.target?.result as string });
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }}
                                                />
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => logoInputRef.current?.click()}
                                                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-1"
                                                    >
                                                        📤 Tải logo lên
                                                    </button>
                                                    {printSettings.storeLogo && (
                                                        <button
                                                            onClick={() => updatePrintSettings({ storeLogo: undefined })}
                                                            className="px-3 py-1.5 rounded-lg border border-red-200 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-all flex items-center gap-1"
                                                        >
                                                            🗑️ Xóa
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-400">PNG/JPG, tối đa 500KB</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Tên cửa hàng</label>
                                            <input type="text" value={printSettings.storeName} onChange={(e) => updatePrintSettings({ storeName: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                                            <input type="text" value={printSettings.storePhone} onChange={(e) => updatePrintSettings({ storePhone: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                                            <input type="text" value={printSettings.storeAddress} onChange={(e) => updatePrintSettings({ storeAddress: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Lời cảm ơn</label>
                                            <input type="text" value={printSettings.footerText} onChange={(e) => updatePrintSettings({ footerText: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Lưu ý (dưới lời cảm ơn)</label>
                                            <input type="text" value={printSettings.noteText || ''} onChange={(e) => updatePrintSettings({ noteText: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" placeholder="VD: Hàng đã mua không đổi/trả..." />
                                        </div>
                                    </div>
                                </div>

                                {/* Printer Connection */}
                                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                    <h2 className="text-lg font-bold text-gray-900 mb-3">🖨️ Kết nối Máy in</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {[
                                            { method: 'driver' as const, icon: '💻', name: 'Driver', desc: 'Máy in đã cài driver' },
                                            { method: 'usb' as const, icon: '🔌', name: 'USB', desc: 'WebUSB trực tiếp' },
                                            { method: 'lan' as const, icon: '🌐', name: 'LAN', desc: 'Mạng nội bộ' },
                                        ].map((p) => (
                                            <div
                                                key={p.method}
                                                onClick={() => updatePrinter({ method: p.method })}
                                                className={`p-3 rounded-xl border cursor-pointer text-center transition-all ${printSettings.printer.method === p.method
                                                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                                                    : 'bg-white border-gray-200 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <div className="text-xl mb-1">{p.icon}</div>
                                                <div className="text-sm font-semibold text-gray-900">{p.name}</div>
                                                <div className="text-xs text-gray-500">{p.desc}</div>
                                            </div>
                                        ))}
                                    </div>
                                    {printSettings.printer.method === 'lan' && (
                                        <div className="mt-3">
                                            <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-2 mb-2">
                                                <input
                                                    type="text"
                                                    placeholder="IP: 192.168.1.200"
                                                    value={printSettings.printer.lanIp}
                                                    onChange={(e) => updatePrinter({ lanIp: e.target.value })}
                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Port: 9100"
                                                    value={printSettings.printer.lanPort}
                                                    onChange={(e) => updatePrinter({ lanPort: e.target.value })}
                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        alert(`Đang kết nối tới ${printSettings.printer.lanIp}:${printSettings.printer.lanPort}...`);
                                                        // TODO: Implement actual LAN connection test
                                                    }}
                                                    className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-all text-sm"
                                                >
                                                    🔗 Kết nối
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await testPrint(printSettings);
                                                            alert('✅ Đã gửi lệnh in thử!');
                                                        } catch (err) {
                                                            alert('❌ Lỗi: ' + (err as Error).message);
                                                        }
                                                    }}
                                                    className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-all text-sm"
                                                >
                                                    🖨️ In thử
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Template Selector */}
                                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                    <h2 className="text-lg font-bold text-gray-900 mb-3">📋 Chọn mẫu phiếu để cấu hình</h2>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {[
                                            { key: 'sales_receipt' as PrintTemplateType, icon: '🧾', name: 'Hóa đơn' },
                                            { key: 'cash_voucher' as PrintTemplateType, icon: '💵', name: 'Phiếu chi' },
                                            { key: 'purchase_receipt' as PrintTemplateType, icon: '📥', name: 'Nhập hàng' },
                                            { key: 'stock_check' as PrintTemplateType, icon: '📊', name: 'Kiểm kho' },
                                            { key: 'return_receipt' as PrintTemplateType, icon: '↩️', name: 'Đổi/trả' },
                                            { key: 'order_form' as PrintTemplateType, icon: '📝', name: 'Đặt hàng' },
                                            { key: 'transfer_receipt' as PrintTemplateType, icon: '🔄', name: 'Chuyển kho' },
                                            { key: 'supplier_return' as PrintTemplateType, icon: '📤', name: 'Trả NCC' },
                                            { key: 'barcode_label' as PrintTemplateType, icon: '🏷️', name: 'Tem Mã Vạch' },
                                        ].map((t) => (
                                            <div
                                                key={t.key}
                                                onClick={() => setSelectedTemplate(t.key)}
                                                className={`p-2.5 rounded-xl border cursor-pointer text-center transition-all ${selectedTemplate === t.key
                                                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                                    }`}
                                            >
                                                <div className="text-lg">{t.icon}</div>
                                                <div className="text-[11px] font-semibold mt-0.5">{t.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Template Config based on selection */}
                                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                    <h2 className="text-lg font-bold text-gray-900 mb-3">
                                        ⚙️ Cấu hình: {selectedTemplate === 'sales_receipt' ? 'Hóa đơn bán hàng' :
                                            selectedTemplate === 'cash_voucher' ? 'Phiếu chi' :
                                                selectedTemplate === 'purchase_receipt' ? 'Phiếu nhập hàng' :
                                                    selectedTemplate === 'barcode_label' ? 'Tem mã vạch' : selectedTemplate}
                                    </h2>
                                    {/* Barcode Label Config UI */}
                                    {selectedTemplate === 'barcode_label' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Khổ giấy (mm)</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        value={labelConfig.paperWidth}
                                                        onChange={(e) => updateLabelConfig({ paperWidth: Number(e.target.value) })}
                                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                        placeholder="Rộng"
                                                    />
                                                    <input
                                                        type="number"
                                                        value={labelConfig.labelHeight}
                                                        onChange={(e) => updateLabelConfig({ labelHeight: Number(e.target.value) })}
                                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                        placeholder="Cao"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Cỡ chữ (px)</label>
                                                <input
                                                    type="number"
                                                    value={labelConfig.fontSize}
                                                    onChange={(e) => updateLabelConfig({ fontSize: Number(e.target.value) })}
                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Số cột tem (ngang)</label>
                                                <select
                                                    value={labelConfig.cols}
                                                    onChange={(e) => updateLabelConfig({ cols: Number(e.target.value) as 1 | 2 | 3 })}
                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                >
                                                    <option value={1}>1 Tem/Hàng</option>
                                                    <option value={2}>2 Tem/Hàng</option>
                                                    <option value={3}>3 Tem/Hàng</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Căn lề</label>
                                                <select
                                                    value={labelConfig.textAlign}
                                                    onChange={(e) => updateLabelConfig({ textAlign: e.target.value as 'center' | 'left' })}
                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                >
                                                    <option value="center">Giữa</option>
                                                    <option value="left">Trái</option>
                                                </select>
                                            </div>
                                            <div className="md:col-span-2 mt-2">
                                                <div className="flex gap-4 flex-wrap">
                                                    <Toggle
                                                        checked={labelConfig.showShopName}
                                                        onChange={(v) => updateLabelConfig({ showShopName: v })}
                                                        label="Tên cửa hàng"
                                                    />
                                                    <Toggle
                                                        checked={labelConfig.showProductName}
                                                        onChange={(v) => updateLabelConfig({ showProductName: v })}
                                                        label="Tên sản phẩm"
                                                    />
                                                    <Toggle
                                                        checked={labelConfig.showBarcode}
                                                        onChange={(v) => updateLabelConfig({ showBarcode: v })}
                                                        label="Mã vạch"
                                                    />
                                                    <Toggle
                                                        checked={labelConfig.showPrice}
                                                        onChange={(v) => updateLabelConfig({ showPrice: v })}
                                                        label="Giá bán"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Standard Template Config UI */
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Khổ giấy</label>
                                                    <select
                                                        value={printSettings.templates[selectedTemplate]?.paperWidth || '80mm'}
                                                        onChange={(e) => updatePrintTemplate(selectedTemplate, { paperWidth: e.target.value as any })}
                                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                    >
                                                        <option value="58mm">K57 (58mm)</option>
                                                        <option value="80mm">K80 (80mm)</option>
                                                        <option value="A5">A5</option>
                                                        <option value="A4">A4</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Số bản in</label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={5}
                                                        value={printSettings.templates[selectedTemplate]?.copies || 1}
                                                        onChange={(e) => updatePrintTemplate(selectedTemplate, { copies: Number(e.target.value) })}
                                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                                                <Toggle
                                                    checked={printSettings.templates[selectedTemplate]?.enabled ?? true}
                                                    onChange={(v) => updatePrintTemplate(selectedTemplate, { enabled: v })}
                                                    label="Bật mẫu phiếu này"
                                                />
                                                <Toggle
                                                    checked={printSettings.templates[selectedTemplate]?.autoPrint ?? false}
                                                    onChange={(v) => updatePrintTemplate(selectedTemplate, { autoPrint: v })}
                                                    label="Tự động in"
                                                />
                                                <Toggle
                                                    checked={printSettings.templates[selectedTemplate]?.showLogo ?? true}
                                                    onChange={(v) => updatePrintTemplate(selectedTemplate, { showLogo: v })}
                                                    label="Hiển thị logo"
                                                />
                                                <Toggle
                                                    checked={printSettings.templates[selectedTemplate]?.showBarcode ?? true}
                                                    onChange={(v) => updatePrintTemplate(selectedTemplate, { showBarcode: v })}
                                                    label="Hiển thị mã vạch"
                                                />
                                            </div>
                                            {/* Sales Receipt specific toggles */}
                                            {selectedTemplate === 'sales_receipt' && (
                                                <div className="mt-3 border-t border-gray-100 pt-3">
                                                    <div className="flex flex-wrap gap-x-6 gap-y-2 mb-3">
                                                        <Toggle
                                                            checked={(printSettings.templates.sales_receipt as any)?.showStoreName ?? true}
                                                            onChange={(v) => updatePrintTemplate('sales_receipt', { showStoreName: v } as any)}
                                                            label="Tên cửa hàng"
                                                        />
                                                        <Toggle
                                                            checked={(printSettings.templates.sales_receipt as any)?.showPrice ?? true}
                                                            onChange={(v) => updatePrintTemplate('sales_receipt', { showPrice: v } as any)}
                                                            label="Giá sản phẩm"
                                                        />
                                                        <Toggle
                                                            checked={printSettings.templates.sales_receipt?.showCustomerInfo ?? true}
                                                            onChange={(v) => updatePrintTemplate('sales_receipt', { showCustomerInfo: v } as any)}
                                                            label="Thông tin khách"
                                                        />
                                                        <Toggle
                                                            checked={printSettings.templates.sales_receipt?.showPaymentDetails ?? true}
                                                            onChange={(v) => updatePrintTemplate('sales_receipt', { showPaymentDetails: v } as any)}
                                                            label="Chi tiết thanh toán"
                                                        />
                                                        <Toggle
                                                            checked={printSettings.templates.sales_receipt?.showPointsEarned ?? true}
                                                            onChange={(v) => updatePrintTemplate('sales_receipt', { showPointsEarned: v } as any)}
                                                            label="Điểm tích lũy"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Vị trí logo</label>
                                                            <select
                                                                value={(printSettings.templates.sales_receipt as any)?.logoPosition || 'center'}
                                                                onChange={(e) => updatePrintTemplate('sales_receipt', { logoPosition: e.target.value } as any)}
                                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                            >
                                                                <option value="left">Góc trái</option>
                                                                <option value="center">Căn giữa</option>
                                                                <option value="right">Góc phải</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Kích thước logo ({printSettings.logoSize || 80}px)</label>
                                                            <input
                                                                type="range"
                                                                min="40"
                                                                max="150"
                                                                value={printSettings.logoSize || 80}
                                                                onChange={(e) => updatePrintSettings({ logoSize: Number(e.target.value) })}
                                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 mt-2"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT COLUMN - Preview */}
                            <div className="sticky top-6 h-fit">
                                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-base font-bold text-gray-900 m-0">👁️ Xem trước</h3>
                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                                            {printSettings.templates[selectedTemplate]?.paperWidth || '80mm'}
                                        </span>
                                    </div>

                                    {/* Preview Container */}
                                    <div className="bg-slate-500 rounded-lg p-3 flex justify-center max-h-[600px] overflow-auto">
                                        <div className="scale-[0.85] origin-top">
                                            {selectedTemplate === 'sales_receipt' && (
                                                <SalesReceiptTemplate
                                                    data={{
                                                        order: {
                                                            id: 'DEMO-001',
                                                            order_number: 'HD001234',
                                                            total_amount: 250000,
                                                            discount_amount: 10000,
                                                            payment_method: 'cash',
                                                            cash_received: 300000,
                                                            created_at: new Date().toISOString(),
                                                            items: [
                                                                { product: { name: 'Sản phẩm mẫu A' }, quantity: 2, unit_price: 50000, unit_name: 'Cái' },
                                                                { product: { name: 'Sản phẩm mẫu B' }, quantity: 3, unit_price: 50000, unit_name: 'Hộp' },
                                                            ]
                                                        } as any,
                                                        storeName: printSettings.storeName,
                                                        storeAddress: printSettings.storeAddress,
                                                        storePhone: printSettings.storePhone,
                                                        storeLogo: printSettings.storeLogo,
                                                        logoSize: printSettings.logoSize,
                                                        footerText: printSettings.footerText,
                                                        noteText: printSettings.noteText,
                                                        cashierName: 'Nhân viên Demo',
                                                        customerName: 'Khách hàng VIP',
                                                        customerPhone: '0901234567',
                                                        pointsEarned: 25,
                                                        pointsTotal: 1250
                                                    }}
                                                    config={printSettings.templates.sales_receipt}
                                                />
                                            )}
                                            {selectedTemplate === 'cash_voucher' && (
                                                <CashVoucherTemplate
                                                    data={{
                                                        voucherNumber: 'PC-2024-001',
                                                        date: new Date(),
                                                        recipient: 'Nguyễn Văn A',
                                                        reason: 'Chi tiền mua văn phòng phẩm',
                                                        amount: 500000,
                                                        approver: 'Giám đốc',
                                                        createdBy: 'Kế toán',
                                                        storeName: printSettings.storeName,
                                                        storeAddress: printSettings.storeAddress
                                                    }}
                                                    config={printSettings.templates.cash_voucher}
                                                />
                                            )}
                                            {selectedTemplate === 'purchase_receipt' && (
                                                <PurchaseReceiptTemplate
                                                    data={{
                                                        receiptNumber: 'PN-2024-001',
                                                        date: new Date(),
                                                        supplier: { name: 'Công ty TNHH ABC', phone: '0281234567' },
                                                        items: [
                                                            { name: 'Hàng hóa A', sku: 'SKU001', quantity: 10, unitName: 'Thùng', unitPrice: 150000 },
                                                            { name: 'Hàng hóa B', sku: 'SKU002', quantity: 20, unitName: 'Hộp', unitPrice: 50000 },
                                                        ],
                                                        totalAmount: 2500000,
                                                        paidAmount: 2000000,
                                                        debtAmount: 500000,
                                                        createdBy: 'Nhân viên kho',
                                                        storeName: printSettings.storeName,
                                                        storeAddress: printSettings.storeAddress
                                                    }}
                                                    config={printSettings.templates.purchase_receipt}
                                                />
                                            )}
                                            {selectedTemplate === 'stock_check' && (
                                                <StockCheckTemplate
                                                    data={{
                                                        checkNumber: 'KK-DEMO-001',
                                                        date: new Date(),
                                                        warehouseName: 'Kho chính',
                                                        items: [
                                                            { name: 'Sản phẩm A', sku: 'SKU001', unitName: 'Thùng', systemQty: 100, actualQty: 98, difference: -2 },
                                                            { name: 'Sản phẩm B', sku: 'SKU002', unitName: 'Hộp', systemQty: 50, actualQty: 52, difference: 2 },
                                                        ],
                                                        totalDifference: { shortage: 2, surplus: 2 },
                                                        createdBy: 'Nhân viên kho',
                                                        storeName: printSettings.storeName,
                                                        storeAddress: printSettings.storeAddress
                                                    }}
                                                    config={printSettings.templates.stock_check}
                                                />
                                            )}
                                            {selectedTemplate === 'return_receipt' && (
                                                <ReturnReceiptTemplate
                                                    data={{
                                                        returnNumber: 'DT-DEMO-001',
                                                        originalOrderNumber: 'HD001234',
                                                        date: new Date(),
                                                        customer: { name: 'Nguyễn Văn A', phone: '0901234567' },
                                                        items: [
                                                            { name: 'Sản phẩm trả', quantity: 1, unitName: 'Cái', unitPrice: 100000, reason: 'Lỗi sản phẩm' },
                                                        ],
                                                        returnType: 'refund',
                                                        refundAmount: 100000,
                                                        createdBy: 'Nhân viên',
                                                        storeName: printSettings.storeName,
                                                        storeAddress: printSettings.storeAddress,
                                                        storePhone: printSettings.storePhone
                                                    }}
                                                    config={printSettings.templates.return_receipt}
                                                />
                                            )}
                                            {selectedTemplate === 'order_form' && (
                                                <OrderFormTemplate
                                                    data={{
                                                        orderNumber: 'DH-DEMO-001',
                                                        date: new Date(),
                                                        expectedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                                                        customer: { name: 'Khách hàng Demo', phone: '0901234567', address: '123 Đường ABC' },
                                                        items: [
                                                            { name: 'Sản phẩm đặt A', quantity: 5, unitName: 'Thùng', unitPrice: 200000 },
                                                        ],
                                                        totalAmount: 1000000,
                                                        depositAmount: 500000,
                                                        remainingAmount: 500000,
                                                        createdBy: 'Nhân viên',
                                                        storeName: printSettings.storeName,
                                                        storeAddress: printSettings.storeAddress,
                                                        storePhone: printSettings.storePhone
                                                    }}
                                                    config={printSettings.templates.order_form}
                                                />
                                            )}
                                            {selectedTemplate === 'transfer_receipt' && (
                                                <TransferReceiptTemplate
                                                    data={{
                                                        transferNumber: 'CK-DEMO-001',
                                                        date: new Date(),
                                                        fromWarehouse: 'Kho Chính',
                                                        toWarehouse: 'Kho Chi Nhánh',
                                                        items: [
                                                            { name: 'Hàng hóa A', sku: 'SKU001', quantity: 20, unitName: 'Thùng' },
                                                            { name: 'Hàng hóa B', sku: 'SKU002', quantity: 30, unitName: 'Hộp' },
                                                        ],
                                                        totalItems: 50,
                                                        createdBy: 'Nhân viên kho',
                                                        storeName: printSettings.storeName,
                                                        storeAddress: printSettings.storeAddress
                                                    }}
                                                    config={printSettings.templates.transfer_receipt}
                                                />
                                            )}
                                            {selectedTemplate === 'supplier_return' && (
                                                <SupplierReturnTemplate
                                                    data={{
                                                        returnNumber: 'TN-DEMO-001',
                                                        originalPONumber: 'PN001234',
                                                        date: new Date(),
                                                        supplier: { name: 'NCC ABC', phone: '0987654321', address: '456 Đường XYZ' },
                                                        items: [
                                                            { name: 'Hàng lỗi A', sku: 'SKU001', quantity: 5, unitName: 'Thùng', unitPrice: 100000, reason: 'Hàng hỏng' },
                                                        ],
                                                        totalAmount: 500000,
                                                        refundExpected: 500000,
                                                        createdBy: 'Nhân viên kho',
                                                        storeName: printSettings.storeName,
                                                        storeAddress: printSettings.storeAddress
                                                    }}
                                                    config={printSettings.templates.supplier_return}
                                                />
                                            )}
                                            {selectedTemplate === 'barcode_label' && (
                                                <BarcodeLabelTemplate
                                                    items={[
                                                        { id: '1', name: 'Sữa tươi Vinamilk 1L', barcode: '8934567890123', price: 32000, quantity: 1 },
                                                        { id: '2', name: 'Bánh Oishi Tôm Cay', barcode: '8931234567890', price: 5000, quantity: 1 },
                                                        { id: '3', name: 'Nước ngọt Coca Cola', barcode: '8939876543210', price: 10000, quantity: 1 },
                                                        { id: '4', name: 'Mì Hảo Hảo Tôm Chua Cay', barcode: '8935555555555', price: 4500, quantity: 1 },
                                                        { id: '5', name: 'Dầu ăn Neptune 1L', barcode: '8936666666666', price: 45000, quantity: 1 },
                                                        { id: '6', name: 'Gạo ST25 Ông Cua 5kg', barcode: '8937777777777', price: 180000, quantity: 1 },
                                                    ]}
                                                    config={labelConfig}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Click to enlarge hint */}
                                    <p
                                        onClick={() => setShowPreviewModal(true)}
                                        className="text-[11px] text-blue-500 text-center mt-2 cursor-pointer hover:underline"
                                    >
                                        🔍 Click để xem to hơn
                                    </p>

                                    {/* Test Print Button */}
                                    <button
                                        onClick={async () => {
                                            setIsPrinting(true);
                                            try {
                                                let htmlContent = '';
                                                if (selectedTemplate === 'sales_receipt') {
                                                    htmlContent = generateSalesReceiptHTML({
                                                        order: {
                                                            id: 'TEST-001',
                                                            order_number: 'HD-TEST',
                                                            total_amount: 250000,
                                                            discount_amount: 10000,
                                                            payment_method: 'cash',
                                                            cash_received: 300000,
                                                            created_at: new Date().toISOString(),
                                                            items: [
                                                                { product: { name: 'Sản phẩm mẫu A' }, quantity: 2, unit_price: 50000, unit_name: 'Cái' },
                                                                { product: { name: 'Sản phẩm mẫu B' }, quantity: 3, unit_price: 50000, unit_name: 'Hộp' },
                                                            ]
                                                        } as any,
                                                        storeName: printSettings.storeName,
                                                        storeAddress: printSettings.storeAddress,
                                                        storePhone: printSettings.storePhone,
                                                        storeLogo: printSettings.storeLogo,
                                                        footerText: printSettings.footerText,
                                                        noteText: printSettings.noteText,
                                                        cashierName: 'Nhân viên Test',
                                                        customerName: 'Khách Test',
                                                        pointsEarned: 25
                                                    }, printSettings.templates.sales_receipt);
                                                } else if (selectedTemplate === 'cash_voucher') {
                                                    htmlContent = generateCashVoucherHTML({
                                                        voucherNumber: 'PC-TEST-001',
                                                        date: new Date(),
                                                        recipient: 'Người nhận test',
                                                        reason: 'In thử phiếu chi',
                                                        amount: 500000,
                                                        createdBy: 'Kế toán',
                                                        storeName: printSettings.storeName,
                                                        storeAddress: printSettings.storeAddress
                                                    }, printSettings.templates.cash_voucher);
                                                } else if (selectedTemplate === 'purchase_receipt') {
                                                    htmlContent = generatePurchaseReceiptHTML({
                                                        receiptNumber: 'PN-TEST-001',
                                                        date: new Date(),
                                                        supplier: { name: 'NCC Test', phone: '0901234567' },
                                                        items: [
                                                            { name: 'Hàng hóa test', quantity: 10, unitName: 'Thùng', unitPrice: 100000 },
                                                        ],
                                                        totalAmount: 1000000,
                                                        paidAmount: 1000000,
                                                        debtAmount: 0,
                                                        createdBy: 'Nhân viên test',
                                                        storeName: printSettings.storeName,
                                                        storeAddress: printSettings.storeAddress
                                                    }, printSettings.templates.purchase_receipt);
                                                } else {
                                                    // Fallback to test print for unimplemented templates
                                                    await testPrint(printSettings);
                                                    alert('✅ Đã gửi lệnh in thử!');
                                                    setIsPrinting(false);
                                                    return;
                                                }
                                                await print({ templateType: selectedTemplate, content: htmlContent, settings: printSettings });
                                                alert('✅ Đã in mẫu ' + selectedTemplate + '!');
                                            } catch (err) {
                                                alert('❌ Lỗi khi in: ' + (err as Error).message);
                                            } finally {
                                                setIsPrinting(false);
                                            }
                                        }}
                                        disabled={isPrinting}
                                        className={`w-full mt-3 p-3 text-white border-0 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${isPrinting ? 'bg-gray-400 cursor-wait' : 'bg-blue-500 hover:bg-blue-600 cursor-pointer shadow-md shadow-blue-500/20'}`}
                                    >
                                        🖨️ {isPrinting ? 'Đang in...' : 'In thử'}
                                    </button>

                                    <p className="text-[11px] text-gray-400 text-center mt-2 m-0">
                                        In trang test để kiểm tra kết nối máy in
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Fullscreen Preview Modal */}
                    {showPreviewModal && (
                        <div className="fixed inset-0 bg-black/85 z-[9999] flex flex-col items-center p-5 overflow-auto" onClick={() => setShowPreviewModal(false)}>
                            <div className="flex justify-between w-full max-w-[500px] mb-4">
                                <h2 className="text-white font-bold text-lg m-0">👁️ Xem trước chi tiết</h2>
                                <button onClick={() => setShowPreviewModal(false)} className="bg-white/20 border-0 text-white px-4 py-2 rounded-lg cursor-pointer font-semibold hover:bg-white/30 transition-all">✕ Đóng</button>
                            </div>
                            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl p-5 max-w-full overflow-auto max-h-[85vh]">
                                {selectedTemplate === 'sales_receipt' && <SalesReceiptTemplate data={{ order: { id: 'D1', order_number: 'HD001', total_amount: 250000, discount_amount: 10000, payment_method: 'cash', cash_received: 300000, created_at: new Date().toISOString(), items: [{ product: { name: 'SP A' }, quantity: 2, unit_price: 50000, unit_name: 'Cái' }] } as any, storeName: printSettings.storeName, storeAddress: printSettings.storeAddress, storePhone: printSettings.storePhone, storeLogo: printSettings.storeLogo, footerText: printSettings.footerText, noteText: printSettings.noteText, cashierName: 'NV', pointsEarned: 25 }} config={printSettings.templates.sales_receipt} />}
                                {selectedTemplate === 'cash_voucher' && <CashVoucherTemplate data={{ voucherNumber: 'PC-001', date: new Date(), recipient: 'Người nhận', reason: 'Chi', amount: 1000000, createdBy: 'KT', storeName: printSettings.storeName, storeAddress: printSettings.storeAddress }} config={printSettings.templates.cash_voucher} />}
                                {selectedTemplate === 'purchase_receipt' && <PurchaseReceiptTemplate data={{ receiptNumber: 'PN-001', date: new Date(), supplier: { name: 'NCC' }, items: [{ name: 'HH', quantity: 10, unitName: 'Thùng', unitPrice: 100000 }], totalAmount: 1000000, paidAmount: 1000000, debtAmount: 0, createdBy: 'NV', storeName: printSettings.storeName, storeAddress: printSettings.storeAddress }} config={printSettings.templates.purchase_receipt} />}
                                {selectedTemplate === 'stock_check' && <StockCheckTemplate data={{ checkNumber: 'KK-001', date: new Date(), items: [{ name: 'SP', sku: 'S', unitName: 'C', systemQty: 100, actualQty: 98, difference: -2 }], totalDifference: { shortage: 2, surplus: 0 }, createdBy: 'NV', storeName: printSettings.storeName, storeAddress: printSettings.storeAddress }} config={printSettings.templates.stock_check} />}
                                {selectedTemplate === 'return_receipt' && <ReturnReceiptTemplate data={{ returnNumber: 'DT-001', date: new Date(), items: [{ name: 'SP', quantity: 1, unitName: 'C', unitPrice: 100000 }], returnType: 'refund', refundAmount: 100000, createdBy: 'NV', storeName: printSettings.storeName, storeAddress: printSettings.storeAddress, storePhone: printSettings.storePhone }} config={printSettings.templates.return_receipt} />}
                                {selectedTemplate === 'order_form' && <OrderFormTemplate data={{ orderNumber: 'DH-001', date: new Date(), customer: { name: 'KH', phone: '09' }, items: [{ name: 'SP', quantity: 5, unitName: 'T', unitPrice: 200000 }], totalAmount: 1000000, createdBy: 'NV', storeName: printSettings.storeName, storeAddress: printSettings.storeAddress, storePhone: printSettings.storePhone }} config={printSettings.templates.order_form} />}
                                {selectedTemplate === 'transfer_receipt' && <TransferReceiptTemplate data={{ transferNumber: 'CK-001', date: new Date(), fromWarehouse: 'A', toWarehouse: 'B', items: [{ name: 'HH', quantity: 20, unitName: 'T' }], totalItems: 20, createdBy: 'NV', storeName: printSettings.storeName, storeAddress: printSettings.storeAddress }} config={printSettings.templates.transfer_receipt} />}
                                {selectedTemplate === 'supplier_return' && <SupplierReturnTemplate data={{ returnNumber: 'TN-001', date: new Date(), supplier: { name: 'NCC' }, items: [{ name: 'HH', quantity: 5, unitName: 'T', unitPrice: 100000 }], totalAmount: 500000, createdBy: 'NV', storeName: printSettings.storeName, storeAddress: printSettings.storeAddress }} config={printSettings.templates.supplier_return} />}
                            </div>
                        </div>
                    )}

                    {/* ==================== PAYMENT METHODS ==================== */}
                    {activeTab === 'payment' && (
                        <div>
                            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 mb-1">Phương thức thanh toán</h2>
                                        <p className="text-sm text-gray-500 m-0">Quản lý các phương thức thanh toán hiển thị tại POS</p>
                                    </div>
                                    <button
                                        className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2"
                                        onClick={() => {
                                            const name = prompt('Nhập tên phương thức thanh toán mới:');
                                            if (name && name.trim()) {
                                                const icon = prompt('Nhập emoji icon (ví dụ: 💵, 🏦):', '💰');
                                                addPaymentMethod({
                                                    id: `custom-${Date.now()}`,
                                                    name: name.trim(),
                                                    icon: icon || '💰',
                                                    iconType: 'emoji',
                                                    enabled: true,
                                                    isSystem: false
                                                });
                                            }
                                        }}
                                    >
                                        + Thêm phương thức
                                    </button>
                                </div>

                                <div className="bg-emerald-50 p-4 rounded-xl mb-4 border border-emerald-200">
                                    <label className="block text-sm font-medium text-emerald-800 mb-2">Phương thức mặc định khi mở POS</label>
                                    <select
                                        value={defaultPaymentMethod}
                                        onChange={(e) => setDefaultPaymentMethod(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                                    >
                                        {paymentMethods.filter(m => m.enabled).map(m => (
                                            <option key={m.id} value={m.id}>{m.icon} {m.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Payment Methods List */}
                                <div className="flex flex-col gap-2">
                                    {[...paymentMethods].sort((a, b) => a.sortOrder - b.sortOrder).map((method, index) => (
                                        <div
                                            key={method.id}
                                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${method.enabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}
                                        >
                                            {/* Order Number */}
                                            <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-400">
                                                {index + 1}
                                            </div>

                                            {/* Icon */}
                                            <span className="text-2xl">
                                                {method.iconType === 'url' ? (
                                                    <img src={method.icon} alt={method.name} className="w-6 h-6 rounded" />
                                                ) : method.icon}
                                            </span>

                                            {/* Name */}
                                            <div className="flex-1">
                                                <div className="font-semibold text-gray-900">{method.name}</div>
                                                {method.isSystem && (
                                                    <span className="text-[11px] text-gray-400">Hệ thống</span>
                                                )}
                                            </div>

                                            {/* Default Badge */}
                                            {defaultPaymentMethod === method.id && (
                                                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-1 rounded-md">
                                                    Mặc định
                                                </span>
                                            )}

                                            {/* Move Buttons */}
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => {
                                                        if (index > 0) {
                                                            const sorted = [...paymentMethods].sort((a, b) => a.sortOrder - b.sortOrder);
                                                            const newOrder = [...sorted];
                                                            [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
                                                            reorderPaymentMethods(newOrder.map((m, i) => ({ ...m, sortOrder: i })));
                                                        }
                                                    }}
                                                    disabled={index === 0}
                                                    className={`px-2 py-1 rounded border hover:bg-gray-50 ${index === 0 ? 'opacity-50 cursor-not-allowed border-gray-200' : 'border-gray-200 text-gray-600'}`}
                                                >
                                                    ↑
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (index < paymentMethods.length - 1) {
                                                            const sorted = [...paymentMethods].sort((a, b) => a.sortOrder - b.sortOrder);
                                                            const newOrder = [...sorted];
                                                            [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                                                            reorderPaymentMethods(newOrder.map((m, i) => ({ ...m, sortOrder: i })));
                                                        }
                                                    }}
                                                    disabled={index === paymentMethods.length - 1}
                                                    className={`px-2 py-1 rounded border hover:bg-gray-50 ${index === paymentMethods.length - 1 ? 'opacity-50 cursor-not-allowed border-gray-200' : 'border-gray-200 text-gray-600'}`}
                                                >
                                                    ↓
                                                </button>
                                            </div>

                                            {/* Toggle Enabled */}
                                            <button
                                                onClick={() => updatePaymentMethod(method.id, { enabled: !method.enabled })}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border-0 cursor-pointer ${method.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}
                                            >
                                                {method.enabled ? '✓ Hiển thị' : 'Ẩn'}
                                            </button>

                                            {/* Delete Button (only for non-system) */}
                                            {!method.isSystem && (
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Xóa phương thức "${method.name}"?`)) {
                                                            deletePaymentMethod(method.id);
                                                        }
                                                    }}
                                                    className="px-2.5 py-1.5 rounded-lg border-0 bg-red-100 text-red-600 text-xs cursor-pointer hover:bg-red-200"
                                                >
                                                    🗑
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==================== PERMISSIONS CHECK ==================== */}
                    {activeTab === 'permissions' && hasPermission(users.find(u => u.id === authUser?.id) || (authUser as any), 'settings_permissions') && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-2xl font-extrabold text-gray-900 mb-2 tracking-tight">Phân quyền & Vai trò</h2>
                                    <p className="text-gray-500 text-sm">Quản lý các vai trò và quyền hạn tương ứng của nhân viên trong hệ thống.</p>
                                </div>
                                <button
                                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-medium shadow-lg shadow-green-500/20 hover:shadow-green-500/40 transition-all flex items-center gap-2"
                                    onClick={() => { setEditingRole(null); setShowRoleModal(true); }}
                                >
                                    <span className="text-lg">+</span> Thêm vai trò mới
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {(roles || []).map(role => (
                                    <div
                                        key={role.id}
                                        className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-emerald-200 transition-all duration-300 p-6 flex flex-col justify-between relative overflow-hidden group"
                                    >
                                        <div className={`absolute top-0 left-0 w-full h-1.5 ${role.id === 'admin-role' ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-emerald-500 to-green-600'}`} />

                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                <h3 className="text-lg font-bold text-gray-900 m-0">{role.name}</h3>
                                                {role.is_system && (
                                                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-100 uppercase tracking-wider">
                                                        SYSTEM
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500 mb-6 leading-relaxed line-clamp-2 h-10">
                                                {role.description || 'Không có mô tả cho vai trò này.'}
                                            </p>

                                            <div className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-dashed border-gray-200 flex items-center gap-2 mb-6">
                                                <span className="text-base">🔐</span>
                                                <strong>Quyền hạn:</strong>
                                                <span className={`font-semibold ${role.id === 'admin-role' ? 'text-blue-600' : 'text-emerald-600'}`}>
                                                    {role.id === 'admin-role' ? 'Toàn quyền Access' : `${role.permissions?.length || 0} quyền được cấp`}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                                            {!role.is_system && (
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm('Bạn có chắc chắn muốn xóa vai trò này?')) {
                                                            deleteRole(role.id);
                                                        }
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg border border-red-100 bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors"
                                                >
                                                    Xóa
                                                </button>
                                            )}
                                            <button
                                                onClick={() => { setEditingRole(role); setShowRoleModal(true); }}
                                                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all"
                                            >
                                                {role.is_system && role.id === 'admin-role' ? 'Xem chi tiết' : 'Chỉnh sửa'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>


            {
                showPromoModal && (
                    <PromotionModal
                        promotion={editingPromo}
                        onClose={() => { setShowPromoModal(false); setEditingPromo(null); }}
                        onSave={(data) => {
                            if (editingPromo) {
                                updatePromotion(editingPromo.id, data);
                            } else {
                                addPromotion(data);
                            }
                            setShowPromoModal(false);
                            setEditingPromo(null);
                        }}
                    />
                )
            }





            {/* Role Modal */}
            {
                showRoleModal && (
                    <RoleModal
                        role={editingRole}
                        onClose={() => { setShowRoleModal(false); setEditingRole(null); }}
                        onSave={async (data) => {
                            if (editingRole) {
                                await updateRole(editingRole.id, data);
                            } else {
                                await addRole(data);
                            }
                            setShowRoleModal(false);
                        }}
                    />
                )
            }
        </div >
    );
}

// ... (PromotionModal)

// ============================================================================
// ROLE MODAL COMPONENT
// ============================================================================
import { PERMISSION_GROUPS, type Permission } from '@/stores/userStore';

function RoleModal({ role, onClose, onSave }: { role: Role | null, onClose: () => void, onSave: (data: any) => Promise<void> }) {
    const [formData, setFormData] = useState({
        name: role?.name || '',
        description: role?.description || '',
        permissions: role?.permissions || []
    });

    const isSystemAdmin = role?.id === 'admin-role';

    const togglePermission = (code: string) => {
        if (isSystemAdmin) return; // Admin permissions immutable
        setFormData(prev => {
            const current = prev.permissions;
            if (current.includes(code)) return { ...prev, permissions: current.filter(p => p !== code) };
            return { ...prev, permissions: [...current, code] };
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="text-xl font-bold text-gray-900">{role ? 'Sửa vai trò' : 'Thêm vai trò mới'}</h2>
                    <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">✕</button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    <div className="mb-5">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Tên vai trò *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            disabled={isSystemAdmin}
                            placeholder="VD: Quản lý kho"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Mô tả</label>
                        <input
                            type="text"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            disabled={isSystemAdmin}
                            placeholder="Mô tả ngắn về vai trò này"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all disabled:bg-gray-50 disabled:text-gray-500"
                        />
                    </div>

                    <h3 className="text-base font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                        🛡️ Phân quyền chi tiết
                    </h3>

                    {isSystemAdmin && (
                        <div className="p-3 bg-amber-50 rounded-xl mb-5 text-amber-800 text-sm border border-amber-100 flex items-start gap-2">
                            <span>🔒</span> Vai trò Admin có toàn quyền hệ thống và không thể chỉnh sửa.
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {PERMISSION_GROUPS.map(group => {
                            const groupPerms = group.permissions.map(p => p.code);
                            const selectedCount = groupPerms.filter(c => formData.permissions.includes(c)).length;
                            const allSelected = selectedCount === groupPerms.length;

                            return (
                                <div key={group.name} className="border border-gray-200 rounded-xl overflow-hidden hover:border-emerald-200 transition-colors bg-white hover:shadow-sm">
                                    <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-200 flex justify-between items-center">
                                        <div className="flex items-center gap-2 font-semibold text-gray-700 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={allSelected}
                                                disabled={isSystemAdmin}
                                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                                                onChange={() => {
                                                    if (allSelected) {
                                                        setFormData(prev => ({ ...prev, permissions: prev.permissions.filter(p => !groupPerms.includes(p as any)) }));
                                                    } else {
                                                        setFormData(prev => ({ ...prev, permissions: [...new Set([...prev.permissions, ...groupPerms])] }));
                                                    }
                                                }}
                                            />
                                            {group.icon} {group.name}
                                        </div>
                                    </div>
                                    <div className="p-3 space-y-1">
                                        {group.permissions.map(perm => (
                                            <label key={perm.code} className={`flex items-center gap-3 py-1.5 px-2 rounded-lg text-sm transition-colors select-none ${isSystemAdmin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-50 text-gray-600'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.permissions.includes(perm.code)}
                                                    disabled={isSystemAdmin}
                                                    onChange={() => togglePermission(perm.code)}
                                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                                                />
                                                {perm.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors">Hủy</button>
                    {!isSystemAdmin && (
                        <button onClick={() => onSave(formData)} className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20">Lưu thay đổi</button>
                    )}
                </div>
            </div>
        </div>
    );
}

interface PromotionModalProps {
    promotion: Promotion | null;
    onClose: () => void;
    onSave: (data: Omit<Promotion, 'id' | 'usedCount'>) => void;
}

function PromotionModal({ promotion, onClose, onSave }: PromotionModalProps) {
    const [formData, setFormData] = useState({
        name: promotion?.name || '',
        type: promotion?.type || 'percentage' as PromotionType,
        active: promotion?.active ?? true,
        startDate: promotion?.startDate || new Date().toISOString().split('T')[0],
        endDate: promotion?.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        discountValue: promotion?.discountValue || 10,
        minPurchase: promotion?.minPurchase || 0,
        maxDiscount: promotion?.maxDiscount || 0,
        buyQuantity: promotion?.buyQuantity || 2,
        getQuantity: promotion?.getQuantity || 1,
        couponCode: promotion?.couponCode || '',
        startTime: promotion?.startTime || '10:00',
        endTime: promotion?.endTime || '14:00',
    });

    const handleSave = () => {
        onSave({
            name: formData.name,
            type: formData.type,
            active: formData.active,
            startDate: formData.startDate,
            endDate: formData.endDate,
            discountValue: formData.discountValue,
            minPurchase: formData.minPurchase,
            maxDiscount: formData.maxDiscount,
            buyQuantity: formData.buyQuantity,
            getQuantity: formData.getQuantity,
            couponCode: formData.couponCode || undefined,
            startTime: formData.type === 'happy_hour' ? formData.startTime : undefined,
            endTime: formData.type === 'happy_hour' ? formData.endTime : undefined,
        });
    };

    const inputClasses = "w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all box-border";
    const labelClasses = "block text-sm font-medium text-gray-700 mb-1.5";

    return (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-[500px] max-w-full max-h-[90vh] overflow-auto flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 flex-shrink-0">
                    <h2 className="text-lg font-bold text-gray-900">
                        {promotion ? 'Sửa khuyến mãi' : 'Thêm khuyến mãi mới'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">✕</button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    <div className="flex flex-col gap-5">
                        <div>
                            <label className={labelClasses}>Tên khuyến mãi</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="VD: Giảm 10% tất cả sản phẩm"
                                className={inputClasses}
                            />
                        </div>

                        <div>
                            <label className={labelClasses}>Loại khuyến mãi</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value as PromotionType })}
                                className={inputClasses}
                            >
                                <option value="percentage">% Giảm giá</option>
                                <option value="fixed_amount">Giảm số tiền cố định</option>
                                <option value="buy_x_get_y">Mua X tặng Y</option>
                                <option value="happy_hour">Happy Hour</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClasses}>Ngày bắt đầu</label>
                                <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className={inputClasses} />
                            </div>
                            <div>
                                <label className={labelClasses}>Ngày kết thúc</label>
                                <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className={inputClasses} />
                            </div>
                        </div>

                        {(formData.type === 'percentage' || formData.type === 'fixed_amount' || formData.type === 'happy_hour') && (
                            <div>
                                <label className={labelClasses}>
                                    {formData.type === 'percentage' ? 'Phần trăm giảm (%)' : 'Số tiền giảm (VNĐ)'}
                                </label>
                                <input
                                    type="number"
                                    value={formData.discountValue}
                                    onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                                    className={inputClasses}
                                />
                            </div>
                        )}

                        {formData.type === 'buy_x_get_y' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClasses}>Mua số lượng</label>
                                    <input type="number" value={formData.buyQuantity} onChange={(e) => setFormData({ ...formData, buyQuantity: Number(e.target.value) })} className={inputClasses} />
                                </div>
                                <div>
                                    <label className={labelClasses}>Tặng số lượng</label>
                                    <input type="number" value={formData.getQuantity} onChange={(e) => setFormData({ ...formData, getQuantity: Number(e.target.value) })} className={inputClasses} />
                                </div>
                            </div>
                        )}

                        {formData.type === 'happy_hour' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClasses}>Giờ bắt đầu</label>
                                    <input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} className={inputClasses} />
                                </div>
                                <div>
                                    <label className={labelClasses}>Giờ kết thúc</label>
                                    <input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} className={inputClasses} />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className={labelClasses}>Mã giảm giá (tuỳ chọn)</label>
                            <input
                                type="text"
                                value={formData.couponCode}
                                onChange={(e) => setFormData({ ...formData, couponCode: e.target.value.toUpperCase() })}
                                placeholder="VD: GIAM10"
                                className={inputClasses}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClasses}>Đơn tối thiểu (VNĐ)</label>
                                <input type="number" value={formData.minPurchase} onChange={(e) => setFormData({ ...formData, minPurchase: Number(e.target.value) })} className={inputClasses} />
                            </div>
                            <div>
                                <label className={labelClasses}>Giảm tối đa (VNĐ, 0=không giới hạn)</label>
                                <input type="number" value={formData.maxDiscount} onChange={(e) => setFormData({ ...formData, maxDiscount: Number(e.target.value) })} className={inputClasses} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 flex-shrink-0">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                        Hủy
                    </button>
                    <button onClick={handleSave} className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20">
                        {promotion ? 'Cập nhật' : 'Tạo khuyến mãi'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SettingsPage;
