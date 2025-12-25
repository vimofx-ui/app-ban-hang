// =============================================================================
// BRANCHES PAGE - Multi-Branch Management
// =============================================================================

import { useState } from 'react';
import { useBranchStore, type Branch } from '@/stores/branchStore';
import { useAuthStore } from '@/stores/authStore';
import { formatVND } from '@/lib/cashReconciliation';

export function BranchesPage() {
    const {
        branches, currentBranchId, stockTransfers,
        addBranch, updateBranch, deleteBranch, setCurrentBranch,
        createStockTransfer, completeStockTransfer, cancelStockTransfer
    } = useBranchStore();
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'list' | 'transfers'>('list');
    const [showModal, setShowModal] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [showTransferModal, setShowTransferModal] = useState(false);

    const isAdmin = user?.role === 'admin';
    const activeBranches = branches.filter(b => b.isActive);

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

                {/* Branch List */}
                {activeTab === 'list' && (
                    <div>
                        {/* Branch Cards Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
                            {activeBranches.map((branch) => (
                                <div
                                    key={branch.id}
                                    style={{
                                        ...cardStyle,
                                        borderLeft: branch.id === currentBranchId ? '4px solid #22c55e' : '4px solid transparent',
                                        marginBottom: 0
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{branch.name}</span>
                                                {branch.isHeadquarters && (
                                                    <span style={{
                                                        padding: '2px 8px',
                                                        backgroundColor: '#dbeafe',
                                                        color: '#2563eb',
                                                        borderRadius: '12px',
                                                        fontSize: '11px',
                                                        fontWeight: 600
                                                    }}>
                                                        Trụ sở chính
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                                Mã: <strong>{branch.code}</strong>
                                            </div>
                                        </div>
                                        {branch.id === currentBranchId && (
                                            <span style={{
                                                padding: '4px 12px',
                                                backgroundColor: '#dcfce7',
                                                color: '#16a34a',
                                                borderRadius: '16px',
                                                fontSize: '12px',
                                                fontWeight: 600
                                            }}>
                                                ✓ Đang chọn
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ marginTop: '12px', fontSize: '14px', color: '#374151' }}>
                                        <div style={{ marginBottom: '4px' }}>📍 {branch.address}</div>
                                        <div style={{ marginBottom: '4px' }}>📞 {branch.phone}</div>
                                        {branch.openTime && branch.closeTime && (
                                            <div>🕐 {branch.openTime} - {branch.closeTime}</div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                        {branch.id !== currentBranchId && (
                                            <button
                                                style={{ ...btnPrimary, flex: 1, padding: '8px 16px' }}
                                                onClick={() => setCurrentBranch(branch.id)}
                                            >
                                                Chọn chi nhánh này
                                            </button>
                                        )}
                                        {isAdmin && (
                                            <>
                                                <button
                                                    style={btnSecondary}
                                                    onClick={() => { setEditingBranch(branch); setShowModal(true); }}
                                                >
                                                    ✏️ Sửa
                                                </button>
                                                {!branch.isHeadquarters && (
                                                    <button
                                                        style={{ ...btnSecondary, color: '#dc2626' }}
                                                        onClick={() => {
                                                            if (confirm(`Xóa chi nhánh "${branch.name}"?`)) {
                                                                deleteBranch(branch.id);
                                                            }
                                                        }}
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {activeBranches.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏪</div>
                                <p>Chưa có chi nhánh nào. Bấm "Thêm chi nhánh" để tạo mới.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Stock Transfers */}
                {activeTab === 'transfers' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Phiếu chuyển hàng</h2>
                            <button
                                style={btnPrimary}
                                onClick={() => setShowTransferModal(true)}
                            >
                                + Tạo phiếu chuyển
                            </button>
                        </div>

                        <div style={cardStyle}>
                            {stockTransfers.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚚</div>
                                    <p>Chưa có phiếu chuyển hàng nào.</p>
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                            <th style={{ textAlign: 'left', padding: '12px' }}>Mã phiếu</th>
                                            <th style={{ textAlign: 'left', padding: '12px' }}>Từ</th>
                                            <th style={{ textAlign: 'left', padding: '12px' }}>Đến</th>
                                            <th style={{ textAlign: 'center', padding: '12px' }}>Số SP</th>
                                            <th style={{ textAlign: 'center', padding: '12px' }}>Trạng thái</th>
                                            <th style={{ textAlign: 'center', padding: '12px' }}>Ngày tạo</th>
                                            <th style={{ textAlign: 'center', padding: '12px' }}>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stockTransfers.map((transfer) => {
                                            const fromBranch = branches.find(b => b.id === transfer.fromBranchId);
                                            const toBranch = branches.find(b => b.id === transfer.toBranchId);
                                            const statusColors: Record<string, { bg: string; color: string; label: string }> = {
                                                pending: { bg: '#fef9c3', color: '#ca8a04', label: 'Chờ xuất' },
                                                in_transit: { bg: '#dbeafe', color: '#2563eb', label: 'Đang chuyển' },
                                                completed: { bg: '#dcfce7', color: '#16a34a', label: 'Hoàn tất' },
                                                cancelled: { bg: '#fef2f2', color: '#dc2626', label: 'Đã hủy' },
                                            };
                                            const status = statusColors[transfer.status];

                                            return (
                                                <tr key={transfer.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                    <td style={{ padding: '12px', fontWeight: 600 }}>
                                                        #{transfer.id.slice(-6).toUpperCase()}
                                                    </td>
                                                    <td style={{ padding: '12px' }}>{fromBranch?.name || '-'}</td>
                                                    <td style={{ padding: '12px' }}>{toBranch?.name || '-'}</td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>{transfer.items.length}</td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                        <span style={{
                                                            padding: '4px 10px',
                                                            backgroundColor: status.bg,
                                                            color: status.color,
                                                            borderRadius: '12px',
                                                            fontSize: '12px',
                                                            fontWeight: 600
                                                        }}>
                                                            {status.label}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                                                        {new Date(transfer.createdAt).toLocaleDateString('vi-VN')}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                        {transfer.status === 'pending' && (
                                                            <button
                                                                style={{ ...btnSecondary, fontSize: '12px', padding: '4px 10px', marginRight: '4px' }}
                                                                onClick={() => cancelStockTransfer(transfer.id)}
                                                            >
                                                                Hủy
                                                            </button>
                                                        )}
                                                        {(transfer.status === 'pending' || transfer.status === 'in_transit') && (
                                                            <button
                                                                style={{ ...btnPrimary, fontSize: '12px', padding: '4px 10px' }}
                                                                onClick={() => {
                                                                    const received = transfer.items.map(i => ({
                                                                        productId: i.productId,
                                                                        receivedQuantity: i.quantity
                                                                    }));
                                                                    completeStockTransfer(transfer.id, received);
                                                                }}
                                                            >
                                                                Hoàn tất
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Branch Modal */}
            {showModal && (
                <BranchModal
                    branch={editingBranch}
                    onClose={() => { setShowModal(false); setEditingBranch(null); }}
                    onSave={(data) => {
                        if (editingBranch) {
                            updateBranch(editingBranch.id, data);
                        } else {
                            addBranch({ ...data, isActive: true, isHeadquarters: false });
                        }
                        setShowModal(false);
                        setEditingBranch(null);
                    }}
                />
            )}

            {/* Transfer Modal */}
            {showTransferModal && (
                <TransferModal
                    branches={activeBranches}
                    currentBranchId={currentBranchId}
                    onClose={() => setShowTransferModal(false)}
                    onSave={(data) => {
                        createStockTransfer(data);
                        setShowTransferModal(false);
                    }}
                />
            )}
        </div>
    );
}

// ============================================================================
// BRANCH MODAL
// ============================================================================

interface BranchModalProps {
    branch: Branch | null;
    onClose: () => void;
    onSave: (data: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

function BranchModal({ branch, onClose, onSave }: BranchModalProps) {
    const [formData, setFormData] = useState({
        name: branch?.name || '',
        code: branch?.code || '',
        address: branch?.address || '',
        phone: branch?.phone || '',
        email: branch?.email || '',
        openTime: branch?.openTime || '08:00',
        closeTime: branch?.closeTime || '22:00',
        isHeadquarters: branch?.isHeadquarters || false,
        isActive: branch?.isActive ?? true,
    });

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
                backgroundColor: 'white', borderRadius: '16px', width: '500px',
                maxHeight: '90vh', overflow: 'auto', padding: '24px'
            }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>
                    {branch ? 'Sửa chi nhánh' : 'Thêm chi nhánh mới'}
                </h2>

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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={labelStyle}>Giờ mở cửa</label>
                            <input
                                type="time"
                                value={formData.openTime}
                                onChange={(e) => setFormData({ ...formData, openTime: e.target.value })}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Giờ đóng cửa</label>
                            <input
                                type="time"
                                value={formData.closeTime}
                                onChange={(e) => setFormData({ ...formData, closeTime: e.target.value })}
                                style={inputStyle}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '8px', fontWeight: 500, cursor: 'pointer' }}>
                        Hủy
                    </button>
                    <button
                        onClick={() => onSave(formData as any)}
                        style={{ padding: '10px 20px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                    >
                        {branch ? 'Cập nhật' : 'Tạo chi nhánh'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// TRANSFER MODAL
// ============================================================================

interface TransferModalProps {
    branches: Branch[];
    currentBranchId: string | null;
    onClose: () => void;
    onSave: (data: { fromBranchId: string; toBranchId: string; items: any[]; notes?: string; createdBy: string }) => void;
}

function TransferModal({ branches, currentBranchId, onClose, onSave }: TransferModalProps) {
    const [formData, setFormData] = useState({
        fromBranchId: currentBranchId || '',
        toBranchId: '',
        notes: '',
    });
    const [items, setItems] = useState<{ productId: string; productName: string; quantity: number }[]>([
        { productId: 'demo-1', productName: 'Sản phẩm mẫu', quantity: 10 }
    ]);

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
                backgroundColor: 'white', borderRadius: '16px', width: '550px',
                maxHeight: '90vh', overflow: 'auto', padding: '24px'
            }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>
                    Tạo phiếu chuyển hàng
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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

                    <div>
                        <label style={labelStyle}>Sản phẩm chuyển (Demo)</label>
                        <div style={{ backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px', fontSize: '14px' }}>
                            {items.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                                    <span>{item.productName}</span>
                                    <span><strong>{item.quantity}</strong> đơn vị</span>
                                </div>
                            ))}
                        </div>
                        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
                            💡 Trong phiên bản đầy đủ, bạn có thể chọn sản phẩm từ danh sách tồn kho
                        </p>
                    </div>

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

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '8px', fontWeight: 500, cursor: 'pointer' }}>
                        Hủy
                    </button>
                    <button
                        onClick={() => {
                            if (!formData.fromBranchId || !formData.toBranchId) {
                                alert('Vui lòng chọn chi nhánh nguồn và đích');
                                return;
                            }
                            onSave({
                                fromBranchId: formData.fromBranchId,
                                toBranchId: formData.toBranchId,
                                items,
                                notes: formData.notes,
                                createdBy: 'current-user',
                            });
                        }}
                        style={{ padding: '10px 20px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                    >
                        Tạo phiếu chuyển
                    </button>
                </div>
            </div>
        </div>
    );
}

export default BranchesPage;
