// =============================================================================
// BRANCHES PAGE - Multi-Branch Management
// =============================================================================

import { useState, useEffect } from 'react';
import { useBranchStore, type Branch } from '@/stores/branchStore';
import { useBrandStore } from '@/stores/brandStore';
import { useAuthStore } from '@/stores/authStore';
import { useStockTransferStore, type StockTransfer } from '@/stores/stockTransferStore';
import { useProductStore } from '@/stores/productStore';
import type { Product } from '@/types';

export function BranchesPage() {
    const {
        branches, currentBranch, isLoading, error,
        createBranch, updateBranch, deleteBranch, setCurrentBranch, fetchBranches,
    } = useBranchStore();

    const { currentBrand, fetchCurrentBrand } = useBrandStore();
    const brandId = currentBrand?.id;

    // Stock transfers store
    const {
        transfers: stockTransfers,
        isLoading: transfersLoading,
        fetchTransfers,
        createTransfer,
        shipTransfer,
        completeTransfer,
        cancelTransfer
    } = useStockTransferStore();

    // Products for transfer picker
    const { products, loadProducts } = useProductStore();

    // Fetch branches on mount
    useEffect(() => {
        if (!currentBrand) {
            fetchCurrentBrand();
        }
    }, []);

    useEffect(() => {
        if (brandId) {
            fetchBranches(brandId);
            fetchTransfers(brandId);
            loadProducts();
        }
    }, [brandId]);

    // Compatibility adaptors
    const currentBranchId = currentBranch?.id;

    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'list' | 'transfers'>('list');
    const [showModal, setShowModal] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

    const isAdmin = ['admin', 'owner', 'manager'].includes(user?.role || '');
    const activeBranches = branches.filter(b => b.status === 'active');
    const pendingTransfers = stockTransfers.filter(t => t.status === 'pending' || t.status === 'in_transit');


    // Styles
    const cardStyle: React.CSSProperties = {
        backgroundColor: 'white',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        padding: '24px',
        marginBottom: '16px'
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '12px 16px',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: '14px',
        fontWeight: 500,
        color: '#374151',
        marginBottom: '8px'
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

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            {/* Header */}
            <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>🏪 Quản lý Chi nhánh</h1>
                        <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
                            Đang làm việc tại: <strong>{branches.find(b => b.id === currentBranchId)?.name || 'Chưa chọn'}</strong>
                        </p>
                    </div>
                    {isAdmin && (
                        <button
                            style={btnPrimary}
                            onClick={() => { setEditingBranch(null); setShowModal(true); }}
                        >
                            + Thêm chi nhánh
                        </button>
                    )}
                </div>
            </header>

            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                    <button
                        onClick={() => setActiveTab('list')}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: activeTab === 'list' ? '#22c55e' : '#f3f4f6',
                            color: activeTab === 'list' ? 'white' : '#374151',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        📋 Danh sách chi nhánh ({activeBranches.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('transfers')}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: activeTab === 'transfers' ? '#22c55e' : '#f3f4f6',
                            color: activeTab === 'transfers' ? 'white' : '#374151',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        🚚 Chuyển hàng ({stockTransfers.filter(t => t.status === 'pending' || t.status === 'in_transit').length})
                    </button>
                </div>

                {/* Error Banner */}
                {error && (
                    <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #fecaca' }}>
                        ⚠️ Lỗi: {error}
                    </div>
                )}

                {/* DEBUG DIAGNOSTIC PANEL */}
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #f59e0b', padding: '15px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', color: '#92400e' }}>
                    <h3 style={{ fontWeight: 'bold', margin: '0 0 5px 0' }}>🔧 Thông tin kiểm tra lỗi (Debug Info)</h3>
                    <div><strong>User ID:</strong> {user?.id || 'Chưa đăng nhập'}</div>
                    <div><strong>Role:</strong> {user?.role || 'Không có'}</div>
                    <div><strong>Brand ID:</strong> {brandId ? brandId : <span style={{ color: 'red', fontWeight: 'bold' }}>TRỐNG (NULL) - Nguyên nhân lỗi là đây!</span>}</div>
                    <div><strong>Store Error:</strong> {error || 'Không có lỗi'}</div>
                    {!brandId && <div style={{ marginTop: '10px', fontWeight: 'bold', color: 'red' }}>⚠️ CẢNH BÁO: Bạn chưa được liên kết với Thương hiệu nào. Vui lòng liên hệ Admin hệ thống hoặc thử đăng nhập lại.</div>}
                </div>

                {/* Branch List */}
                {activeTab === 'list' && (
                    <div>
                        {/* Loading State */}
                        {isLoading && (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                                ⏳ Đang tải danh sách chi nhánh...
                            </div>
                        )}

                        {/* Empty State */}
                        {!isLoading && activeBranches.length === 0 && (
                            <div style={{
                                textAlign: 'center', padding: '60px 20px',
                                backgroundColor: 'white', borderRadius: '20px',
                                border: '2px dashed #e5e7eb'
                            }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏪</div>
                                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
                                    Chưa có chi nhánh nào
                                </h3>
                                <p style={{ color: '#6b7280', marginBottom: '20px' }}>
                                    Thêm chi nhánh đầu tiên để bắt đầu quản lý chuỗi cửa hàng
                                </p>
                                {isAdmin && (
                                    <button
                                        style={btnPrimary}
                                        onClick={() => { setEditingBranch(null); setShowModal(true); }}
                                    >
                                        + Thêm chi nhánh đầu tiên
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Branch Cards Grid */}
                        {activeBranches.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
                                {activeBranches.map((branch) => {
                                    const isSelected = branch.id === currentBranchId;
                                    return (
                                        <div
                                            key={branch.id}
                                            style={{
                                                background: isSelected
                                                    ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
                                                    : 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
                                                borderRadius: '20px',
                                                border: isSelected ? '2px solid #22c55e' : '1px solid #e5e7eb',
                                                padding: '24px',
                                                boxShadow: isSelected
                                                    ? '0 10px 40px rgba(34, 197, 94, 0.15)'
                                                    : '0 4px 20px rgba(0, 0, 0, 0.05)',
                                                transition: 'all 0.3s ease',
                                                position: 'relative' as const,
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {/* Header */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                                        <span style={{
                                                            fontSize: '20px',
                                                            fontWeight: 700,
                                                            color: '#111827',
                                                            letterSpacing: '-0.5px'
                                                        }}>
                                                            {branch.name}
                                                        </span>
                                                        {branch.code && (
                                                            <span style={{
                                                                padding: '3px 10px',
                                                                backgroundColor: '#f3f4f6',
                                                                color: '#6b7280',
                                                                borderRadius: '8px',
                                                                fontSize: '12px',
                                                                fontWeight: 600,
                                                                fontFamily: 'monospace'
                                                            }}>
                                                                #{branch.code}
                                                            </span>
                                                        )}
                                                        {branch.is_headquarters && (
                                                            <span style={{
                                                                padding: '3px 10px',
                                                                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                                                color: 'white',
                                                                borderRadius: '8px',
                                                                fontSize: '11px',
                                                                fontWeight: 700,
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.5px'
                                                            }}>
                                                                ⭐ Trụ sở chính
                                                            </span>
                                                        )}
                                                    </div>

                                                    {isSelected && (
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            padding: '5px 14px',
                                                            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                                            color: 'white',
                                                            borderRadius: '20px',
                                                            fontSize: '12px',
                                                            fontWeight: 700
                                                        }}>
                                                            ✓ Đang làm việc tại đây
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Info Section */}
                                            <div style={{
                                                backgroundColor: 'rgba(255,255,255,0.7)',
                                                borderRadius: '12px',
                                                padding: '16px',
                                                marginBottom: '16px'
                                            }}>
                                                {branch.address && (
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px', fontSize: '14px' }}>
                                                        <span style={{ fontSize: '16px' }}>📍</span>
                                                        <span style={{ color: '#374151', lineHeight: 1.5 }}>{branch.address}</span>
                                                    </div>
                                                )}
                                                {branch.phone && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', fontSize: '14px' }}>
                                                        <span style={{ fontSize: '16px' }}>📞</span>
                                                        <span style={{ color: '#374151', fontWeight: 500 }}>{branch.phone}</span>
                                                    </div>
                                                )}
                                                {branch.email && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
                                                        <span style={{ fontSize: '16px' }}>✉️</span>
                                                        <span style={{ color: '#374151' }}>{branch.email}</span>
                                                    </div>
                                                )}
                                                {!branch.address && !branch.phone && !branch.email && (
                                                    <div style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' }}>
                                                        Chưa có thông tin liên hệ
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                {!isSelected && (
                                                    <button
                                                        style={{
                                                            flex: 1,
                                                            padding: '12px 20px',
                                                            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '12px',
                                                            fontWeight: 700,
                                                            fontSize: '14px',
                                                            cursor: 'pointer',
                                                            boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                        onClick={() => setCurrentBranch(branch)}
                                                    >
                                                        🔄 Chuyển sang chi nhánh này
                                                    </button>
                                                )}
                                                {isAdmin && (
                                                    <>
                                                        <button
                                                            style={{
                                                                padding: '12px 18px',
                                                                backgroundColor: 'white',
                                                                color: '#374151',
                                                                border: '1px solid #e5e7eb',
                                                                borderRadius: '12px',
                                                                fontWeight: 600,
                                                                fontSize: '14px',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                            onClick={() => { setEditingBranch(branch); setShowModal(true); }}
                                                        >
                                                            ✏️ Sửa
                                                        </button>
                                                        {!branch.is_headquarters && (
                                                            <button
                                                                style={{
                                                                    padding: '12px 18px',
                                                                    backgroundColor: '#fef2f2',
                                                                    color: '#dc2626',
                                                                    border: '1px solid #fecaca',
                                                                    borderRadius: '12px',
                                                                    fontWeight: 600,
                                                                    fontSize: '14px',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s ease'
                                                                }}
                                                                onClick={() => {
                                                                    if (confirm(`Xóa chi nhánh "${branch.name}"?`)) {
                                                                        deleteBranch(branch.id);
                                                                    }
                                                                }}
                                                            >
                                                                🗑️ Xóa
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Transfers Tab */}
                {activeTab === 'transfers' && (
                    <div>
                        {/* Header with Add Button */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                                Danh sách phiếu chuyển hàng
                            </h2>
                            {isAdmin && (
                                <button
                                    style={{
                                        padding: '10px 20px',
                                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)'
                                    }}
                                    onClick={() => setShowTransferModal(true)}
                                >
                                    + Tạo phiếu chuyển
                                </button>
                            )}
                        </div>

                        {/* Loading State */}
                        {transfersLoading && (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                                ⏳ Đang tải danh sách phiếu chuyển...
                            </div>
                        )}

                        {/* Empty State */}
                        {!transfersLoading && stockTransfers.length === 0 && (
                            <div style={{
                                textAlign: 'center', padding: '60px 20px',
                                backgroundColor: 'white', borderRadius: '20px',
                                border: '2px dashed #e5e7eb'
                            }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚚</div>
                                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
                                    Chưa có phiếu chuyển nào
                                </h3>
                                <p style={{ color: '#6b7280', marginBottom: '20px' }}>
                                    Tạo phiếu chuyển hàng để điều phối tồn kho giữa các chi nhánh
                                </p>
                                {isAdmin && (
                                    <button
                                        style={{
                                            padding: '10px 20px',
                                            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => setShowTransferModal(true)}
                                    >
                                        + Tạo phiếu chuyển đầu tiên
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Transfers List */}
                        {!transfersLoading && stockTransfers.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {stockTransfers.map((transfer) => {
                                    const statusColors: Record<string, { bg: string; color: string; label: string }> = {
                                        pending: { bg: '#fef3c7', color: '#d97706', label: '⏳ Chờ xuất kho' },
                                        in_transit: { bg: '#dbeafe', color: '#2563eb', label: '🚚 Đang vận chuyển' },
                                        completed: { bg: '#dcfce7', color: '#16a34a', label: '✅ Đã hoàn thành' },
                                        cancelled: { bg: '#fee2e2', color: '#dc2626', label: '❌ Đã hủy' }
                                    };
                                    const status = statusColors[transfer.status] || statusColors.pending;

                                    return (
                                        <div
                                            key={transfer.id}
                                            style={{
                                                backgroundColor: 'white',
                                                borderRadius: '16px',
                                                border: '1px solid #e5e7eb',
                                                padding: '20px',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                                            }}
                                        >
                                            {/* Header */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                                        <span style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                                                            {transfer.transfer_code}
                                                        </span>
                                                        <span style={{
                                                            padding: '4px 10px',
                                                            backgroundColor: status.bg,
                                                            color: status.color,
                                                            borderRadius: '6px',
                                                            fontSize: '12px',
                                                            fontWeight: 600
                                                        }}>
                                                            {status.label}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                                                        {new Date(transfer.created_at).toLocaleDateString('vi-VN', {
                                                            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Route */}
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '12px',
                                                padding: '12px', backgroundColor: '#f9fafb', borderRadius: '10px', marginBottom: '12px'
                                            }}>
                                                <div style={{ flex: 1, textAlign: 'center' }}>
                                                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Từ</div>
                                                    <div style={{ fontWeight: 600, color: '#111827' }}>
                                                        {transfer.from_branch?.name || 'Chi nhánh nguồn'}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '24px' }}>→</div>
                                                <div style={{ flex: 1, textAlign: 'center' }}>
                                                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Đến</div>
                                                    <div style={{ fontWeight: 600, color: '#111827' }}>
                                                        {transfer.to_branch?.name || 'Chi nhánh đích'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Items Summary */}
                                            <div style={{ fontSize: '14px', color: '#374151', marginBottom: '16px' }}>
                                                📦 {transfer.items?.length || 0} sản phẩm
                                                {transfer.notes && <span style={{ marginLeft: '12px', color: '#6b7280' }}>• {transfer.notes}</span>}
                                            </div>

                                            {/* Actions */}
                                            {isAdmin && (transfer.status === 'pending' || transfer.status === 'in_transit') && (
                                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                    {transfer.status === 'pending' && (
                                                        <>
                                                            <button
                                                                onClick={async () => {
                                                                    if (confirm('Xác nhận xuất kho? Tồn kho sẽ được trừ từ chi nhánh nguồn.')) {
                                                                        await shipTransfer(transfer.id, user?.id || '');
                                                                        if (brandId) fetchTransfers(brandId);
                                                                    }
                                                                }}
                                                                style={{
                                                                    padding: '8px 16px',
                                                                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    borderRadius: '8px',
                                                                    fontWeight: 600,
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                📤 Xuất kho
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    const reason = prompt('Lý do hủy phiếu?');
                                                                    if (reason !== null) {
                                                                        await cancelTransfer(transfer.id, user?.id || '', reason);
                                                                        if (brandId) fetchTransfers(brandId);
                                                                    }
                                                                }}
                                                                style={{
                                                                    padding: '8px 16px',
                                                                    backgroundColor: '#fef2f2',
                                                                    color: '#dc2626',
                                                                    border: '1px solid #fecaca',
                                                                    borderRadius: '8px',
                                                                    fontWeight: 600,
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                Hủy phiếu
                                                            </button>
                                                        </>
                                                    )}
                                                    {transfer.status === 'in_transit' && (
                                                        <>
                                                            <button
                                                                onClick={async () => {
                                                                    if (confirm('Xác nhận đã nhận hàng? Tồn kho sẽ được cộng vào chi nhánh đích.')) {
                                                                        await completeTransfer(transfer.id, user?.id || '');
                                                                        if (brandId) fetchTransfers(brandId);
                                                                    }
                                                                }}
                                                                style={{
                                                                    padding: '8px 16px',
                                                                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    borderRadius: '8px',
                                                                    fontWeight: 600,
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                ✅ Xác nhận nhận hàng
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    const reason = prompt('Lý do hủy phiếu? (Hàng đã xuất sẽ được hoàn lại)');
                                                                    if (reason !== null) {
                                                                        await cancelTransfer(transfer.id, user?.id || '', reason);
                                                                        if (brandId) fetchTransfers(brandId);
                                                                    }
                                                                }}
                                                                style={{
                                                                    padding: '8px 16px',
                                                                    backgroundColor: '#fef2f2',
                                                                    color: '#dc2626',
                                                                    border: '1px solid #fecaca',
                                                                    borderRadius: '8px',
                                                                    fontWeight: 600,
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                Hủy phiếu
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Branch Modal */}
                {showModal && (
                    <BranchModal
                        branch={editingBranch}
                        error={error}
                        onClose={() => { setShowModal(false); setEditingBranch(null); }}
                        onSave={async (data) => {
                            let result = null;
                            if (editingBranch) {
                                result = await updateBranch(editingBranch.id, data);
                            } else if (brandId) {
                                result = await createBranch({ ...data, brand_id: brandId, status: 'active' });
                            } else {
                                console.error('No brand_id available.');
                                alert('Lỗi: Không tìm thấy thương hiệu. Vui lòng đăng nhập lại.');
                                return;
                            }

                            if (result) {
                                setShowModal(false);
                                setEditingBranch(null);
                            }
                        }}
                    />
                )}

                {/* Transfer Modal */}
                {showTransferModal && (
                    <TransferModal
                        branches={activeBranches}
                        products={products}
                        currentBranchId={currentBranchId || null}
                        onClose={() => setShowTransferModal(false)}
                        onSave={async (data) => {
                            if (brandId && user?.id) {
                                await createTransfer({
                                    brand_id: brandId,
                                    from_branch_id: data.fromBranchId,
                                    to_branch_id: data.toBranchId,
                                    notes: data.notes,
                                    items: data.items.map(item => ({
                                        product_id: item.productId,
                                        quantity: item.quantity
                                    }))
                                }, user.id);
                            }
                            setShowTransferModal(false);
                        }}
                    />
                )}
            </div>
        </div>
    );
}

// ============================================================================
// BRANCH MODAL
// ============================================================================

interface BranchModalProps {
    branch: Branch | null;
    error: string | null;
    onClose: () => void;
    onSave: (data: Partial<Branch>) => void;
}

function BranchModal({ branch, error, onClose, onSave }: BranchModalProps) {
    const [formData, setFormData] = useState({
        name: branch?.name || '',
        code: branch?.code || '',
        address: branch?.address || '',
        phone: branch?.phone || '',
        email: branch?.email || '',
        is_headquarters: branch?.is_headquarters || false,
        status: branch?.status ?? 'active',
    });

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '10px 14px', borderRadius: '8px',
        border: '1px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box'
    };

    const labelStyle: React.CSSProperties = {
        display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px'
    };

    const [validationError, setValidationError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSave = async () => {
        // alert('DEBUG: Button Clicked'); 
        setValidationError(null);
        if (!formData.name.trim()) {
            setValidationError('Vui lòng nhập tên chi nhánh');
            return;
        }
        if (!formData.code.trim()) {
            setValidationError('Vui lòng nhập mã chi nhánh');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSave(formData);
        } catch (e: any) {
            alert('DEBUG: Error in handleSave: ' + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
            <div style={{
                backgroundColor: 'white', borderRadius: '16px', width: '500px',
                maxHeight: '90vh', overflow: 'auto', padding: '24px'
            }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>
                    {branch ? 'Sửa chi nhánh' : 'Thêm chi nhánh mới'}
                </h2>

                {error && (
                    <div style={{
                        backgroundColor: '#fee2e2', color: '#dc2626',
                        padding: '12px', borderRadius: '8px', marginBottom: '16px',
                        border: '1px solid #fecaca', fontSize: '14px'
                    }}>
                        ⚠️ {error}
                    </div>
                )}
                {validationError && (
                    <div style={{
                        backgroundColor: '#fff7ed', color: '#c2410c',
                        padding: '12px', borderRadius: '8px', marginBottom: '16px',
                        border: '1px solid #ffedd5', fontSize: '14px'
                    }}>
                        ⚠️ {validationError}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={labelStyle}>Tên chi nhánh</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="VD: Chi nhánh Quận 7"
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Mã chi nhánh</label>
                            <input
                                type="text"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                placeholder="VD: Q7"
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={labelStyle}>Địa chỉ</label>
                        <input
                            type="text"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            placeholder="Số nhà, đường, quận/huyện, TP"
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={labelStyle}>Số điện thoại</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="0901234567"
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="branch@store.vn"
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    {/* Time fields removed from interface */}
                    {/* <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={labelStyle}>Giờ mở cửa</label>
                            <input
                                type="time"
                                style={inputStyle}
                                disabled
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Giờ đóng cửa</label>
                            <input
                                type="time"
                                style={inputStyle}
                                disabled
                            />
                        </div>
                    </div> */}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '8px', fontWeight: 500, cursor: 'pointer' }}>
                        Hủy
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSubmitting}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: isSubmitting ? '#9ca3af' : '#22c55e',
                            color: 'white', border: 'none', borderRadius: '8px',
                            fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {isSubmitting ? 'Đang lưu...' : (branch ? 'Cập nhật' : 'Tạo chi nhánh')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// TRANSFER MODAL - With Product Picker
// ============================================================================

interface TransferModalProps {
    branches: Branch[];
    products: Product[];
    currentBranchId: string | null;
    onClose: () => void;
    onSave: (data: { fromBranchId: string; toBranchId: string; items: { productId: string; productName: string; quantity: number }[]; notes?: string }) => void;
}

function TransferModal({ branches, products, currentBranchId, onClose, onSave }: TransferModalProps) {
    const [formData, setFormData] = useState({
        fromBranchId: currentBranchId || '',
        toBranchId: '',
        notes: '',
    });
    const [items, setItems] = useState<{ productId: string; productName: string; quantity: number }[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showProductPicker, setShowProductPicker] = useState(false);

    // Filter products based on search
    const filteredProducts = products.filter(p =>
        p.is_active &&
        (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.barcode?.includes(searchQuery) ||
            p.sku?.toLowerCase().includes(searchQuery.toLowerCase()))
    ).slice(0, 20);

    const addProduct = (product: Product) => {
        const existing = items.find(i => i.productId === product.id);
        if (existing) {
            setItems(items.map(i =>
                i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
            ));
        } else {
            setItems([...items, { productId: product.id, productName: product.name, quantity: 1 }]);
        }
        setSearchQuery('');
        setShowProductPicker(false);
    };

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity <= 0) {
            setItems(items.filter(i => i.productId !== productId));
        } else {
            setItems(items.map(i =>
                i.productId === productId ? { ...i, quantity } : i
            ));
        }
    };

    const removeItem = (productId: string) => {
        setItems(items.filter(i => i.productId !== productId));
    };

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '10px 14px', borderRadius: '8px',
        border: '1px solid #e5e7eb', fontSize: '14px', boxSizing: 'border-box'
    };

    const labelStyle: React.CSSProperties = {
        display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px'
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
            <div style={{
                backgroundColor: 'white', borderRadius: '16px', width: '650px',
                maxHeight: '90vh', overflow: 'auto', padding: '24px'
            }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    🚚 Tạo phiếu chuyển hàng
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Branch Selection */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'end' }}>
                        <div>
                            <label style={labelStyle}>Từ chi nhánh</label>
                            <select
                                value={formData.fromBranchId}
                                onChange={(e) => setFormData({ ...formData, fromBranchId: e.target.value })}
                                style={inputStyle}
                            >
                                <option value="">-- Chọn --</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ padding: '10px', fontSize: '20px' }}>→</div>
                        <div>
                            <label style={labelStyle}>Đến chi nhánh</label>
                            <select
                                value={formData.toBranchId}
                                onChange={(e) => setFormData({ ...formData, toBranchId: e.target.value })}
                                style={inputStyle}
                            >
                                <option value="">-- Chọn --</option>
                                {branches.filter(b => b.id !== formData.fromBranchId).map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Product Picker */}
                    <div>
                        <label style={labelStyle}>Thêm sản phẩm</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="🔍 Tìm sản phẩm theo tên, mã vạch..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setShowProductPicker(e.target.value.length > 0);
                                }}
                                onFocus={() => setShowProductPicker(searchQuery.length > 0)}
                                style={inputStyle}
                            />
                            {showProductPicker && filteredProducts.length > 0 && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0,
                                    backgroundColor: 'white', border: '1px solid #e5e7eb',
                                    borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    maxHeight: '200px', overflowY: 'auto', zIndex: 10
                                }}>
                                    {filteredProducts.map(product => (
                                        <div
                                            key={product.id}
                                            onClick={() => addProduct(product)}
                                            style={{
                                                padding: '10px 14px', cursor: 'pointer',
                                                borderBottom: '1px solid #f3f4f6',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{product.name}</div>
                                                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                    {product.barcode && `Mã: ${product.barcode}`} • Tồn: {product.current_stock}
                                                </div>
                                            </div>
                                            <span style={{ color: '#22c55e' }}>+ Thêm</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Selected Items */}
                    <div>
                        <label style={labelStyle}>Danh sách sản phẩm ({items.length})</label>
                        {items.length === 0 ? (
                            <div style={{
                                backgroundColor: '#f9fafb', padding: '20px', borderRadius: '8px',
                                textAlign: 'center', color: '#6b7280', fontSize: '14px'
                            }}>
                                📦 Chưa có sản phẩm nào. Tìm và thêm sản phẩm ở trên.
                            </div>
                        ) : (
                            <div style={{
                                backgroundColor: '#f9fafb', borderRadius: '8px',
                                maxHeight: '200px', overflowY: 'auto'
                            }}>
                                {items.map((item) => (
                                    <div key={item.productId} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '12px', borderBottom: '1px solid #e5e7eb'
                                    }}>
                                        <span style={{ flex: 1, fontWeight: 500 }}>{item.productName}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button
                                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                                style={{
                                                    width: '28px', height: '28px', borderRadius: '6px',
                                                    border: '1px solid #e5e7eb', backgroundColor: 'white',
                                                    cursor: 'pointer', fontWeight: 'bold'
                                                }}
                                            >-</button>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value) || 0)}
                                                style={{
                                                    width: '60px', textAlign: 'center', padding: '4px 8px',
                                                    borderRadius: '6px', border: '1px solid #e5e7eb'
                                                }}
                                            />
                                            <button
                                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                                style={{
                                                    width: '28px', height: '28px', borderRadius: '6px',
                                                    border: '1px solid #e5e7eb', backgroundColor: 'white',
                                                    cursor: 'pointer', fontWeight: 'bold'
                                                }}
                                            >+</button>
                                            <button
                                                onClick={() => removeItem(item.productId)}
                                                style={{
                                                    width: '28px', height: '28px', borderRadius: '6px',
                                                    border: '1px solid #fecaca', backgroundColor: '#fef2f2',
                                                    color: '#dc2626', cursor: 'pointer'
                                                }}
                                            >×</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label style={labelStyle}>Ghi chú</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Ghi chú thêm về phiếu chuyển..."
                            style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                    <button onClick={onClose} style={{
                        padding: '10px 20px', backgroundColor: '#f3f4f6',
                        border: 'none', borderRadius: '8px', fontWeight: 500, cursor: 'pointer'
                    }}>
                        Hủy
                    </button>
                    <button
                        onClick={() => {
                            if (!formData.fromBranchId || !formData.toBranchId) {
                                alert('Vui lòng chọn chi nhánh nguồn và đích');
                                return;
                            }
                            if (items.length === 0) {
                                alert('Vui lòng thêm ít nhất một sản phẩm');
                                return;
                            }
                            onSave({
                                fromBranchId: formData.fromBranchId,
                                toBranchId: formData.toBranchId,
                                items,
                                notes: formData.notes,
                            });
                        }}
                        disabled={items.length === 0}
                        style={{
                            padding: '10px 20px',
                            background: items.length === 0 ? '#e5e7eb' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                            color: items.length === 0 ? '#9ca3af' : 'white',
                            border: 'none', borderRadius: '8px', fontWeight: 600, cursor: items.length === 0 ? 'not-allowed' : 'pointer',
                            boxShadow: items.length > 0 ? '0 4px 15px rgba(34, 197, 94, 0.3)' : 'none'
                        }}
                    >
                        Tạo phiếu chuyển ({items.length})
                    </button>
                </div>
            </div>
        </div>
    );
}

export default BranchesPage;

