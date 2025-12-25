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

type TabId = 'general' | 'permissions' | 'print' | 'receipt' | 'labels' | 'loyalty' | 'payment' | 'promotions' | 'expiry' | 'stock' | 'notifications' | 'debt' | 'shift';

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
    const { users, updateUser, roles, fetchRoles, addRole, updateRole, deleteRole } = useUserStore();
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
        { id: 'promotions', label: 'Khuyến mãi', icon: '🎉' },
        { id: 'expiry', label: 'Hạn sử dụng', icon: '📅' },
        { id: 'stock', label: 'Tồn kho', icon: '📦' },
        { id: 'shift', label: 'Ca làm việc', icon: '⏱️' },
        { id: 'notifications', label: 'Thông báo', icon: '📱' },
        { id: 'debt', label: 'Công nợ', icon: '💰' },
        { id: 'payment', label: 'Thanh toán', icon: '💳' },
        { id: 'print', label: 'In ấn', icon: '🖨️' },
        { id: 'permissions', label: 'Phân quyền', icon: '🔐' },
    ];

    const isAdmin = authUser?.role === 'admin';

    // Styles
    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '12px 16px',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        color: '#1a1a1a'
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: '14px',
        fontWeight: 500,
        color: '#374151',
        marginBottom: '8px'
    };

    const cardStyle: React.CSSProperties = {
        backgroundColor: 'white',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        padding: '24px',
        marginBottom: '16px'
    };

    const btnPrimary: React.CSSProperties = {
        padding: '10px 20px',
        backgroundColor: '#22c55e',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 600,
        cursor: 'pointer'
    };

    const btnSecondary: React.CSSProperties = {
        padding: '8px 16px',
        backgroundColor: '#f3f4f6',
        color: '#374151',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        fontWeight: 500,
        cursor: 'pointer'
    };

    const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
            <span style={{ fontWeight: 500, color: '#374151' }}>{label}</span>
            <div
                style={{
                    width: '44px',
                    height: '24px',
                    backgroundColor: checked ? '#22c55e' : '#e5e7eb',
                    borderRadius: '12px',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                }}
                onClick={() => onChange(!checked)}
            >
                <div style={{
                    position: 'absolute',
                    top: '2px',
                    left: checked ? '22px' : '2px',
                    width: '20px',
                    height: '20px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'left 0.2s'
                }} />
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
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            {/* Header */}
            <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 24px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>⚙️ Cài đặt hệ thống</h1>
            </header>

            <div style={{ display: 'flex', maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
                {/* Sidebar Tabs */}
                <div style={{ width: '180px', flexShrink: 0, marginRight: '24px' }}>
                    <div style={cardStyle}>
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    textAlign: 'left',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: activeTab === tab.id ? '#dcfce7' : 'transparent',
                                    color: activeTab === tab.id ? '#16a34a' : '#374151',
                                    fontWeight: activeTab === tab.id ? 600 : 500,
                                    cursor: 'pointer',
                                    marginBottom: '4px',
                                    fontSize: '13px'
                                }}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                    {/* ==================== GENERAL ==================== */}
                    {activeTab === 'general' && (
                        <div>
                            <div style={cardStyle}>
                                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#111827' }}>Cài đặt chung</h2>

                                <Toggle
                                    checked={allowNegativeStock}
                                    onChange={setAllowNegativeStock}
                                    label="Cho phép bán khi hết hàng (tồn kho âm)"
                                />

                                <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '16px', paddingTop: '16px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Thông tin cửa hàng</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div>
                                            <label style={labelStyle}>Tên cửa hàng</label>
                                            <input type="text" value={receipt.storeName} onChange={(e) => updateReceipt({ storeName: e.target.value })} style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Số điện thoại</label>
                                            <input type="text" value={receipt.storePhone} onChange={(e) => updateReceipt({ storePhone: e.target.value })} style={inputStyle} />
                                        </div>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label style={labelStyle}>Địa chỉ</label>
                                            <input type="text" value={receipt.storeAddress} onChange={(e) => updateReceipt({ storeAddress: e.target.value })} style={inputStyle} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==================== PROMOTIONS ==================== */}
                    {activeTab === 'promotions' && (
                        <div>
                            <div style={cardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <div>
                                        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>Quản lý Khuyến mãi</h2>
                                        <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Tạo và quản lý các chương trình khuyến mãi</p>
                                    </div>
                                    <button style={btnPrimary} onClick={() => { setEditingPromo(null); setShowPromoModal(true); }}>
                                        + Thêm khuyến mãi
                                    </button>
                                </div>

                                <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: '16px', paddingBottom: '16px' }}>
                                    <Toggle
                                        checked={promotionSettings.stackable}
                                        onChange={(v) => updatePromotionSettings({ stackable: v })}
                                        label="Cho phép áp dụng nhiều khuyến mãi cùng lúc"
                                    />
                                </div>

                                {/* Promotions List */}
                                {promotionSettings.promotions.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                                        <p>Chưa có khuyến mãi nào. Bấm "Thêm khuyến mãi" để tạo mới.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {promotionSettings.promotions.map((promo) => {
                                            const isActive = promo.active && new Date(promo.startDate) <= new Date() && new Date(promo.endDate) >= new Date();
                                            return (
                                                <div key={promo.id} style={{
                                                    padding: '16px',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '12px',
                                                    backgroundColor: isActive ? '#f0fdf4' : '#fafafa'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                                <span style={{ fontWeight: 600, fontSize: '16px' }}>{promo.name}</span>
                                                                <span style={{
                                                                    padding: '2px 8px',
                                                                    borderRadius: '12px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 500,
                                                                    backgroundColor: isActive ? '#dcfce7' : '#f3f4f6',
                                                                    color: isActive ? '#16a34a' : '#6b7280'
                                                                }}>
                                                                    {isActive ? '● Đang chạy' : '○ Tạm dừng'}
                                                                </span>
                                                            </div>
                                                            <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                                                {promoTypeLabels[promo.type]} • {promo.startDate} → {promo.endDate}
                                                            </div>
                                                            {promo.type === 'percentage' && (
                                                                <div style={{ fontSize: '14px', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>
                                                                    Giảm {promo.discountValue}%
                                                                </div>
                                                            )}
                                                            {promo.type === 'fixed_amount' && (
                                                                <div style={{ fontSize: '14px', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>
                                                                    Giảm {formatVND(promo.discountValue || 0)}
                                                                </div>
                                                            )}
                                                            {promo.type === 'buy_x_get_y' && (
                                                                <div style={{ fontSize: '14px', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>
                                                                    Mua {promo.buyQuantity} tặng {promo.getQuantity}
                                                                </div>
                                                            )}
                                                            {promo.couponCode && (
                                                                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                                                                    Mã: <code style={{ backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>{promo.couponCode}</code>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button
                                                                style={{ ...btnSecondary, padding: '6px 12px', fontSize: '12px' }}
                                                                onClick={() => updatePromotion(promo.id, { active: !promo.active })}
                                                            >
                                                                {promo.active ? 'Tắt' : 'Bật'}
                                                            </button>
                                                            <button
                                                                style={{ ...btnSecondary, padding: '6px 12px', fontSize: '12px' }}
                                                                onClick={() => { setEditingPromo(promo); setShowPromoModal(true); }}
                                                            >
                                                                Sửa
                                                            </button>
                                                            <button
                                                                style={{ ...btnSecondary, padding: '6px 12px', fontSize: '12px', color: '#dc2626' }}
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
                            <div style={cardStyle}>
                                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>💡 Các loại khuyến mãi</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                    {[
                                        { icon: '🏷️', name: '% Giảm giá', desc: 'Giảm X% trên tổng đơn' },
                                        { icon: '💰', name: 'Giảm cố định', desc: 'Giảm số tiền cố định' },
                                        { icon: '🎁', name: 'Mua X tặng Y', desc: 'Mua 2 tặng 1, v.v.' },
                                        { icon: '📦', name: 'Combo', desc: 'Gói sản phẩm giá ưu đãi' },
                                        { icon: '⏰', name: 'Happy Hour', desc: 'Giảm giá theo khung giờ' },
                                    ].map((type) => (
                                        <div key={type.name} style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{type.icon}</div>
                                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{type.name}</div>
                                            <div style={{ fontSize: '12px', color: '#6b7280' }}>{type.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==================== EXPIRY DATE ==================== */}
                    {activeTab === 'expiry' && (
                        <div>
                            <div style={cardStyle}>
                                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#111827' }}>Quản lý Hạn sử dụng</h2>

                                <Toggle
                                    checked={expiry.enabled}
                                    onChange={(v) => updateExpiry({ enabled: v })}
                                    label="Bật theo dõi hạn sử dụng sản phẩm"
                                />

                                {expiry.enabled && (
                                    <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '16px', paddingTop: '16px' }}>
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

                                        <div style={{ marginTop: '16px' }}>
                                            <label style={labelStyle}>Cảnh báo trước khi hết hạn (ngày)</label>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                {[7, 14, 30, 60, 90].map((day) => (
                                                    <button
                                                        key={day}
                                                        style={{
                                                            padding: '8px 16px',
                                                            borderRadius: '8px',
                                                            border: expiry.alertDays.includes(day) ? '2px solid #22c55e' : '1px solid #e5e7eb',
                                                            backgroundColor: expiry.alertDays.includes(day) ? '#f0fdf4' : 'white',
                                                            fontWeight: expiry.alertDays.includes(day) ? 600 : 400,
                                                            cursor: 'pointer'
                                                        }}
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
                                <div style={cardStyle}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Tự động giảm giá sản phẩm sắp hết hạn</h3>

                                    <Toggle
                                        checked={expiry.autoMarkdownEnabled}
                                        onChange={(v) => updateExpiry({ autoMarkdownEnabled: v })}
                                        label="Bật auto markdown"
                                    />

                                    {expiry.autoMarkdownEnabled && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                                            <div>
                                                <label style={labelStyle}>Áp dụng trước HSD (ngày)</label>
                                                <input
                                                    type="number"
                                                    value={expiry.autoMarkdownDays}
                                                    onChange={(e) => updateExpiry({ autoMarkdownDays: Number(e.target.value) })}
                                                    style={inputStyle}
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Phần trăm giảm giá (%)</label>
                                                <input
                                                    type="number"
                                                    value={expiry.autoMarkdownPercent}
                                                    onChange={(e) => updateExpiry({ autoMarkdownPercent: Number(e.target.value) })}
                                                    style={inputStyle}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fef3c7', borderRadius: '8px', fontSize: '13px' }}>
                                        <strong>💡 Ví dụ:</strong> Sản phẩm còn {expiry.autoMarkdownDays} ngày trước HSD sẽ tự động giảm {expiry.autoMarkdownPercent}%
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ==================== SHIFT SETTINGS ==================== */}
                    {activeTab === 'shift' && (
                        <div>
                            <div style={cardStyle}>
                                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#111827' }}>Cài đặt Ca làm việc</h2>
                                <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>
                                    Cấu hình cách thức vào ca và kết ca
                                </p>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div
                                        style={{
                                            padding: '16px',
                                            borderRadius: '12px',
                                            border: tempShiftMode === 'auto' ? '2px solid #22c55e' : '1px solid #e5e7eb',
                                            backgroundColor: tempShiftMode === 'auto' ? '#f0fdf4' : 'white',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => setTempShiftMode('auto')}
                                    >
                                        <div style={{ fontWeight: 600, color: '#111827', marginBottom: '4px' }}>⚡ Vào ca Tự động</div>
                                        <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                            Hệ thống tự động ghi nhận thời gian thực khi ấn "Vào ca". Không thể chỉnh sửa giờ vào ca.
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            padding: '16px',
                                            borderRadius: '12px',
                                            border: tempShiftMode === 'manual' ? '2px solid #22c55e' : '1px solid #e5e7eb',
                                            backgroundColor: tempShiftMode === 'manual' ? '#f0fdf4' : 'white',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => setTempShiftMode('manual')}
                                    >
                                        <div style={{ fontWeight: 600, color: '#111827', marginBottom: '4px' }}>🕒 Vào ca Thủ công</div>
                                        <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                            Cho phép chọn giờ vào ca và kết ca thủ công. Phù hợp khi cần nhập liệu lại cho ca trước.
                                        </div>
                                    </div>
                                </div>

                                {/* Visibility Settings */}
                                <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '20px', paddingTop: '20px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📊 Hiển thị khi kết ca</h3>

                                    <Toggle
                                        checked={shift?.showDiscrepancyInReconciliation ?? true}
                                        onChange={(v) => updateShiftSettings({ showDiscrepancyInReconciliation: v })}
                                        label="Cho phép xem chênh lệch (thừa/thiếu)"
                                    />
                                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', marginBottom: '12px', paddingLeft: '4px' }}>
                                        Khi tắt, nhân viên không thấy phần đối soát chênh lệch khi kết ca.
                                    </p>

                                    <Toggle
                                        checked={shift?.showRevenueInReconciliation ?? true}
                                        onChange={(v) => updateShiftSettings({ showRevenueInReconciliation: v })}
                                        label="Cho phép xem doanh thu trong ca"
                                    />
                                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', paddingLeft: '4px' }}>
                                        Khi tắt, nhân viên không thấy doanh số bán hàng trong ca. Chênh lệch vẫn có thể ẩn riêng.
                                    </p>
                                </div>

                                <div style={{ marginTop: '20px', textAlign: 'right' }}>
                                    <button
                                        onClick={() => {
                                            updateShiftSettings({ mode: tempShiftMode });
                                            setSaveSuccess(true);
                                            setTimeout(() => setSaveSuccess(false), 2000);
                                        }}
                                        style={{
                                            padding: '10px 24px',
                                            backgroundColor: saveSuccess ? '#22c55e' : '#2563eb',
                                            color: 'white',
                                            borderRadius: '8px',
                                            fontWeight: 600,
                                            border: 'none',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
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
                            <div style={cardStyle}>
                                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#111827' }}>Cảnh báo Tồn kho</h2>

                                <Toggle
                                    checked={stockAlerts.enabled}
                                    onChange={(v) => updateStockAlerts({ enabled: v })}
                                    label="Bật cảnh báo tồn kho thấp"
                                />

                                {stockAlerts.enabled && (
                                    <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '16px', paddingTop: '16px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <div>
                                                <label style={labelStyle}>Ngưỡng tồn kho thấp (mặc định)</label>
                                                <input
                                                    type="number"
                                                    value={stockAlerts.lowStockThreshold}
                                                    onChange={(e) => updateStockAlerts({ lowStockThreshold: Number(e.target.value) })}
                                                    style={inputStyle}
                                                />
                                                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                                                    Cảnh báo khi số lượng ≤ {stockAlerts.lowStockThreshold}
                                                </p>
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Ngưỡng tồn kho nghiêm trọng</label>
                                                <input
                                                    type="number"
                                                    value={stockAlerts.criticalStockThreshold}
                                                    onChange={(e) => updateStockAlerts({ criticalStockThreshold: Number(e.target.value) })}
                                                    style={inputStyle}
                                                />
                                                <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                                                    ⚠️ Cảnh báo đỏ khi số lượng ≤ {stockAlerts.criticalStockThreshold}
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ marginTop: '16px' }}>
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
                                <div style={cardStyle}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>👁️ Xem trước mức cảnh báo</h3>
                                    <div style={{ display: 'flex', gap: '16px' }}>
                                        <div style={{ flex: 1, padding: '16px', backgroundColor: '#fef2f2', borderRadius: '8px', borderLeft: '4px solid #dc2626' }}>
                                            <div style={{ fontWeight: 600, color: '#dc2626' }}>🔴 Nghiêm trọng</div>
                                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>≤ {stockAlerts.criticalStockThreshold}</div>
                                            <div style={{ fontSize: '12px', color: '#991b1b' }}>Cần nhập hàng ngay</div>
                                        </div>
                                        <div style={{ flex: 1, padding: '16px', backgroundColor: '#fef9c3', borderRadius: '8px', borderLeft: '4px solid #ca8a04' }}>
                                            <div style={{ fontWeight: 600, color: '#ca8a04' }}>🟡 Thấp</div>
                                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ca8a04' }}>≤ {stockAlerts.lowStockThreshold}</div>
                                            <div style={{ fontSize: '12px', color: '#854d0e' }}>Nên nhập thêm hàng</div>
                                        </div>
                                        <div style={{ flex: 1, padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px', borderLeft: '4px solid #22c55e' }}>
                                            <div style={{ fontWeight: 600, color: '#22c55e' }}>🟢 Đủ hàng</div>
                                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>&gt; {stockAlerts.lowStockThreshold}</div>
                                            <div style={{ fontSize: '12px', color: '#166534' }}>Tồn kho ổn định</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ==================== NOTIFICATIONS ==================== */}
                    {activeTab === 'notifications' && (
                        <div>
                            <div style={cardStyle}>
                                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: '#111827' }}>Cài đặt Thông báo</h2>
                                <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>Gửi tin nhắn SMS và Email tự động cho khách hàng</p>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                    {/* SMS Settings */}
                                    <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📱 SMS</h3>
                                        <Toggle
                                            checked={notifications.smsEnabled}
                                            onChange={(v) => updateNotifications({ smsEnabled: v })}
                                            label="Bật gửi SMS"
                                        />
                                        {notifications.smsEnabled && (
                                            <div style={{ marginTop: '12px' }}>
                                                <label style={labelStyle}>Nhà cung cấp SMS</label>
                                                <select
                                                    value={notifications.smsProvider}
                                                    onChange={(e) => updateNotifications({ smsProvider: e.target.value as 'esms' | 'speedsms' | 'fpt' | 'none' })}
                                                    style={inputStyle}
                                                >
                                                    <option value="none">-- Chọn --</option>
                                                    <option value="esms">eSMS.vn</option>
                                                    <option value="speedsms">SpeedSMS</option>
                                                    <option value="fpt">FPT SMS</option>
                                                </select>
                                                <div style={{ marginTop: '12px' }}>
                                                    <label style={labelStyle}>API Key</label>
                                                    <input
                                                        type="password"
                                                        value={notifications.smsApiKey || ''}
                                                        onChange={(e) => updateNotifications({ smsApiKey: e.target.value })}
                                                        placeholder="Nhập API Key..."
                                                        style={inputStyle}
                                                    />
                                                </div>
                                                <div style={{ marginTop: '12px' }}>
                                                    <label style={labelStyle}>Sender ID (Brandname)</label>
                                                    <input
                                                        type="text"
                                                        value={notifications.smsSenderId || ''}
                                                        onChange={(e) => updateNotifications({ smsSenderId: e.target.value })}
                                                        placeholder="VD: MYSHOP"
                                                        style={inputStyle}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Email Settings */}
                                    <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📧 Email</h3>
                                        <Toggle
                                            checked={notifications.emailEnabled}
                                            onChange={(v) => updateNotifications({ emailEnabled: v })}
                                            label="Bật gửi Email"
                                        />
                                        {notifications.emailEnabled && (
                                            <div style={{ marginTop: '12px' }}>
                                                <label style={labelStyle}>Nhà cung cấp Email</label>
                                                <select
                                                    value={notifications.emailProvider}
                                                    onChange={(e) => updateNotifications({ emailProvider: e.target.value as 'gmail' | 'sendgrid' | 'mailgun' | 'none' })}
                                                    style={inputStyle}
                                                >
                                                    <option value="none">-- Chọn --</option>
                                                    <option value="gmail">Gmail SMTP</option>
                                                    <option value="sendgrid">SendGrid</option>
                                                    <option value="mailgun">Mailgun</option>
                                                </select>
                                                <div style={{ marginTop: '12px' }}>
                                                    <label style={labelStyle}>API Key / App Password</label>
                                                    <input
                                                        type="password"
                                                        value={notifications.emailApiKey || ''}
                                                        onChange={(e) => updateNotifications({ emailApiKey: e.target.value })}
                                                        placeholder="Nhập API Key..."
                                                        style={inputStyle}
                                                    />
                                                </div>
                                                <div style={{ marginTop: '12px' }}>
                                                    <label style={labelStyle}>Địa chỉ Email gửi</label>
                                                    <input
                                                        type="email"
                                                        value={notifications.emailFrom || ''}
                                                        onChange={(e) => updateNotifications({ emailFrom: e.target.value })}
                                                        placeholder="no-reply@yourshop.com"
                                                        style={inputStyle}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Notification Types */}
                            <div style={cardStyle}>
                                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Loại thông báo</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <Toggle checked={notifications.orderConfirmation} onChange={(v) => updateNotifications({ orderConfirmation: v })} label="Xác nhận đơn hàng" />
                                    <Toggle checked={notifications.shippingUpdate} onChange={(v) => updateNotifications({ shippingUpdate: v })} label="Cập nhật giao hàng" />
                                    <Toggle checked={notifications.birthdayWish} onChange={(v) => updateNotifications({ birthdayWish: v })} label="Chúc mừng sinh nhật" />
                                    <Toggle checked={notifications.loyaltyReminder} onChange={(v) => updateNotifications({ loyaltyReminder: v })} label="Nhắc điểm tích lũy" />
                                    <Toggle checked={notifications.debtReminder} onChange={(v) => updateNotifications({ debtReminder: v })} label="Nhắc công nợ" />
                                    <Toggle checked={notifications.promotionBlast} onChange={(v) => updateNotifications({ promotionBlast: v })} label="Thông báo khuyến mãi" />
                                </div>
                            </div>

                            {/* Message Templates */}
                            <div style={cardStyle}>
                                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Mẫu tin nhắn</h3>
                                <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>
                                    Sử dụng biến: {'{customer_name}'}, {'{order_number}'}, {'{total}'}, {'{store_name}'}, {'{coupon_code}'}, {'{debt_amount}'}, {'{due_date}'}
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div>
                                        <label style={labelStyle}>Xác nhận đơn hàng</label>
                                        <textarea
                                            value={notifications.templates.orderConfirmation}
                                            onChange={(e) => updateNotifications({ templates: { ...notifications.templates, orderConfirmation: e.target.value } })}
                                            style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Sinh nhật</label>
                                        <textarea
                                            value={notifications.templates.birthdayWish}
                                            onChange={(e) => updateNotifications({ templates: { ...notifications.templates, birthdayWish: e.target.value } })}
                                            style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Nhắc công nợ</label>
                                        <textarea
                                            value={notifications.templates.debtReminder}
                                            onChange={(e) => updateNotifications({ templates: { ...notifications.templates, debtReminder: e.target.value } })}
                                            style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==================== DEBT MANAGEMENT ==================== */}
                    {activeTab === 'debt' && (
                        <div>
                            <div style={cardStyle}>
                                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: '#111827' }}>Quản lý Công nợ</h2>
                                <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>Cài đặt hạn mức tín dụng và chính sách công nợ cho khách hàng</p>

                                <Toggle
                                    checked={debt.enabled}
                                    onChange={(v) => updateDebt({ enabled: v })}
                                    label="Bật quản lý công nợ nâng cao"
                                />

                                {debt.enabled && (
                                    <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '16px', paddingTop: '16px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                            <div>
                                                <label style={labelStyle}>Hạn mức mặc định (VNĐ)</label>
                                                <input
                                                    type="number"
                                                    value={debt.defaultCreditLimit}
                                                    onChange={(e) => updateDebt({ defaultCreditLimit: Number(e.target.value) })}
                                                    style={inputStyle}
                                                />
                                                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                                                    = {formatVND(debt.defaultCreditLimit)}
                                                </p>
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Hạn mức tối đa (VNĐ)</label>
                                                <input
                                                    type="number"
                                                    value={debt.maxCreditLimit}
                                                    onChange={(e) => updateDebt({ maxCreditLimit: Number(e.target.value) })}
                                                    style={inputStyle}
                                                />
                                                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                                                    = {formatVND(debt.maxCreditLimit)}
                                                </p>
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Cảnh báo khi đạt (%)</label>
                                                <input
                                                    type="number"
                                                    value={debt.warningThreshold}
                                                    onChange={(e) => updateDebt({ warningThreshold: Number(e.target.value) })}
                                                    style={inputStyle}
                                                />
                                                <p style={{ fontSize: '12px', color: '#ca8a04', marginTop: '4px' }}>
                                                    ⚠️ Cảnh báo khi nợ ≥ {debt.warningThreshold}% hạn mức
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ marginTop: '16px' }}>
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
                                <div style={cardStyle}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Quản lý Nợ quá hạn</h3>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div>
                                            <label style={labelStyle}>Số ngày tính quá hạn</label>
                                            <input
                                                type="number"
                                                value={debt.overdueDays}
                                                onChange={(e) => updateDebt({ overdueDays: Number(e.target.value) })}
                                                style={inputStyle}
                                            />
                                            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                                                Nợ quá {debt.overdueDays} ngày sẽ tính là quá hạn
                                            </p>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Lãi suất quá hạn (%/tháng)</label>
                                            <input
                                                type="number"
                                                value={debt.interestRate}
                                                onChange={(e) => updateDebt({ interestRate: Number(e.target.value) })}
                                                style={inputStyle}
                                                disabled={!debt.applyInterest}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '16px' }}>
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
                                        <div style={{ marginTop: '16px' }}>
                                            <label style={labelStyle}>Ngày gửi nhắc nhở (so với hạn thanh toán)</label>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                {[-7, -3, 0, 3, 7, 14, 30].map((day) => (
                                                    <button
                                                        key={day}
                                                        style={{
                                                            padding: '8px 12px',
                                                            borderRadius: '8px',
                                                            border: debt.reminderDays.includes(day) ? '2px solid #22c55e' : '1px solid #e5e7eb',
                                                            backgroundColor: debt.reminderDays.includes(day) ? '#f0fdf4' : 'white',
                                                            fontWeight: debt.reminderDays.includes(day) ? 600 : 400,
                                                            cursor: 'pointer',
                                                            fontSize: '13px'
                                                        }}
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
                                <div style={cardStyle}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>📊 Ví dụ minh họa</h3>
                                    <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', fontSize: '14px' }}>
                                        <p style={{ marginBottom: '8px' }}>
                                            <strong>Khách hàng A</strong> có hạn mức: <span style={{ color: '#16a34a', fontWeight: 600 }}>{formatVND(debt.defaultCreditLimit)}</span>
                                        </p>
                                        <p style={{ marginBottom: '8px' }}>
                                            Hiện đang nợ: {formatVND(debt.defaultCreditLimit * 0.85)} ({85}% hạn mức)
                                            <span style={{ color: '#dc2626', marginLeft: '8px' }}>⚠️ Cảnh báo</span>
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
                            <div style={cardStyle}>
                                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Tích điểm khách hàng</h2>
                                <Toggle checked={loyalty.enabled} onChange={(v) => updateLoyalty({ enabled: v })} label="Bật tính năng tích điểm" />
                                {loyalty.enabled && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '16px' }}>
                                        <div>
                                            <label style={labelStyle}>VNĐ/1 điểm</label>
                                            <input type="number" value={loyalty.pointsPerAmount} onChange={(e) => updateLoyalty({ pointsPerAmount: Number(e.target.value) })} style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>1 điểm = VNĐ</label>
                                            <input type="number" value={loyalty.redemptionRate} onChange={(e) => updateLoyalty({ redemptionRate: Number(e.target.value) })} style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Tối thiểu để đổi</label>
                                            <input type="number" value={loyalty.minPointsToRedeem} onChange={(e) => updateLoyalty({ minPointsToRedeem: Number(e.target.value) })} style={inputStyle} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ==================== PAYMENT ==================== */}
                    {activeTab === 'payment' && (
                        <div style={cardStyle}>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Phương thức thanh toán</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {paymentMethods.map((method) => (
                                    <div key={method.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: method.enabled ? '#f0fdf4' : '#fafafa' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ fontSize: '20px' }}>{method.icon}</span>
                                            <span style={{ fontWeight: 500 }}>{method.name}</span>
                                        </div>
                                        <Toggle checked={method.enabled} onChange={(v) => updatePaymentMethod(method.id, { enabled: v })} label="" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ==================== RECEIPT ==================== */}
                    {activeTab === 'receipt' && (
                        <div style={cardStyle}>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Cài đặt hóa đơn</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div><label style={labelStyle}>Tên cửa hàng</label><input type="text" value={receipt.storeName} onChange={(e) => updateReceipt({ storeName: e.target.value })} style={inputStyle} /></div>
                                <div><label style={labelStyle}>Số điện thoại</label><input type="text" value={receipt.storePhone} onChange={(e) => updateReceipt({ storePhone: e.target.value })} style={inputStyle} /></div>
                                <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>Địa chỉ</label><input type="text" value={receipt.storeAddress} onChange={(e) => updateReceipt({ storeAddress: e.target.value })} style={inputStyle} /></div>
                                <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>Lời cảm ơn</label><input type="text" value={receipt.footerText} onChange={(e) => updateReceipt({ footerText: e.target.value })} style={inputStyle} /></div>
                                <div><label style={labelStyle}>Khổ giấy</label><select value={receipt.paperWidth} onChange={(e) => updateReceipt({ paperWidth: e.target.value as '58mm' | '80mm' })} style={inputStyle}><option value="58mm">58mm</option><option value="80mm">80mm</option></select></div>
                                <div style={{ paddingTop: '28px' }}><Toggle checked={receipt.showQRCode} onChange={(v) => updateReceipt({ showQRCode: v })} label="Hiển thị QR" /></div>
                            </div>
                        </div>
                    )}


                    {/* ==================== PRINT ==================== */}
                    {activeTab === 'print' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '24px' }}>
                            {/* LEFT COLUMN - Settings */}
                            <div>
                                {/* Store Info with Logo Upload */}
                                <div style={cardStyle}>
                                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>🏪 Thông tin cửa hàng</h2>

                                    {/* Logo Upload */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={labelStyle}>Logo cửa hàng</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{
                                                width: '80px',
                                                height: '80px',
                                                border: '2px dashed #e5e7eb',
                                                borderRadius: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: '#f9fafb',
                                                overflow: 'hidden'
                                            }}>
                                                {printSettings.storeLogo ? (
                                                    <img src={printSettings.storeLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                ) : (
                                                    <span style={{ fontSize: '32px', opacity: 0.3 }}>🏪</span>
                                                )}
                                            </div>
                                            <div>
                                                <input
                                                    ref={logoInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
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
                                                <button
                                                    onClick={() => logoInputRef.current?.click()}
                                                    style={{ ...btnSecondary, marginBottom: '8px' }}
                                                >
                                                    📤 Tải logo lên
                                                </button>
                                                {printSettings.storeLogo && (
                                                    <button
                                                        onClick={() => updatePrintSettings({ storeLogo: undefined })}
                                                        style={{ ...btnSecondary, color: '#dc2626', marginLeft: '8px' }}
                                                    >
                                                        🗑️ Xóa
                                                    </button>
                                                )}
                                                <p style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 0' }}>PNG/JPG, tối đa 500KB</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={labelStyle}>Tên cửa hàng</label>
                                            <input type="text" value={printSettings.storeName} onChange={(e) => updatePrintSettings({ storeName: e.target.value })} style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Số điện thoại</label>
                                            <input type="text" value={printSettings.storePhone} onChange={(e) => updatePrintSettings({ storePhone: e.target.value })} style={inputStyle} />
                                        </div>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label style={labelStyle}>Địa chỉ</label>
                                            <input type="text" value={printSettings.storeAddress} onChange={(e) => updatePrintSettings({ storeAddress: e.target.value })} style={inputStyle} />
                                        </div>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label style={labelStyle}>Lời cảm ơn</label>
                                            <input type="text" value={printSettings.footerText} onChange={(e) => updatePrintSettings({ footerText: e.target.value })} style={inputStyle} />
                                        </div>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label style={labelStyle}>Lưu ý (dưới lời cảm ơn)</label>
                                            <input type="text" value={printSettings.noteText || ''} onChange={(e) => updatePrintSettings({ noteText: e.target.value })} style={inputStyle} placeholder="VD: Hàng đã mua không đổi/trả..." />
                                        </div>
                                    </div>
                                </div>

                                {/* Printer Connection */}
                                <div style={cardStyle}>
                                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>🖨️ Kết nối Máy in</h2>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                        {[
                                            { method: 'driver' as const, icon: '💻', name: 'Driver', desc: 'Máy in đã cài driver' },
                                            { method: 'usb' as const, icon: '🔌', name: 'USB', desc: 'WebUSB trực tiếp' },
                                            { method: 'lan' as const, icon: '🌐', name: 'LAN', desc: 'Mạng nội bộ' },
                                        ].map((p) => (
                                            <div
                                                key={p.method}
                                                onClick={() => updatePrinter({ method: p.method })}
                                                style={{
                                                    padding: '12px',
                                                    borderRadius: '10px',
                                                    border: printSettings.printer.method === p.method ? '2px solid #22c55e' : '1px solid #e5e7eb',
                                                    backgroundColor: printSettings.printer.method === p.method ? '#f0fdf4' : 'white',
                                                    cursor: 'pointer',
                                                    textAlign: 'center'
                                                }}
                                            >
                                                <div style={{ fontSize: '20px' }}>{p.icon}</div>
                                                <div style={{ fontWeight: 600, fontSize: '13px' }}>{p.name}</div>
                                                <div style={{ fontSize: '10px', color: '#6b7280' }}>{p.desc}</div>
                                            </div>
                                        ))}
                                    </div>
                                    {printSettings.printer.method === 'lan' && (
                                        <div style={{ marginTop: '12px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                                <input type="text" placeholder="IP: 192.168.1.200" value={printSettings.printer.lanIp} onChange={(e) => updatePrinter({ lanIp: e.target.value })} style={inputStyle} />
                                                <input type="text" placeholder="Port: 9100" value={printSettings.printer.lanPort} onChange={(e) => updatePrinter({ lanPort: e.target.value })} style={inputStyle} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => {
                                                        alert(`Đang kết nối tới ${printSettings.printer.lanIp}:${printSettings.printer.lanPort}...`);
                                                        // TODO: Implement actual LAN connection test
                                                    }}
                                                    style={{ ...btnSecondary, flex: 1 }}
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
                                                    style={{ ...btnSecondary, flex: 1 }}
                                                >
                                                    🖨️ In thử
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Template Selector */}
                                <div style={cardStyle}>
                                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>📋 Chọn mẫu phiếu để cấu hình</h2>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                        {[
                                            { key: 'sales_receipt' as PrintTemplateType, icon: '🧾', name: 'Hóa đơn' },
                                            { key: 'cash_voucher' as PrintTemplateType, icon: '💵', name: 'Phiếu chi' },
                                            { key: 'purchase_receipt' as PrintTemplateType, icon: '📥', name: 'Nhập hàng' },
                                            { key: 'stock_check' as PrintTemplateType, icon: '📊', name: 'Kiểm kho' },
                                            { key: 'return_receipt' as PrintTemplateType, icon: '↩️', name: 'Đổi/trả' },
                                            { key: 'order_form' as PrintTemplateType, icon: '📝', name: 'Đặt hàng' },
                                            { key: 'transfer_receipt' as PrintTemplateType, icon: '🔄', name: 'Chuyển kho' },
                                            { key: 'transfer_receipt' as PrintTemplateType, icon: '🔄', name: 'Chuyển kho' },
                                            { key: 'supplier_return' as PrintTemplateType, icon: '📤', name: 'Trả NCC' },
                                            { key: 'barcode_label' as PrintTemplateType, icon: '🏷️', name: 'Tem Mã Vạch' },
                                        ].map((t) => (
                                            <div
                                                key={t.key}
                                                onClick={() => setSelectedTemplate(t.key)}
                                                style={{
                                                    padding: '10px 8px',
                                                    borderRadius: '8px',
                                                    border: selectedTemplate === t.key ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                                                    backgroundColor: selectedTemplate === t.key ? '#eff6ff' : '#f9fafb',
                                                    cursor: 'pointer',
                                                    textAlign: 'center'
                                                }}
                                            >
                                                <div style={{ fontSize: '18px' }}>{t.icon}</div>
                                                <div style={{ fontSize: '11px', fontWeight: 500, marginTop: '2px' }}>{t.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Template Config based on selection */}
                                <div style={cardStyle}>
                                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
                                        ⚙️ Cấu hình: {selectedTemplate === 'sales_receipt' ? 'Hóa đơn bán hàng' :
                                            selectedTemplate === 'cash_voucher' ? 'Phiếu chi' :
                                                selectedTemplate === 'purchase_receipt' ? 'Phiếu nhập hàng' :
                                                    selectedTemplate === 'barcode_label' ? 'Tem mã vạch' : selectedTemplate}
                                    </h2>
                                </div>
                                {/* Barcode Label Config UI */}
                                {selectedTemplate === 'barcode_label' ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={labelStyle}>Khổ giấy (mm)</label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input
                                                    type="number"
                                                    value={labelConfig.paperWidth}
                                                    onChange={(e) => updateLabelConfig({ paperWidth: Number(e.target.value) })}
                                                    style={inputStyle}
                                                    placeholder="Rộng"
                                                />
                                                <input
                                                    type="number"
                                                    value={labelConfig.labelHeight}
                                                    onChange={(e) => updateLabelConfig({ labelHeight: Number(e.target.value) })}
                                                    style={inputStyle}
                                                    placeholder="Cao"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Cỡ chữ (px)</label>
                                            <input
                                                type="number"
                                                value={labelConfig.fontSize}
                                                onChange={(e) => updateLabelConfig({ fontSize: Number(e.target.value) })}
                                                style={inputStyle}
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Số cột tem (ngang)</label>
                                            <select
                                                value={labelConfig.cols}
                                                onChange={(e) => updateLabelConfig({ cols: Number(e.target.value) as 1 | 2 | 3 })}
                                                style={inputStyle}
                                            >
                                                <option value={1}>1 Tem/Hàng</option>
                                                <option value={2}>2 Tem/Hàng</option>
                                                <option value={3}>3 Tem/Hàng</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Căn lề</label>
                                            <select
                                                value={labelConfig.textAlign}
                                                onChange={(e) => updateLabelConfig({ textAlign: e.target.value as 'center' | 'left' })}
                                                style={inputStyle}
                                            >
                                                <option value="center">Giữa</option>
                                                <option value="left">Trái</option>
                                            </select>
                                        </div>
                                        <div style={{ gridColumn: 'span 2', marginTop: '8px' }}>
                                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
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
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div>
                                                <label style={labelStyle}>Khổ giấy</label>
                                                <select
                                                    value={printSettings.templates[selectedTemplate]?.paperWidth || '80mm'}
                                                    onChange={(e) => updatePrintTemplate(selectedTemplate, { paperWidth: e.target.value as any })}
                                                    style={inputStyle}
                                                >
                                                    <option value="58mm">K57 (58mm)</option>
                                                    <option value="80mm">K80 (80mm)</option>
                                                    <option value="A5">A5</option>
                                                    <option value="A4">A4</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Số bản in</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={5}
                                                    value={printSettings.templates[selectedTemplate]?.copies || 1}
                                                    onChange={(e) => updatePrintTemplate(selectedTemplate, { copies: Number(e.target.value) })}
                                                    style={inputStyle}
                                                />
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '12px' }}>
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
                                            {/* Sales Receipt specific toggles */}
                                            {selectedTemplate === 'sales_receipt' && (
                                                <>
                                                    <Toggle
                                                        checked={(printSettings.templates.sales_receipt as any)?.showStoreName ?? true}
                                                        onChange={(v) => updatePrintTemplate('sales_receipt', { showStoreName: v } as any)}
                                                        label="Hiển thị tên cửa hàng"
                                                    />
                                                    <Toggle
                                                        checked={(printSettings.templates.sales_receipt as any)?.showPrice ?? true}
                                                        onChange={(v) => updatePrintTemplate('sales_receipt', { showPrice: v } as any)}
                                                        label="Hiển thị giá"
                                                    />
                                                    <Toggle
                                                        checked={printSettings.templates.sales_receipt?.showCustomerInfo ?? true}
                                                        onChange={(v) => updatePrintTemplate('sales_receipt', { showCustomerInfo: v } as any)}
                                                        label="Hiển thị thông tin khách hàng"
                                                    />
                                                    <Toggle
                                                        checked={printSettings.templates.sales_receipt?.showPaymentDetails ?? true}
                                                        onChange={(v) => updatePrintTemplate('sales_receipt', { showPaymentDetails: v } as any)}
                                                        label="Hiển thị chi tiết thanh toán"
                                                    />
                                                    <Toggle
                                                        checked={printSettings.templates.sales_receipt?.showPointsEarned ?? true}
                                                        onChange={(v) => updatePrintTemplate('sales_receipt', { showPointsEarned: v } as any)}
                                                        label="Hiển thị điểm tích lũy"
                                                    />
                                                    <div style={{ marginTop: '12px' }}>
                                                        <label style={labelStyle}>Vị trí logo</label>
                                                        <select
                                                            value={(printSettings.templates.sales_receipt as any)?.logoPosition || 'center'}
                                                            onChange={(e) => updatePrintTemplate('sales_receipt', { logoPosition: e.target.value } as any)}
                                                            style={inputStyle}
                                                        >
                                                            <option value="left">Góc trái</option>
                                                            <option value="center">Căn giữa</option>
                                                            <option value="right">Góc phải</option>
                                                        </select>
                                                    </div>
                                                    <div style={{ marginTop: '12px' }}>
                                                        <label style={labelStyle}>Kích thước logo ({printSettings.logoSize || 80}px)</label>
                                                        <input
                                                            type="range"
                                                            min="40"
                                                            max="150"
                                                            value={printSettings.logoSize || 80}
                                                            onChange={(e) => updatePrintSettings({ logoSize: Number(e.target.value) })}
                                                            style={{ width: '100%' }}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* RIGHT COLUMN - Preview */}
                            <div style={{ position: 'sticky', top: '24px', height: 'fit-content' }}>
                                <div style={{ ...cardStyle, padding: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>👁️ Xem trước</h3>
                                        <span style={{ fontSize: '12px', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '4px 8px', borderRadius: '6px' }}>
                                            {printSettings.templates[selectedTemplate]?.paperWidth || '80mm'}
                                        </span>
                                    </div>

                                    {/* Preview Container */}
                                    <div style={{
                                        backgroundColor: '#64748b',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        maxHeight: '600px',
                                        overflow: 'auto'
                                    }}>
                                        <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
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
                                        style={{ fontSize: '11px', color: '#3b82f6', textAlign: 'center', marginTop: '8px', cursor: 'pointer' }}
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
                                        style={{
                                            width: '100%',
                                            marginTop: '12px',
                                            padding: '12px',
                                            backgroundColor: isPrinting ? '#9ca3af' : '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '10px',
                                            fontWeight: 600,
                                            fontSize: '14px',
                                            cursor: isPrinting ? 'wait' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        🖨️ {isPrinting ? 'Đang in...' : 'In thử'}
                                    </button>

                                    <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginTop: '8px' }}>
                                        In trang test để kiểm tra kết nối máy in
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Fullscreen Preview Modal */}
                    {showPreviewModal && (
                        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', overflow: 'auto' }} onClick={() => setShowPreviewModal(false)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '500px', marginBottom: '16px' }}>
                                <h2 style={{ color: 'white', fontWeight: 'bold', fontSize: '18px', margin: 0 }}>👁️ Xem trước chi tiết</h2>
                                <button onClick={() => setShowPreviewModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>✕ Đóng</button>
                            </div>
                            <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', padding: '20px', maxWidth: '100%', overflow: 'auto', maxHeight: '85vh' }}>
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
                            <div style={cardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <div>
                                        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>Phương thức thanh toán</h2>
                                        <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Quản lý các phương thức thanh toán hiển thị tại POS</p>
                                    </div>
                                    <button
                                        style={btnPrimary}
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

                                <div style={{ backgroundColor: '#f0fdf4', padding: '16px', borderRadius: '12px', marginBottom: '16px', border: '1px solid #bbf7d0' }}>
                                    <label style={{ ...labelStyle, marginBottom: '8px', color: '#166534' }}>Phương thức mặc định khi mở POS</label>
                                    <select
                                        value={defaultPaymentMethod}
                                        onChange={(e) => setDefaultPaymentMethod(e.target.value)}
                                        style={{ ...inputStyle, backgroundColor: 'white' }}
                                    >
                                        {paymentMethods.filter(m => m.enabled).map(m => (
                                            <option key={m.id} value={m.id}>{m.icon} {m.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Payment Methods List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {[...paymentMethods].sort((a, b) => a.sortOrder - b.sortOrder).map((method, index) => (
                                        <div
                                            key={method.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '12px 16px',
                                                backgroundColor: method.enabled ? '#ffffff' : '#f9fafb',
                                                borderRadius: '12px',
                                                border: `1px solid ${method.enabled ? '#e5e7eb' : '#f3f4f6'}`,
                                                opacity: method.enabled ? 1 : 0.6
                                            }}
                                        >
                                            {/* Order Number */}
                                            <div style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '6px',
                                                backgroundColor: '#f3f4f6',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                color: '#9ca3af'
                                            }}>
                                                {index + 1}
                                            </div>

                                            {/* Icon */}
                                            <span style={{ fontSize: '24px' }}>
                                                {method.iconType === 'url' ? (
                                                    <img src={method.icon} alt={method.name} style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
                                                ) : method.icon}
                                            </span>

                                            {/* Name */}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, color: '#111827' }}>{method.name}</div>
                                                {method.isSystem && (
                                                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>Hệ thống</span>
                                                )}
                                            </div>

                                            {/* Default Badge */}
                                            {defaultPaymentMethod === method.id && (
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    color: '#166534',
                                                    backgroundColor: '#dcfce7',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px'
                                                }}>
                                                    Mặc định
                                                </span>
                                            )}

                                            {/* Move Buttons */}
                                            <div style={{ display: 'flex', gap: '4px' }}>
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
                                                    style={{
                                                        ...btnSecondary,
                                                        padding: '4px 8px',
                                                        opacity: index === 0 ? 0.5 : 1
                                                    }}
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
                                                    style={{
                                                        ...btnSecondary,
                                                        padding: '4px 8px',
                                                        opacity: index === paymentMethods.length - 1 ? 0.5 : 1
                                                    }}
                                                >
                                                    ↓
                                                </button>
                                            </div>

                                            {/* Toggle Enabled */}
                                            <button
                                                onClick={() => updatePaymentMethod(method.id, { enabled: !method.enabled })}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontWeight: 500,
                                                    fontSize: '12px',
                                                    backgroundColor: method.enabled ? '#dcfce7' : '#f3f4f6',
                                                    color: method.enabled ? '#166534' : '#6b7280'
                                                }}
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
                                                    style={{
                                                        padding: '6px 10px',
                                                        borderRadius: '8px',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        backgroundColor: '#fee2e2',
                                                        color: '#dc2626',
                                                        fontSize: '12px'
                                                    }}
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
                    {activeTab === 'permissions' && (
                        <div>
                            <div style={{ ...cardStyle, border: 'none', background: 'transparent', boxShadow: 'none', padding: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <div>
                                        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#111827', marginBottom: '8px', letterSpacing: '-0.5px' }}>Phân quyền & Vai trò</h2>
                                        <p style={{ color: '#6b7280', fontSize: '15px' }}>Quản lý các vai trò và quyền hạn tương ứng của nhân viên trong hệ thống.</p>
                                    </div>
                                    <button
                                        style={{
                                            ...btnPrimary,
                                            padding: '12px 24px',
                                            fontSize: '14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            boxShadow: '0 4px 6px -1px rgba(34, 197, 94, 0.4), 0 2px 4px -1px rgba(34, 197, 94, 0.2)',
                                            backgroundImage: 'linear-gradient(to right, #22c55e, #16a34a)'
                                        }}
                                        onClick={() => { setEditingRole(null); setShowRoleModal(true); }}
                                    >
                                        <span style={{ fontSize: '18px' }}>+</span> Thêm vai trò mới
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                                    {(roles || []).map(role => (
                                        <div key={role.id} style={{
                                            padding: '24px',
                                            backgroundColor: 'white',
                                            borderRadius: '20px',
                                            border: '1px solid #f3f4f6',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            transition: 'all 0.3s ease',
                                            cursor: 'default',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-4px)';
                                                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                                                e.currentTarget.style.borderColor = '#dcfce7';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)';
                                                e.currentTarget.style.borderColor = '#f3f4f6';
                                            }}
                                        >
                                            <div style={{
                                                position: 'absolute', top: 0, left: 0, width: '100%', height: '6px',
                                                background: role.id === 'admin-role' ? 'linear-gradient(to right, #3b82f6, #2563eb)' : 'linear-gradient(to right, #22c55e, #16a34a)'
                                            }} />

                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                                                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>{role.name}</h3>
                                                    {role.is_system && (
                                                        <span style={{
                                                            fontSize: '11px', padding: '4px 10px', borderRadius: '20px',
                                                            backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: 700,
                                                            border: '1px solid #dbeafe', letterSpacing: '0.5px'
                                                        }}>
                                                            SYSTEM
                                                        </span>
                                                    )}
                                                </div>
                                                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>
                                                    {role.description || 'Không có mô tả cho vai trò này.'}
                                                </p>

                                                <div style={{
                                                    fontSize: '13px', color: '#374151',
                                                    backgroundColor: '#f9fafb', padding: '12px 16px', borderRadius: '12px',
                                                    border: '1px dashed #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px'
                                                }}>
                                                    <span style={{ fontSize: '16px' }}>🔐</span>
                                                    <strong>Quyền hạn:</strong>
                                                    <span style={{ color: role.id === 'admin-role' ? '#2563eb' : '#059669', fontWeight: 600 }}>
                                                        {role.id === 'admin-role' ? 'Toàn quyền (Full Access)' : `${role.permissions?.length || 0} quyền được cấp`}
                                                    </span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f3f4f6' }}>
                                                {!role.is_system && (
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm('Bạn có chắc chắn muốn xóa vai trò này?')) {
                                                                deleteRole(role.id);
                                                            }
                                                        }}
                                                        style={{ ...btnSecondary, color: '#ef4444', borderColor: '#fee2e2', backgroundColor: '#fff1f2', transition: 'all 0.2s' }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff1f2'; }}
                                                    >
                                                        Xóa
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => { setEditingRole(role); setShowRoleModal(true); }}
                                                    style={{ ...btnSecondary, backgroundColor: 'white', borderColor: '#e5e7eb', transition: 'all 0.2s' }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = 'white'; }}
                                                >
                                                    {role.is_system && role.id === 'admin-role' ? 'Xem chi tiết' : 'Chỉnh sửa'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>{role ? 'Sửa vai trò' : 'Thêm vai trò mới'}</h2>
                    <button onClick={onClose} style={{ fontSize: '24px', border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}>✕</button>
                </div>

                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>Tên vai trò *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            disabled={isSystemAdmin}
                            placeholder="VD: Quản lý kho"
                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                        />
                    </div>
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>Mô tả</label>
                        <input
                            type="text"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            disabled={isSystemAdmin}
                            placeholder="Mô tả ngắn về vai trò này"
                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                        />
                    </div>

                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>Phân quyền chi tiết</h3>

                    {isSystemAdmin && (
                        <div style={{ padding: '12px', backgroundColor: '#fef3c7', borderRadius: '8px', marginBottom: '16px', color: '#92400e', fontSize: '14px' }}>
                            🔒 Vai trò Admin có toàn quyền hệ thống và không thể chỉnh sửa.
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                        {PERMISSION_GROUPS.map(group => {
                            const groupPerms = group.permissions.map(p => p.code);
                            const selectedCount = groupPerms.filter(c => formData.permissions.includes(c)).length;
                            const allSelected = selectedCount === groupPerms.length;

                            return (
                                <div key={group.name} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                                    <div style={{ padding: '10px 12px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                                            <input
                                                type="checkbox"
                                                checked={allSelected}
                                                disabled={isSystemAdmin}
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
                                    <div style={{ padding: '8px 12px' }}>
                                        {group.permissions.map(perm => (
                                            <label key={perm.code} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', fontSize: '14px', cursor: isSystemAdmin ? 'not-allowed' : 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.permissions.includes(perm.code)}
                                                    disabled={isSystemAdmin}
                                                    onChange={() => togglePermission(perm.code)}
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

                <div style={{ padding: '20px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', fontWeight: 500, cursor: 'pointer' }}>Hủy</button>
                    {!isSystemAdmin && (
                        <button onClick={() => onSave(formData)} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#22c55e', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Lưu thay đổi</button>
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

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '10px 14px', borderRadius: '8px',
        border: '1px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box'
    };

    const labelStyle: React.CSSProperties = {
        display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px'
    };

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

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
            <div style={{
                backgroundColor: 'white', borderRadius: '16px', width: '500px', maxHeight: '90vh',
                overflow: 'auto', padding: '24px'
            }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>
                    {promotion ? 'Sửa khuyến mãi' : 'Thêm khuyến mãi mới'}
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={labelStyle}>Tên khuyến mãi</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="VD: Giảm 10% tất cả sản phẩm"
                            style={inputStyle}
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Loại khuyến mãi</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value as PromotionType })}
                            style={inputStyle}
                        >
                            <option value="percentage">% Giảm giá</option>
                            <option value="fixed_amount">Giảm số tiền cố định</option>
                            <option value="buy_x_get_y">Mua X tặng Y</option>
                            <option value="happy_hour">Happy Hour</option>
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={labelStyle}>Ngày bắt đầu</label>
                            <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Ngày kết thúc</label>
                            <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} style={inputStyle} />
                        </div>
                    </div>

                    {(formData.type === 'percentage' || formData.type === 'fixed_amount' || formData.type === 'happy_hour') && (
                        <div>
                            <label style={labelStyle}>
                                {formData.type === 'percentage' ? 'Phần trăm giảm (%)' : 'Số tiền giảm (VNĐ)'}
                            </label>
                            <input
                                type="number"
                                value={formData.discountValue}
                                onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                                style={inputStyle}
                            />
                        </div>
                    )}

                    {formData.type === 'buy_x_get_y' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={labelStyle}>Mua số lượng</label>
                                <input type="number" value={formData.buyQuantity} onChange={(e) => setFormData({ ...formData, buyQuantity: Number(e.target.value) })} style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Tặng số lượng</label>
                                <input type="number" value={formData.getQuantity} onChange={(e) => setFormData({ ...formData, getQuantity: Number(e.target.value) })} style={inputStyle} />
                            </div>
                        </div>
                    )}

                    {formData.type === 'happy_hour' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={labelStyle}>Giờ bắt đầu</label>
                                <input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Giờ kết thúc</label>
                                <input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} style={inputStyle} />
                            </div>
                        </div>
                    )}

                    <div>
                        <label style={labelStyle}>Mã giảm giá (tuỳ chọn)</label>
                        <input
                            type="text"
                            value={formData.couponCode}
                            onChange={(e) => setFormData({ ...formData, couponCode: e.target.value.toUpperCase() })}
                            placeholder="VD: GIAM10"
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={labelStyle}>Đơn tối thiểu (VNĐ)</label>
                            <input type="number" value={formData.minPurchase} onChange={(e) => setFormData({ ...formData, minPurchase: Number(e.target.value) })} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Giảm tối đa (VNĐ, 0=không giới hạn)</label>
                            <input type="number" value={formData.maxDiscount} onChange={(e) => setFormData({ ...formData, maxDiscount: Number(e.target.value) })} style={inputStyle} />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '8px', fontWeight: 500, cursor: 'pointer' }}>
                        Hủy
                    </button>
                    <button onClick={handleSave} style={{ padding: '10px 20px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                        {promotion ? 'Cập nhật' : 'Tạo khuyến mãi'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SettingsPage;
