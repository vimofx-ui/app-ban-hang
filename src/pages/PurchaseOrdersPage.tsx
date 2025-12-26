
// =============================================================================
// PURCHASE ORDERS PAGE - Enhanced Stock In Management
// Layout matching reference images with list view, detail view, and full features
// =============================================================================

import { useState, useEffect, useMemo, useRef } from 'react';
import { usePurchaseOrderStore } from '@/stores/purchaseOrderStore';
import type { PurchaseOrderWithItems, CreateOrderInput, ActivityLogEntry } from '@/stores/purchaseOrderStore';
import { useSupplierStore } from '@/stores/supplierStore';
import { useProductStore } from '@/stores/productStore';
import { formatVND } from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';
import type { Supplier, Product, ProductSearchItem } from '@/types';
import { ProductLink } from '@/components/products/ProductLink';
import { QuantityInputStyled } from '@/components/common/QuantityInput';
import { CurrencyInput } from '@/components/common/CurrencyInput';
import { searchProducts, getRecentProducts } from '@/lib/productSearch';
import { BarcodeSelectionModal, findProductsByBarcode, type BarcodeMatch } from '@/components/common/BarcodeSelectionModal';
import { ProductQuickViewModal } from '@/components/products/ProductQuickViewModal';
import { UnitConversionDropdown } from '@/components/products/UnitConversionDropdown';
import type { UnitOption } from '@/components/products/UnitConversionDropdown';
import { InvoiceImageUpload, type InvoiceImage } from '@/components/common/InvoiceImageUpload';
import { usePrint } from '@/hooks/usePrint';

type ViewMode = 'list' | 'detail' | 'create' | 'edit';
type TabFilter = 'all' | 'pending' | 'completed';

export function PurchaseOrdersPage() {
    const {
        orders, isLoading, loadOrders, createOrder, updateOrder, receiveOrder,
        cancelOrder, duplicateOrder, processPayment, confirmOrder, returnOrder,
        selectedOrderId, setSelectedOrder, getOrderById,
        smartPOSuggestions, isLoadingSmartPO, loadSmartPOSuggestions, createSmartPOs
    } = usePurchaseOrderStore();
    const { suppliers, loadSuppliers } = useSupplierStore();
    const { products, loadProducts } = useProductStore();

    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [tabFilter, setTabFilter] = useState<TabFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingOrder, setEditingOrder] = useState<PurchaseOrderWithItems | null>(null);
    const [showSmartPOModal, setShowSmartPOModal] = useState(false);

    // Advanced Filters
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterSupplier, setFilterSupplier] = useState<string>('');
    const [filterDateFrom, setFilterDateFrom] = useState<string>('');
    const [filterDateTo, setFilterDateTo] = useState<string>('');
    const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('');

    // Column Visibility
    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('po_visible_columns');
        return saved ? JSON.parse(saved) : {
            po_number: true,
            created_at: true,
            branch: true,
            status: true,
            processing_status: true,
            supplier: true,
            staff: true,
            quantity: true,
            total: true,
            payment_status: true,
            payment_date: false,
            notes: false,
        };
    });
    const [showColumnSettings, setShowColumnSettings] = useState(false);

    // Save column visibility to localStorage
    useEffect(() => {
        localStorage.setItem('po_visible_columns', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    // Column Definitions
    const columnDefs = [
        { key: 'po_number', label: 'Mã đơn nhập' },
        { key: 'created_at', label: 'Ngày tạo' },
        { key: 'branch', label: 'Chi nhánh' },
        { key: 'status', label: 'Trạng thái' },
        { key: 'processing_status', label: 'Trạng thái nhập' },
        { key: 'supplier', label: 'Nhà cung cấp' },
        { key: 'staff', label: 'Nhân viên tạo' },
        { key: 'quantity', label: 'Số lượng' },
        { key: 'total', label: 'Giá trị đơn' },
        { key: 'payment_status', label: 'TT Thanh toán' },
        { key: 'payment_date', label: 'Ngày thanh toán' },
        { key: 'notes', label: 'Ghi chú' },
    ];

    useEffect(() => {
        loadOrders();
        loadSuppliers();
        loadProducts();
    }, [loadOrders, loadSuppliers, loadProducts]);

    const filteredOrders = useMemo(() => {
        return orders.filter((o) => {
            // Tab filter
            if (tabFilter === 'pending') {
                if (o.status !== 'confirmed' && o.status !== 'draft') return false;
            }
            if (tabFilter === 'completed') {
                if (o.status !== 'received') return false;
            }

            // Status filter
            if (filterStatus && o.status !== filterStatus) return false;

            // Supplier filter
            if (filterSupplier && o.supplier_id !== filterSupplier) return false;

            // Payment status filter
            if (filterPaymentStatus && o.payment_status !== filterPaymentStatus) return false;

            // Date range filter
            if (filterDateFrom) {
                const orderDate = new Date(o.created_at);
                const fromDate = new Date(filterDateFrom);
                if (orderDate < fromDate) return false;
            }
            if (filterDateTo) {
                const orderDate = new Date(o.created_at);
                const toDate = new Date(filterDateTo);
                toDate.setHours(23, 59, 59);
                if (orderDate > toDate) return false;
            }

            // Search filter
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return o.po_number.toLowerCase().includes(q) ||
                    o.supplier_name?.toLowerCase().includes(q) ||
                    o.assigned_to?.toLowerCase().includes(q);
            }
            return true;
        });
    }, [orders, tabFilter, searchQuery, filterStatus, filterSupplier, filterPaymentStatus, filterDateFrom, filterDateTo]);

    // CSV Export function
    const exportToCSV = () => {
        const headers = ['Mã đơn', 'Ngày tạo', 'Nhà cung cấp', 'Nhân viên', 'Trạng thái', 'TT Thanh toán', 'Số lượng', 'Giá trị đơn'];
        const rows = filteredOrders.map(o => {
            const supplier = suppliers.find(s => s.id === o.supplier_id);
            const totalQty = o.items.reduce((sum, i) => sum + i.quantity, 0);
            return [
                o.po_number,
                new Date(o.created_at).toLocaleDateString('vi-VN'),
                supplier?.name || o.supplier_name || '',
                o.assigned_to || '',
                o.status,
                o.payment_status,
                totalQty.toString(),
                o.total_amount.toString()
            ];
        });
        const csvContent = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `don-nhap-hang-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const selectedOrder = selectedOrderId ? getOrderById(selectedOrderId) : null;

    const handleViewDetail = (order: PurchaseOrderWithItems) => {
        setSelectedOrder(order.id);
        setViewMode('detail');
    };

    const handleCreate = () => {
        setEditingOrder(null);
        setViewMode('create');
    };

    const handleEdit = (order: PurchaseOrderWithItems) => {
        setEditingOrder(order);
        setViewMode('edit');
    };

    const handleDuplicate = (order: PurchaseOrderWithItems) => {
        // Open form with the order's data pre-filled but as a new order (no order.id)
        setEditingOrder({
            ...order,
            id: '', // Clear ID so it's treated as a new order
            po_number: '', // Clear PO number
            status: 'draft',
            notes: `Sao chép từ ${order.po_number} `,
            history: [],
        });
        setViewMode('create'); // Use 'create' mode so form knows it's a new order
    };

    const handleBack = () => {
        setViewMode('list');
        setSelectedOrder(null);
        setEditingOrder(null);
    };

    // Inline styles for reliable rendering
    const styles = {
        container: { minHeight: '100vh', backgroundColor: '#f9fafb' } as React.CSSProperties,
        header: { backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 24px' } as React.CSSProperties,
        tabButton: (active: boolean): React.CSSProperties => ({
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: active ? '#3b82f6' : 'transparent',
            color: active ? 'white' : '#6b7280'
        }),
        primaryButton: {
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        } as React.CSSProperties
    };

    // List View
    if (viewMode === 'list') {
        return (
            <div style={styles.container}>
                {/* Header */}
                <header style={styles.header}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
                            Danh sách đơn nhập hàng
                        </h1>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={exportToCSV} style={{ ...styles.primaryButton, backgroundColor: '#f3f4f6', color: '#374151' }}>
                                📤 Xuất file
                            </button>
                            <button style={{ ...styles.primaryButton, backgroundColor: '#f3f4f6', color: '#374151' }}>
                                📥 Nhập file
                            </button>
                            <button onClick={handleCreate} style={styles.primaryButton}>
                                ➕ Tạo đơn nhập hàng
                            </button>
                            <button
                                onClick={async () => {
                                    await loadSmartPOSuggestions();
                                    setShowSmartPOModal(true);
                                }}
                                style={{ ...styles.primaryButton, backgroundColor: '#059669' }}
                            >
                                🧠 Tạo PO Thông Minh
                            </button>
                        </div>
                    </div>
                </header>

                {/* Tabs */}
                <div style={{ padding: '16px 24px', backgroundColor: 'white', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        {[
                            { id: 'all' as TabFilter, label: 'Tất cả' },
                            { id: 'pending' as TabFilter, label: 'Đang giao dịch' },
                            { id: 'completed' as TabFilter, label: 'Hoàn thành' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setTabFilter(tab.id)}
                                style={styles.tabButton(tabFilter === tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Search and Filters */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="🔍 Tìm kiếm theo mã đơn nhập, tên, SDT, mã NCC"
                            style={{
                                flex: 1,
                                minWidth: '300px',
                                padding: '10px 14px',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                fontSize: '14px'
                            }}
                        />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px' }}
                        >
                            <option value="">Trạng thái ▾</option>
                            <option value="draft">Nháp</option>
                            <option value="confirmed">Đã xác nhận</option>
                            <option value="received">Đã nhập</option>
                            <option value="cancelled">Đã hủy</option>
                        </select>
                        <select
                            value={filterSupplier}
                            onChange={(e) => setFilterSupplier(e.target.value)}
                            style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px' }}
                        >
                            <option value="">Nhà cung cấp ▾</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <select
                            value={filterPaymentStatus}
                            onChange={(e) => setFilterPaymentStatus(e.target.value)}
                            style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px' }}
                        >
                            <option value="">TT Thanh toán ▾</option>
                            <option value="unpaid">Chưa TT</option>
                            <option value="partial">Đang TT</option>
                            <option value="paid">Đã TT</option>
                        </select>
                        <input
                            type="date"
                            value={filterDateFrom}
                            onChange={(e) => setFilterDateFrom(e.target.value)}
                            style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px' }}
                            title="Từ ngày"
                        />
                        <input
                            type="date"
                            value={filterDateTo}
                            onChange={(e) => setFilterDateTo(e.target.value)}
                            style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px' }}
                            title="Đến ngày"
                        />
                        <button
                            onClick={() => {
                                setFilterStatus('');
                                setFilterSupplier('');
                                setFilterPaymentStatus('');
                                setFilterDateFrom('');
                                setFilterDateTo('');
                                setSearchQuery('');
                            }}
                            style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer' }}
                        >
                            🔄 Xóa bộ lọc
                        </button>
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowColumnSettings(!showColumnSettings)}
                                style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer' }}
                            >
                                ⚙️ Cột hiển thị
                            </button>
                            {showColumnSettings && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '4px',
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    zIndex: 50,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    minWidth: '200px'
                                }}>
                                    <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}>Cột hiển thị</div>
                                    {columnDefs.map(col => (
                                        <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer', fontSize: '13px' }}>
                                            <input
                                                type="checkbox"
                                                checked={visibleColumns[col.key]}
                                                onChange={(e) => setVisibleColumns(prev => ({ ...prev, [col.key]: e.target.checked }))}
                                            />
                                            {col.label}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div style={{ padding: '24px' }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                <tr>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#6b7280' }}>
                                        <input type="checkbox" />
                                    </th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#6b7280' }}>Mã đơn nhập</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#6b7280' }}>Ngày tạo</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#6b7280' }}>Chi nhánh nhập</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500, color: '#6b7280' }}>Trạng thái</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500, color: '#6b7280' }}>Trạng thái nhập</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#6b7280' }}>Nhà cung cấp</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#6b7280' }}>Nhân viên tạo</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500, color: '#6b7280' }}>Số lượng nhập</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500, color: '#6b7280' }}>Giá trị đơn</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Đang tải...</td></tr>
                                ) : filteredOrders.length === 0 ? (
                                    <tr><td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Chưa có đơn nhập hàng</td></tr>
                                ) : (
                                    filteredOrders.map(order => (
                                        <PurchaseOrderRow
                                            key={order.id}
                                            order={order}
                                            suppliers={suppliers}
                                            onClick={() => handleViewDetail(order)}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Smart PO Modal */}
                {showSmartPOModal && (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            width: '90%',
                            maxWidth: '900px',
                            maxHeight: '80vh',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            {/* Modal Header */}
                            <div style={{
                                padding: '16px 24px',
                                borderBottom: '1px solid #e5e7eb',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                                        🧠 Tạo Đơn Nhập Hàng Thông Minh
                                    </h2>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                                        Hệ thống tự động phát hiện {smartPOSuggestions.length} sản phẩm hết/sắp hết hàng
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowSmartPOModal(false)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '24px',
                                        cursor: 'pointer',
                                        color: '#6b7280'
                                    }}
                                >
                                    ×
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
                                {isLoadingSmartPO ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                                        Đang phân tích dữ liệu bán hàng...
                                    </div>
                                ) : smartPOSuggestions.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                                        <div style={{ fontSize: '16px', fontWeight: 500 }}>Tuyệt vời! Không có sản phẩm nào hết hàng</div>
                                        <div style={{ fontSize: '13px', marginTop: '8px' }}>Tất cả sản phẩm đều có tồn kho trên mức tối thiểu</div>
                                    </div>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500, color: '#6b7280' }}>Sản phẩm</th>
                                                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: '#6b7280' }}>Tồn kho</th>
                                                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: '#6b7280' }}>Tối thiểu</th>
                                                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: '#6b7280' }}>Thiếu</th>
                                                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500, color: '#6b7280' }}>NCC đề xuất</th>
                                                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: '#6b7280' }}>Giá nhập</th>
                                                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: '#6b7280' }}>SL đề xuất</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {smartPOSuggestions.map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                    <td style={{ padding: '10px 12px' }}>
                                                        <div style={{ fontWeight: 500 }}>{item.product_name}</div>
                                                        <div style={{ fontSize: '12px', color: '#6b7280' }}>{item.product_sku}</div>
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', color: item.current_stock <= 0 ? '#dc2626' : '#f59e0b', fontWeight: 500 }}>
                                                        {item.current_stock}
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.min_stock}</td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#dc2626', fontWeight: 500 }}>
                                                        {item.shortage > 0 ? `-${item.shortage}` : '0'}
                                                    </td>
                                                    <td style={{ padding: '10px 12px', color: '#3b82f6' }}>
                                                        {item.suggested_supplier_name || 'Chưa có NCC'}
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                                        {item.suggested_price ? formatVND(item.suggested_price) : '---'}
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                                                        {item.suggested_quantity}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div style={{
                                padding: '16px 24px',
                                borderTop: '1px solid #e5e7eb',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                backgroundColor: '#f9fafb'
                            }}>
                                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                    {smartPOSuggestions.length > 0 && (
                                        <span>
                                            Sẽ tạo {new Set(smartPOSuggestions.map(s => s.suggested_supplier_id).filter(Boolean)).size} đơn nhập hàng
                                            theo các nhà cung cấp
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        onClick={() => setShowSmartPOModal(false)}
                                        style={{
                                            padding: '10px 20px',
                                            border: '1px solid #d1d5db',
                                            backgroundColor: 'white',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontWeight: 500
                                        }}
                                    >
                                        Đóng
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const createdOrders = await createSmartPOs();
                                            setShowSmartPOModal(false);
                                            if (createdOrders.length > 0) {
                                                alert(`Đã tạo ${createdOrders.length} đơn nhập hàng nháp. Vui lòng kiểm tra và xác nhận.`);
                                                loadOrders(); // Refresh list
                                            } else {
                                                alert('Không có đơn hàng nào được tạo. Vui lòng kiểm tra dữ liệu NCC.');
                                            }
                                        }}
                                        disabled={smartPOSuggestions.length === 0 || smartPOSuggestions.every(s => !s.suggested_supplier_id)}
                                        style={{
                                            padding: '10px 20px',
                                            backgroundColor: smartPOSuggestions.length > 0 ? '#059669' : '#d1d5db',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: smartPOSuggestions.length > 0 ? 'pointer' : 'not-allowed',
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        🧠 Tạo Đơn Nhập Tự Động
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Detail View
    if (viewMode === 'detail' && selectedOrder) {
        return (
            <PurchaseOrderDetailView
                order={selectedOrder}
                suppliers={suppliers}
                products={products}
                onBack={handleBack}
                onEdit={() => handleEdit(selectedOrder)}
                onDuplicate={() => handleDuplicate(selectedOrder)}
                onReceive={() => receiveOrder(selectedOrder.id)}
                onCancel={() => cancelOrder(selectedOrder.id)}
                onPayment={(amount) => processPayment(selectedOrder.id, amount)}
                onConfirm={() => confirmOrder(selectedOrder.id)}
                onReturn={(items, reason) => returnOrder(selectedOrder.id, items, reason)}
                onCreateNew={handleCreate}
            />
        );
    }

    // Create/Edit Modal
    if (viewMode === 'create' || viewMode === 'edit') {
        return (
            <PurchaseOrderForm
                order={editingOrder}
                suppliers={suppliers}
                products={products}
                onSave={async (data) => {
                    if (editingOrder) {
                        await updateOrder(editingOrder.id, {}, data.items);
                        // After editing, go to detail view
                        setSelectedOrder(editingOrder.id);
                        setViewMode('detail');
                        setEditingOrder(null);
                    } else {
                        // After creating, navigate to the new order's detail view
                        const newOrder = await createOrder(data);
                        setSelectedOrder(newOrder.id);
                        setViewMode('detail');
                    }
                }}
                onCancel={handleBack}
            />
        );
    }

    return null;
}

// =============================================================================
// Table Row Component
// =============================================================================

function PurchaseOrderRow({ order, suppliers, onClick }: {
    order: PurchaseOrderWithItems;
    suppliers: Supplier[];
    onClick: () => void;
}) {
    const supplier = suppliers.find(s => s.id === order.supplier_id);
    const totalQty = order.items.reduce((sum, i) => sum + i.quantity, 0);

    const statusStyles: Record<string, React.CSSProperties> = {
        draft: { backgroundColor: '#f3f4f6', color: '#374151' },
        confirmed: { backgroundColor: '#fef3c7', color: '#92400e' },
        received: { backgroundColor: '#d1fae5', color: '#065f46' },
        cancelled: { backgroundColor: '#fee2e2', color: '#991b1b' },
    };

    const paymentStyles: Record<string, React.CSSProperties> = {
        unpaid: { backgroundColor: '#fee2e2', color: '#991b1b' },
        partial: { backgroundColor: '#fef3c7', color: '#92400e' },
        paid: { backgroundColor: '#d1fae5', color: '#065f46' },
    };

    const statusLabels: Record<string, string> = {
        draft: 'Nháp',
        confirmed: 'Hoàn thành',
        received: 'Đã nhập',
        cancelled: 'Đã hủy',
    };

    const paymentLabels: Record<string, string> = {
        unpaid: 'Chưa TT',
        partial: 'Đang TT',
        paid: 'Đã TT',
    };

    const rowStyle: React.CSSProperties = {
        cursor: 'pointer',
        borderBottom: '1px solid #f3f4f6'
    };

    const cellStyle: React.CSSProperties = {
        padding: '14px 16px'
    };

    const badgeStyle = (styles: React.CSSProperties): React.CSSProperties => ({
        padding: '4px 10px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 500,
        display: 'inline-block',
        ...styles
    });

    return (
        <tr style={rowStyle} onClick={onClick} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
            <td style={cellStyle} onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" />
            </td>
            <td style={{ ...cellStyle, color: '#3b82f6', fontWeight: 500 }}>
                {order.po_number}
            </td>
            <td style={cellStyle}>
                {new Date(order.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </td>
            <td style={cellStyle}>{order.branch_name || 'Cửa hàng chính'}</td>
            <td style={{ ...cellStyle, textAlign: 'center' }}>
                <span style={badgeStyle(statusStyles[order.status] || statusStyles.draft)}>
                    {statusLabels[order.status] || order.status}
                </span>
            </td>
            <td style={{ ...cellStyle, textAlign: 'center' }}>
                <span style={badgeStyle(paymentStyles[order.payment_status || 'unpaid'])}>
                    {paymentLabels[order.payment_status || 'unpaid']}
                </span>
            </td>
            <td style={{ ...cellStyle, color: '#3b82f6' }}>
                {supplier?.name || order.supplier_name || 'NCC'}
            </td>
            <td style={cellStyle}>{order.assigned_to || 'Admin'}</td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>{totalQty}</td>
            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                {formatVND(order.total_amount)}
            </td>
        </tr>
    );
}

// =============================================================================
// Detail View Component
// =============================================================================

interface DetailViewProps {
    order: PurchaseOrderWithItems;
    suppliers: Supplier[];
    products: Product[];
    onBack: () => void;
    onEdit: () => void;
    onDuplicate: () => void;
    onReceive: () => void;
    onCancel: () => void;
    onPayment: (amount: number) => void;
    onConfirm: () => void;
    onReturn: (returnItems: Array<{ product_id: string; quantity: number }>, reason?: string) => void;
    onCreateNew: () => void;
}

function PurchaseOrderDetailView({
    order, suppliers, products, onBack, onEdit, onDuplicate,
    onReceive, onCancel, onPayment, onConfirm, onReturn, onCreateNew
}: DetailViewProps) {
    const supplier = suppliers.find(s => s.id === order.supplier_id);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [returnItems, setReturnItems] = useState<Array<{ product_id: string; quantity: number; max_qty: number }>>([])
    const [returnReason, setReturnReason] = useState('');
    const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    const remainingAmount = order.total_amount - order.paid_amount;
    const isReceived = order.status === 'received';
    const isPaid = order.payment_status === 'paid' || (order.total_amount > 0 && remainingAmount <= 0);

    // Download image function
    const downloadImage = (imageUrl: string, index: number) => {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `hoa - don - ${order.po_number} -${index + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Initialize return items when modal opens
    const openReturnModal = () => {
        setReturnItems(order.items.map(item => ({
            product_id: item.product_id,
            quantity: 0,
            max_qty: item.quantity - (item.returned_quantity || 0)
        })));
        setReturnReason('');
        setShowReturnModal(true);
    };

    const handleReturn = () => {
        const itemsToReturn = returnItems.filter(i => i.quantity > 0).map(i => ({
            product_id: i.product_id,
            quantity: i.quantity
        }));
        if (itemsToReturn.length > 0) {
            onReturn(itemsToReturn, returnReason || undefined);
            setShowReturnModal(false);
        }
    };

    const statusLabel = {
        draft: 'Nháp',
        confirmed: 'Đang giao dịch',
        received: 'Đã nhập hàng',
        cancelled: 'Đã hủy'
    }[order.status] || order.status;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            {/* Top Bar */}
            <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#6b7280', display: 'flex', alignItems: 'center' }}>
                        ‹ Quay lại danh sách nhập hàng
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onBack} style={{ padding: '6px 12px', border: '1px solid #d1d5db', backgroundColor: 'white', borderRadius: '4px', cursor: 'pointer' }}>Thoát</button>
                    {!isReceived && <button onClick={onEdit} style={{ padding: '6px 12px', border: '1px solid #d1d5db', backgroundColor: 'white', borderRadius: '4px', cursor: 'pointer' }}>Sửa đơn</button>}
                    {isReceived && <button onClick={openReturnModal} style={{ padding: '6px 12px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Hoàn trả</button>}
                </div>
            </header>

            {/* Header info & Stepper */}
            <div style={{ padding: '24px', backgroundColor: 'white', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{order.po_number}</h1>
                            <span style={{ fontSize: '13px', color: '#6b7280' }}>{new Date(order.created_at).toLocaleString('vi-VN')}</span>
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 500 }}>
                                {statusLabel}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                            <button style={{ padding: '6px 12px', border: '1px solid #e5e7eb', backgroundColor: 'white', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                                🖨️ In đơn
                            </button>
                            <button onClick={onDuplicate} style={{ padding: '6px 12px', border: '1px solid #e5e7eb', backgroundColor: 'white', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                                📋 Sao chép
                            </button>
                            <select
                                style={{ padding: '6px 12px', border: '1px solid #e5e7eb', backgroundColor: 'white', borderRadius: '4px', fontSize: '13px', cursor: 'pointer' }}
                                onChange={(e) => {
                                    if (e.target.value === 'print_barcode') {
                                        alert('In mã vạch (Chức năng đang phát triển)');
                                    } else if (e.target.value === 'transfer') {
                                        alert('Chuyển hàng (Chức năng đang phát triển)');
                                    }
                                    e.target.value = '';
                                }}
                            >
                                <option value="">Thao tác khác ▾</option>
                                <option value="print_barcode">📊 In mã vạch</option>
                                <option value="transfer">🚚 Chuyển hàng</option>
                            </select>
                        </div>
                    </div>

                    {/* Stepper (3 Steps) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                        <StepItem
                            label="Tạo đơn"
                            date={new Date(order.created_at).toLocaleString('vi-VN')}
                            active={true}
                            completed={true}
                            step={1}
                        />
                        <StepLine active={isReceived} />
                        <StepItem
                            label="Nhập hàng"
                            date={order.received_date ? new Date(order.received_date).toLocaleString('vi-VN') : undefined}
                            active={order.status !== 'draft'}
                            completed={isReceived}
                            step={2}
                        />
                        <StepLine active={isReceived && isPaid} />
                        <StepItem
                            label="Hoàn thành"
                            date={isReceived && isPaid ? 'Đã hoàn tất' : undefined}
                            active={isReceived}
                            completed={isReceived && isPaid}
                            step={3}
                        />
                    </div>
                </div>

                {/* Success Banner */}
                <div style={{ marginTop: '20px', padding: '12px 16px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#065f46', fontSize: '14px', fontWeight: 500 }}>
                        <span>✅</span>
                        <span>Đơn nhập hàng <strong>{order.po_number}</strong> đã được tạo thành công</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {order.status === 'confirmed' && (
                            <button onClick={onReceive} style={{ padding: '8px 16px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                ➕ Nhập đơn hàng này
                            </button>
                        )}
                        <button onClick={onCreateNew} style={{ padding: '8px 16px', backgroundColor: 'white', color: '#0284c7', border: '1px solid #0284c7', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            ➕ Tạo đơn nhập hàng khác
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>


                {/* INFO BOXES */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Supplier Box */}
                    <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>👤</span> Thông tin nhà cung cấp
                        </h3>
                        <a href="#" style={{ color: '#0284c7', fontWeight: 500, textDecoration: 'none', fontSize: '14px' }}>{supplier?.name || order.supplier_name}</a>
                        <div style={{ marginTop: '8px', fontSize: '13px', color: '#4b5563' }}>
                            Địa chỉ: {supplier?.address || 'HN'}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', marginTop: '12px', fontSize: '13px', gap: '8px' }}>
                            <span style={{ color: '#6b7280' }}>Công nợ</span>
                            <span style={{ color: '#ef4444', fontWeight: 500 }}>0</span>
                            <span style={{ color: '#6b7280' }}>Tổng đơn nhập (1 đơn)</span>
                            <span style={{ color: '#0284c7', fontWeight: 500 }}>{formatVND(order.total_amount)}</span>
                            <span style={{ color: '#6b7280' }}>Trả hàng</span>
                            <span style={{ color: '#ef4444', fontWeight: 500 }}>0</span>
                        </div>
                    </div>

                    {/* Order Info Box */}
                    <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>📄</span> Thông tin đơn nhập hàng
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: '8px', fontSize: '13px' }}>
                            <span style={{ color: '#6b7280' }}>Chi nhánh</span>
                            <span style={{ fontWeight: 500 }}>{order.branch_name || 'Chi nhánh mặc định'}</span>

                            <span style={{ color: '#6b7280' }}>Chính sách giá</span>
                            <span style={{ fontWeight: 500 }}>Giá nhập</span>

                            <span style={{ color: '#6b7280' }}>Nhân viên phụ trách</span>
                            <span style={{ fontWeight: 500 }}>{order.assigned_to || 'Vũ Huyền'}</span>

                            <span style={{ color: '#6b7280' }}>Ngày hẹn giao</span>
                            <span>{order.expected_date ? new Date(order.expected_date).toLocaleDateString('vi-VN') : '---'}</span>

                            <span style={{ color: '#6b7280' }}>Ngày nhập</span>
                            <span>{order.received_date ? new Date(order.received_date).toLocaleString('vi-VN') : '---'}</span>

                            <span style={{ color: '#6b7280' }}>Tham chiếu</span>
                            <span>{order.reference || '---'}</span>

                        </div>
                        <div style={{ marginTop: '12px', textAlign: 'right' }}>
                            <a href="#" style={{ fontSize: '13px', color: '#0284c7', textDecoration: 'none' }}>Xem lịch sử đơn nhập hàng</a>
                        </div>
                    </div>
                </div>

                {/* RECEIPT SECTION */}
                {isReceived && (
                    <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#10b981' }}>✅</span>
                            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Đơn nhập hàng đã nhập kho</h3>
                        </div>
                        <div style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0284c7' }}></span>
                                <a href="#" style={{ color: '#0284c7', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>
                                    {order.receipt_number || `PN - ${order.po_number} `}
                                </a>
                                <span style={{ color: '#6b7280', fontSize: '13px' }}>
                                    - {order.received_date ? new Date(order.received_date).toLocaleString('vi-VN') : ''}
                                </span>
                                <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#9ca3af' }}>🖨️</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* PAYMENT SECTION */}
                <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#6b7280' }}>💳</span>
                            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                                {remainingAmount > 0 ? 'Đơn nhập hàng chưa thanh toán' : 'Đơn nhập hàng đã thanh toán'}
                            </h3>
                        </div>
                        {remainingAmount > 0 && (
                            <button
                                onClick={() => setShowPaymentModal(true)}
                                style={{ padding: '6px 16px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                            >
                                Thanh toán
                            </button>
                        )}
                    </div>
                    <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <span style={{ fontSize: '13px', color: '#6b7280' }}>Tiền cần trả NCC: </span>
                            <span style={{ fontWeight: 600, fontSize: '14px' }}>{formatVND(order.total_amount)}</span>
                        </div>
                        <div>
                            <span style={{ fontSize: '13px', color: '#6b7280' }}>Đã trả: </span>
                            <span style={{ fontSize: '14px' }}>{formatVND(order.paid_amount)}</span>
                        </div>
                        <div>
                            <span style={{ fontSize: '13px', color: '#6b7280' }}>Còn phải trả: </span>
                            <span style={{ fontWeight: 600, fontSize: '14px', color: '#ef4444' }}>{formatVND(remainingAmount)}</span>
                        </div>
                    </div>
                </div>

                {/* PRODUCTS TABLE */}
                <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Thông tin sản phẩm</h3>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>⚙️</button>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead style={{ backgroundColor: '#f9fafb', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>
                            <tr>
                                <th style={{ padding: '10px 16px', textAlign: 'center', width: '50px' }}>STT</th>
                                <th style={{ padding: '10px 16px', textAlign: 'left', width: '60px' }}>Ảnh</th>
                                <th style={{ padding: '10px 16px', textAlign: 'left' }}>Tên sản phẩm</th>
                                <th style={{ padding: '10px 16px', textAlign: 'center', width: '80px' }}>Đơn vị</th>
                                <th style={{ padding: '10px 16px', textAlign: 'right', width: '80px' }}>SL nhập</th>
                                <th style={{ padding: '10px 16px', textAlign: 'right', width: '100px' }}>Đơn giá</th>
                                <th style={{ padding: '10px 16px', textAlign: 'right', width: '100px' }}>Giá bán</th>
                                <th style={{ padding: '10px 16px', textAlign: 'center', width: '80px' }}>± Giá nhập</th>
                                <th style={{ padding: '10px 16px', textAlign: 'center', width: '80px' }}>± Giá vốn</th>
                                <th style={{ padding: '10px 16px', textAlign: 'right', width: '100px' }}>Chiết khấu</th>
                                <th style={{ padding: '10px 16px', textAlign: 'right', width: '100px', color: '#059669' }}>Lợi nhuận</th>
                                <th style={{ padding: '10px 16px', textAlign: 'center', width: '60px', color: '#059669' }}>%</th>
                                <th style={{ padding: '10px 16px', textAlign: 'center', width: '60px' }}>Thuế</th>
                                <th style={{ padding: '10px 16px', textAlign: 'right', width: '120px' }}>Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.items.map((item, idx) => {
                                const product = products.find(p => p.id === item.product_id);
                                const sellingPrice = product?.selling_price || 0;
                                const importPrice = item.unit_price;
                                const profitPerUnit = sellingPrice - importPrice;
                                const totalProfit = profitPerUnit * item.quantity;
                                const profitPercent = importPrice > 0 ? ((profitPerUnit / importPrice) * 100) : 0;
                                return (
                                    <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#6b7280' }}>{idx + 1}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ width: '32px', height: '32px', backgroundColor: '#f3f4f6', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {product?.image_url ? <img src={product.image_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '4px' }} /> : '📦'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div
                                                style={{ color: '#0284c7', fontWeight: 500, cursor: 'pointer' }}
                                                onClick={() => product && setQuickViewProduct(product)}
                                            >
                                                {product?.name || 'Sản phẩm'}
                                            </div>
                                            <div style={{ color: '#6b7280', fontSize: '12px' }}>{product?.sku}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{product?.base_unit || 'Cái'}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{item.quantity}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatVND(item.unit_price)}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                            <input
                                                type="number"
                                                defaultValue={product?.selling_price || 0}
                                                style={{ width: '80px', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: '4px', textAlign: 'right', fontSize: '12px' }}
                                            />
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            {(() => {
                                                const prevPrice = product?.purchase_price || product?.cost_price || item.unit_price;
                                                const diff = item.unit_price - prevPrice;
                                                if (diff === 0) return <span style={{ color: '#6b7280' }}>-</span>;
                                                return (
                                                    <span style={{ color: diff > 0 ? '#ef4444' : '#10b981', fontWeight: 500 }}>
                                                        {diff > 0 ? '+' : ''}{formatVND(diff)}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            {(() => {
                                                const costPrice = product?.cost_price || 0;
                                                const diff = item.unit_price - costPrice;
                                                if (costPrice === 0) return <span style={{ color: '#6b7280' }}>-</span>;
                                                return (
                                                    <span style={{ color: diff > 0 ? '#ef4444' : '#10b981', fontWeight: 500 }}>
                                                        {diff > 0 ? '+' : ''}{formatVND(diff)}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>0</td>
                                        {/* Profit Amount */}
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: totalProfit >= 0 ? '#059669' : '#dc2626' }}>
                                            {totalProfit >= 0 ? '+' : ''}{formatVND(totalProfit)}
                                        </td>
                                        {/* Profit Percentage */}
                                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500, color: profitPercent >= 0 ? '#059669' : '#dc2626' }}>
                                            {profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(1)}%
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>0%</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>{formatVND(item.total_price)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>


                {/* Bottom Section: Notes/Tags & Totals */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
                    {/* Left Side: Notes & Tags */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Notes Box */}
                        <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e5e7eb', padding: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>Ghi chú đơn</label>
                            <div style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic' }}>
                                {order.notes || 'Chưa có ghi chú'}
                            </div>
                        </div>
                        {/* Tags Box */}
                        <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e5e7eb', padding: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>Tags</label>
                            <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                {order.tags?.length ? order.tags.join(', ') : 'Chưa có tags'}
                            </div>
                        </div>

                        {/* Invoice Images Box */}
                        {order.invoice_images && order.invoice_images.length > 0 && (
                            <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e5e7eb', padding: '16px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: '#374151' }}>
                                    📷 Ảnh hóa đơn <span style={{ fontWeight: 400, color: '#6b7280' }}>({order.invoice_images.length})</span>
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
                                    {order.invoice_images.map((imgUrl, idx) => (
                                        <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                                            <img
                                                src={imgUrl}
                                                alt={`Hóa đơn ${idx + 1} `}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                                onClick={() => setZoomedImage(imgUrl)}
                                            />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); downloadImage(imgUrl, idx); }}
                                                title="Tải về"
                                                style={{
                                                    position: 'absolute',
                                                    bottom: '4px',
                                                    right: '4px',
                                                    width: '24px',
                                                    height: '24px',
                                                    borderRadius: '50%',
                                                    backgroundColor: 'rgba(0,0,0,0.6)',
                                                    color: 'white',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                ⬇
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Side: Totals */}
                    <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e5e7eb', padding: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#6b7280' }}>Số lượng</span>
                                <span>{order.items.reduce((s, i) => s + i.quantity, 0)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#6b7280' }}>Tổng tiền</span>
                                <span>{formatVND(order.subtotal)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#0284c7', cursor: 'pointer' }}>Chiết khấu (F6)</span>
                                <span>0</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#6b7280' }}>Chi phí nhập hàng</span>
                                <span></span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <a href="#" style={{ color: '#0284c7', textDecoration: 'none', fontSize: '12px' }}>⊕ Thêm chi phí (F7)</a>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#6b7280' }}>Thuế ℹ️</span>
                                <span>0</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: '12px', marginTop: '4px' }}>
                                <span style={{ fontWeight: 600 }}>Tiền cần trả</span>
                                <span style={{ fontWeight: 600 }}>{formatVND(order.total_amount)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: '12px', marginTop: '4px' }}>
                                <span style={{ fontWeight: 600 }}>Thanh toán cho NCC</span>
                                <span></span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <a href="#" style={{ color: '#0284c7', textDecoration: 'none', fontSize: '12px' }}>⊕ Thêm phương thức</a>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: '12px', marginTop: '4px' }}>
                                <span style={{ fontWeight: 600 }}>Còn phải trả</span>
                                <span style={{ fontWeight: 600 }}>{formatVND(remainingAmount)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            {/* Modals */}
            {
                showPaymentModal && (
                    <PaymentModal
                        remainingAmount={remainingAmount}
                        onConfirm={(amount) => {
                            onPayment(amount);
                            setShowPaymentModal(false);
                        }}
                        onClose={() => setShowPaymentModal(false)}
                    />
                )
            }

            {
                showReturnModal && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', width: '600px', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                ↩️ Hoàn trả hàng - {order.po_number}
                            </h2>
                            {/* Products to return */}
                            <div style={{ marginBottom: '20px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                            <th style={{ padding: '12px', textAlign: 'left' }}>Sản phẩm</th>
                                            <th style={{ padding: '12px', textAlign: 'center', width: '100px' }}>Đã nhập</th>
                                            <th style={{ padding: '12px', textAlign: 'center', width: '100px' }}>Đã trả</th>
                                            <th style={{ padding: '12px', textAlign: 'center', width: '120px' }}>SL trả</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {order.items.map((item, idx) => {
                                            const product = products.find(p => p.id === item.product_id);
                                            const returnItem = returnItems.find(r => r.product_id === item.product_id);
                                            const maxQty = item.quantity - (item.returned_quantity || 0);
                                            return (
                                                <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                    <td style={{ padding: '12px' }}>
                                                        <div style={{ fontWeight: 500 }}>{product?.name || 'Sản phẩm'}</div>
                                                        <div style={{ fontSize: '12px', color: '#6b7280' }}>{product?.sku}</div>
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>{item.quantity}</td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>{item.returned_quantity || 0}</td>
                                                    <td style={{ padding: '12px' }} onClick={(e) => e.stopPropagation()}>
                                                        <QuantityInputStyled
                                                            value={returnItem?.quantity || 0}
                                                            onChange={(val) => {
                                                                setReturnItems(prev => prev.map(p =>
                                                                    p.product_id === item.product_id ? { ...p, quantity: Math.min(val, maxQty) } : p
                                                                ));
                                                            }}
                                                            min={0}
                                                            max={maxQty}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ marginTop: '20px' }}>
                                <label className="block text-sm font-medium mb-1">Lý do hoàn trả</label>
                                <textarea
                                    className="w-full border rounded-lg p-3"
                                    rows={3}
                                    placeholder="Nhập lý do hoàn trả..."
                                    value={returnReason}
                                    onChange={(e) => setReturnReason(e.target.value)}
                                />
                            </div>
                            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button onClick={() => setShowReturnModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: 'white' }}>Hủy</button>
                                <button onClick={handleReturn} style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: '#ef4444', color: 'white', fontWeight: 600 }}>Xác nhận hoàn trả</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Image Zoom Modal */}
            {zoomedImage && (
                <div
                    onClick={() => setZoomedImage(null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        cursor: 'zoom-out'
                    }}
                >
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                        <img
                            src={zoomedImage}
                            alt="Phóng to"
                            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div style={{ position: 'absolute', top: '-40px', right: '0', display: 'flex', gap: '8px' }}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const link = document.createElement('a');
                                    link.href = zoomedImage;
                                    link.download = `hoa - don - ${order.po_number}.png`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                ⬇ Tải về
                            </button>
                            <button
                                onClick={() => setZoomedImage(null)}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 500
                                }}
                            >
                                ✕ Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Quick View Modal */}
            <ProductQuickViewModal
                product={quickViewProduct}
                isOpen={!!quickViewProduct}
                onClose={() => setQuickViewProduct(null)}
                showEditButton={false}
            />

        </div >
    );
}

// Helper Components for Stepper
function StepItem({ label, date, active, completed, step }: { label: string, date?: string, active: boolean, completed: boolean, step: number }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px', position: 'relative' }}>
            <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                backgroundColor: completed ? '#0ea5e9' : (active ? '#0ea5e9' : '#e5e7eb'),
                color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 600,
                zIndex: 2
            }}>
                {completed ? '✓' : step}
            </div>
            <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: active ? 600 : 400, color: active ? '#111827' : '#9ca3af' }}>{label}</div>
            {date && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{date}</div>}
        </div>
    );
}

function StepLine({ active }: { active: boolean }) {
    return (
        <div style={{ height: '3px', flex: 1, backgroundColor: active ? '#0ea5e9' : '#e5e7eb', marginTop: '-24px', minWidth: '80px' }}></div>
    );
}



// =============================================================================
// History Timeline Component
// =============================================================================

function OrderHistoryTimeline({ history }: { history: ActivityLogEntry[] }) {
    if (!history || history.length === 0) {
        return <p style={{ color: '#6b7280', fontSize: '14px' }}>Chưa có hoạt động nào</p>;
    }

    // Group by date
    const grouped = history.reduce((acc, entry) => {
        const date = new Date(entry.timestamp).toLocaleDateString('vi-VN');
        if (!acc[date]) acc[date] = [];
        acc[date].push(entry);
        return acc;
    }, {} as Record<string, ActivityLogEntry[]>);

    return (
        <div>
            {Object.entries(grouped).map(([date, entries]) => (
                <div key={date} style={{ marginBottom: '20px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>{date}</p>
                    <div style={{ borderLeft: '2px solid #3b82f6', paddingLeft: '16px' }}>
                        {entries.map(entry => (
                            <div key={entry.id} style={{ marginBottom: '16px', position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '50%' }} />
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '13px', color: '#6b7280', minWidth: '50px' }}>
                                        {new Date(entry.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>{entry.user}</span>
                                    <span style={{ fontSize: '13px', color: '#6b7280' }}>{entry.action}</span>
                                </div>
                                {entry.details && (
                                    <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px', marginLeft: '62px' }}>{entry.details}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// =============================================================================
// Payment Modal
// =============================================================================

function PaymentModal({ remainingAmount, onConfirm, onClose }: {
    remainingAmount: number;
    onConfirm: (amount: number) => void;
    onClose: () => void;
}) {
    const [amount, setAmount] = useState(remainingAmount);

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', width: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>💳 Thanh toán cho NCC</h2>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '14px', color: '#6b7280', marginBottom: '6px' }}>Còn phải trả</label>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>{formatVND(remainingAmount)}</p>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', color: '#6b7280', marginBottom: '6px' }}>Số tiền thanh toán</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '16px', fontWeight: 600 }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '12px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '8px', fontWeight: 500, cursor: 'pointer' }}>
                        Hủy
                    </button>
                    <button onClick={() => onConfirm(amount)} style={{ flex: 1, padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                        ✅ Xác nhận
                    </button>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// Create/Edit Form
// =============================================================================

interface FormProps {
    order: PurchaseOrderWithItems | null;
    suppliers: Supplier[];
    products: Product[];
    onSave: (data: CreateOrderInput) => Promise<void>;
    onCancel: () => void;
}

function PurchaseOrderForm({ order, suppliers, products, onSave, onCancel }: FormProps) {
    const { addSupplier } = useSupplierStore();

    // Form state
    const [supplierId, setSupplierId] = useState(order?.supplier_id || '');
    const [notes, setNotes] = useState(order?.notes || '');
    const [invoiceImages, setInvoiceImages] = useState<InvoiceImage[]>(
        order?.invoice_images?.map((url, i) => ({ id: `saved - ${i} `, url, uploaded: true })) || []
    );
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const searchWrapperRef = useRef<HTMLDivElement>(null);

    // Close search dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
                setShowSearchDropdown(false);
            }
        };

        if (showSearchDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showSearchDropdown]);

    // Quick supplier create modal
    const [showSupplierModal, setShowSupplierModal] = useState(false);
    const [newSupplierName, setNewSupplierName] = useState('');
    const [newSupplierPhone, setNewSupplierPhone] = useState('');

    // Items with discount/tax
    interface OrderItem {
        product_id: string;
        unit_id?: string;
        quantity: number;
        unit_price: number;
        discount_type: '%' | 'vnd';
        discount_value: number;
        tax_percent: number;
        is_promotional: boolean;
    }
    const [items, setItems] = useState<OrderItem[]>(
        order?.items.map(i => ({
            product_id: i.product_id,
            unit_id: i.unit_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            discount_type: '%' as const,
            discount_value: 0,
            tax_percent: 0,
            is_promotional: false
        })) || []
    );

    // Order-level discount/cost/tax
    const [orderDiscountType, setOrderDiscountType] = useState<'%' | 'vnd'>('%');
    const [orderDiscountValue, setOrderDiscountValue] = useState(0);
    const [additionalCosts, setAdditionalCosts] = useState<{ note: string; type: '%' | 'vnd'; value: number }[]>([]);
    const [orderTaxType, setOrderTaxType] = useState<'%' | 'vnd'>('%');
    const [orderTaxValue, setOrderTaxValue] = useState(0);
    const [isOrderTaxApplied, setIsOrderTaxApplied] = useState(false);

    // Quick view modal state
    const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

    // Barcode selection modal state - for when multiple products have same barcode
    const [barcodeMatches, setBarcodeMatches] = useState<BarcodeMatch[]>([]);

    // Expanded unit rows state
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const toggleRowExpand = (index: number) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    // Unit dropdown popup state
    const [unitDropdownOpen, setUnitDropdownOpen] = useState<number | null>(null);

    // Close unit dropdown on click outside
    useEffect(() => {
        if (unitDropdownOpen === null) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-unit-dropdown]')) {
                setUnitDropdownOpen(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [unitDropdownOpen]);

    // Calculate totals
    const calculateItemTotal = (item: OrderItem) => {
        const subtotal = item.quantity * item.unit_price;
        const discount = item.discount_type === '%'
            ? subtotal * (item.discount_value / 100)
            : item.discount_value;
        const afterDiscount = subtotal - discount;
        const tax = afterDiscount * (item.tax_percent / 100);
        return afterDiscount + tax;
    };

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const itemsDiscount = items.reduce((sum, item) => {
        const s = item.quantity * item.unit_price;
        return sum + (item.discount_type === '%' ? s * (item.discount_value / 100) : item.discount_value);
    }, 0);
    const itemsTax = items.reduce((sum, item) => {
        const s = item.quantity * item.unit_price;
        const d = item.discount_type === '%' ? s * (item.discount_value / 100) : item.discount_value;
        return sum + ((s - d) * (item.tax_percent / 100));
    }, 0);

    const orderDiscount = orderDiscountType === '%' ? subtotal * (orderDiscountValue / 100) : orderDiscountValue;
    const totalCosts = additionalCosts.reduce((sum, c) => {
        return sum + (c.type === '%' ? subtotal * (c.value / 100) : c.value);
    }, 0);
    const orderTax = isOrderTaxApplied ? (orderTaxType === '%' ? (subtotal - orderDiscount) * (orderTaxValue / 100) : orderTaxValue) : 0;

    const totalAmount = subtotal - itemsDiscount + itemsTax - orderDiscount + totalCosts + orderTax;

    // Calculate final cost price per item (after distributing order discount & costs)
    const calculateFinalCostPrice = (item: OrderItem, index: number) => {
        if (item.is_promotional) return 0; // Promotional items have 0 cost

        // Non-promotional items
        const nonPromoItems = items.filter(i => !i.is_promotional);
        const nonPromoSubtotal = nonPromoItems.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);

        if (nonPromoSubtotal === 0) return item.unit_price;

        // Item's share of the subtotal (for proportional distribution)
        const itemValue = item.quantity * item.unit_price;
        const shareRatio = itemValue / nonPromoSubtotal;

        // Distribute order discount and costs proportionally
        const itemOrderDiscount = orderDiscount * shareRatio;
        const itemCosts = totalCosts * shareRatio;
        const itemOrderTax = orderTax * shareRatio;

        // Final cost = unit_price - (discount/qty) + (costs/qty) + (tax/qty)
        const adjustedTotal = itemValue - itemOrderDiscount + itemCosts + itemOrderTax;
        return adjustedTotal / item.quantity;
    };

    // Check if totals match (for mismatch warning)
    const expectedTotal = subtotal - orderDiscount + totalCosts + orderTax;
    const hasMismatch = Math.abs(totalAmount - expectedTotal) > 1; // Allow small rounding diff

    // Count promotional items
    const promoItemCount = items.filter(i => i.is_promotional).length;
    const regularItemCount = items.length - promoItemCount;

    // Filtered products for search (show recent if no query)
    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) {
            return getRecentProducts(products, 10);
        }
        return searchProducts(products, searchQuery);
    }, [products, searchQuery]);

    // Add product from search
    const addProductToOrder = (item: ProductSearchItem) => {
        // Check existing: match product_id AND unit_id
        const existing = items.findIndex(i => i.product_id === item.product_id && i.unit_id === item.unit?.id); // Allow undefined === undefined

        if (existing >= 0) {
            setItems(items.map((it, i) => i === existing ? { ...it, quantity: it.quantity + 1 } : it));
        } else {
            setItems([...items, {
                product_id: item.product_id,
                unit_id: item.unit?.id,
                quantity: 1,
                unit_price: item.purchase_price || item.cost_price || 0,
                discount_type: '%',
                discount_value: 0,
                tax_percent: 0,
                is_promotional: false
            }]);
        }
        setSearchQuery('');
        setShowSearchDropdown(false);
    };

    const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

    const updateItem = (index: number, field: keyof OrderItem, value: any) => {
        setItems(prevItems => prevItems.map((item, i) => {
            if (i !== index) return item;
            if (field === 'product_id') {
                const product = products.find(p => p.id === value);
                return { ...item, product_id: value, unit_price: product?.purchase_price || product?.cost_price || 0 };
            }
            return { ...item, [field]: value };
        }));
    };

    // Update unit and price together to avoid stale state
    const updateItemUnit = (index: number, unitId: string | undefined, unitPrice: number) => {
        setItems(prevItems => prevItems.map((item, i) => {
            if (i !== index) return item;
            return { ...item, unit_id: unitId, unit_price: unitPrice };
        }));
    };

    // Quick create supplier
    const handleCreateSupplier = async () => {
        if (!newSupplierName.trim()) return;
        const newSupplier = await addSupplier({
            name: newSupplierName,
            phone: newSupplierPhone,
            email: '',
            address: '',
            contact_person: '',
            payment_terms: 0,
            is_active: true,
            notes: '',
            debt_balance: 0
        });
        if (newSupplier) {
            setSupplierId(newSupplier.id);
        }
        setShowSupplierModal(false);
        setNewSupplierName('');
        setNewSupplierPhone('');
    };

    // Helper to convert blob URLs to compressed base64 for persistence
    const convertBlobToBase64 = async (url: string): Promise<string> => {
        if (!url.startsWith('blob:')) return url; // Already a URL or base64
        try {
            const response = await fetch(url);
            const blob = await response.blob();

            // Create image and compress using canvas
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxSize = 800; // Max dimension
                    let { width, height } = img;

                    // Scale down if needed
                    if (width > maxSize || height > maxSize) {
                        if (width > height) {
                            height = (height / width) * maxSize;
                            width = maxSize;
                        } else {
                            width = (width / height) * maxSize;
                            height = maxSize;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Cannot get canvas context'));
                        return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG with 60% quality (~50-100KB per image)
                    const compressed = canvas.toDataURL('image/jpeg', 0.6);
                    resolve(compressed);
                };
                img.onerror = reject;
                img.src = URL.createObjectURL(blob);
            });
        } catch {
            return url; // Return original if conversion fails
        }
    };

    const handleSubmit = async (options: { isDraft?: boolean; autoReceive?: boolean } = {}) => {
        if (!supplierId || items.length === 0) {
            alert('Vui lòng chọn NCC và thêm ít nhất 1 sản phẩm');
            return;
        }
        setIsSaving(true);

        try {
            // Convert blob URLs to base64 for persistence (skip if no images)
            const imageUrls: string[] = [];
            if (invoiceImages && invoiceImages.length > 0) {
                for (const img of invoiceImages) {
                    if (img.url) {
                        try {
                            const base64 = await convertBlobToBase64(img.url);
                            imageUrls.push(base64);
                        } catch (e) {
                            console.warn('Skipping image conversion:', e);
                        }
                    }
                }
            }

            await onSave({
                supplier_id: supplierId,
                items: items.map(i => ({
                    product_id: i.product_id,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    discount_percent: i.discount_type === '%' ? i.discount_value : 0,
                    tax_percent: i.tax_percent
                })),
                notes,
                invoice_images: imageUrls.length > 0 ? imageUrls : undefined,
                is_draft: options.isDraft ?? false,
                auto_receive: options.autoReceive ?? false,
                total_amount: totalAmount
            });
        } catch (error: any) {
            console.error('Failed to save order:', error);
            const errorMsg = error?.message || error?.toString() || 'Unknown error';
            alert(`Lỗi khi lưu đơn hàng: ${errorMsg} `);
        } finally {
            setIsSaving(false);
        }
    };

    const selectedSupplier = suppliers.find(s => s.id === supplierId);

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            {/* Header */}
            <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 24px', position: 'sticky', top: 0, zIndex: 50 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', padding: '8px' }}>
                            ← Quay lại
                        </button>
                        <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
                            {order ? 'Sửa đơn nhập hàng' : 'Tạo đơn nhập hàng'}
                        </h1>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={onCancel}
                            style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}
                        >
                            Thoát
                        </button>
                        <button
                            onClick={() => handleSubmit({ isDraft: false, autoReceive: false })}
                            disabled={isSaving}
                            style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                        >
                            {isSaving ? '⏳ Đang lưu...' : (order ? 'Lưu' : 'Tạo đơn hàng')}
                        </button>
                    </div>
                </div>
            </header>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Top Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
                    {/* Supplier Section */}
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Thông tin nhà cung cấp</h3>
                        <div style={{ position: 'relative' }}>
                            <select
                                value={supplierId}
                                onChange={(e) => {
                                    if (e.target.value === '__create__') {
                                        setShowSupplierModal(true);
                                    } else {
                                        setSupplierId(e.target.value);
                                    }
                                }}
                                style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
                            >
                                <option value="">🔍 Tìm theo tên, SĐT, mã nhà cung cấp... (F4)</option>
                                <option value="__create__" style={{ color: '#3b82f6', fontWeight: 600 }}>➕ Tạo nhà cung cấp mới</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} {s.phone ? `- ${s.phone} ` : ''}</option>
                                ))}
                            </select>
                        </div>

                        {/* Selected Supplier Info */}
                        {selectedSupplier && (
                            <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: '#3b82f6', fontWeight: 600 }}>{selectedSupplier.name}</span>
                                    <span style={{ color: '#6b7280', fontSize: '13px' }}>{selectedSupplier.phone}</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', fontSize: '13px' }}>
                                    <div>
                                        <span style={{ color: '#6b7280' }}>Công nợ</span>
                                        <p style={{ fontWeight: 600, color: '#ef4444', margin: '4px 0 0' }}>{formatVND(0)}</p>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280' }}>Tổng đơn nhập</span>
                                        <p style={{ fontWeight: 600, color: '#3b82f6', margin: '4px 0 0' }}>0 đơn</p>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280' }}>Trả hàng</span>
                                        <p style={{ fontWeight: 600, margin: '4px 0 0' }}>{formatVND(0)}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!selectedSupplier && !supplierId && (
                            <div style={{ marginTop: '24px', textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                                <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>📦</span>
                                <p>Chưa có thông tin nhà cung cấp</p>
                            </div>
                        )}
                    </div>
                    {/* Order Info (Moved from bottom) */}
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Thông tin đơn nhập hàng</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#6b7280' }}>Chi nhánh</span>
                                <select style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '6px', minWidth: '150px' }}>
                                    <option>Chi nhánh mặc định</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#6b7280' }}>Nhân viên</span>
                                <select style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '6px', minWidth: '150px' }}>
                                    <option>Admin</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#6b7280' }}>Ngày hẹn giao</span>
                                <input type="date" style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                            </div>
                        </div>
                    </div>
                </div>
                {/* Flex Wrapper for Products */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Products Section */}
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Thông tin sản phẩm</h3>

                        </div>

                        {/* Product Search */}
                        <div style={{ position: 'relative', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={{ flex: 1, position: 'relative' }} ref={searchWrapperRef}>
                                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔍</span>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => { setSearchQuery(e.target.value); setShowSearchDropdown(true); }}
                                        onFocus={() => setShowSearchDropdown(true)}
                                        // onBlur handled by click outside ref
                                        placeholder="Tìm theo tên, mã SKU, hoặc quét mã Barcode...(F3)"
                                        style={{ width: '100%', padding: '12px 48px 12px 40px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const query = searchQuery.trim();
                                                if (!query) return;

                                                // First, check for exact barcode matches (including unit barcodes)
                                                const matches = findProductsByBarcode(products, query);

                                                if (matches.length === 0) {
                                                    // No exact barcode match - use search results
                                                    if (filteredProducts.length > 0) {
                                                        addProductToOrder(filteredProducts[0]);
                                                    }
                                                } else if (matches.length === 1) {
                                                    // Single barcode match - add directly
                                                    const match = matches[0];
                                                    const searchItem: ProductSearchItem = {
                                                        id: match.product.id,
                                                        product_id: match.product.id,
                                                        name: match.product.name,
                                                        sku: match.product.sku ?? undefined,
                                                        barcode: match.barcode,
                                                        image_url: match.product.image_url ?? undefined,
                                                        price: match.price,
                                                        cost_price: match.unit ? (match.unit.cost_price || match.product.cost_price * match.unit.conversion_rate) : match.product.cost_price,
                                                        purchase_price: match.product.purchase_price ? (match.unit ? match.product.purchase_price * match.unit.conversion_rate : match.product.purchase_price) : undefined,
                                                        stock: match.stock,
                                                        unit_name: match.displayUnit,
                                                        type: match.unit ? 'unit' : 'product',
                                                        product: match.product,
                                                        unit: match.unit ? {
                                                            id: match.unit.id,
                                                            unit_name: match.unit.unit_name,
                                                            conversion_rate: match.unit.conversion_rate
                                                        } : undefined
                                                    };
                                                    addProductToOrder(searchItem);
                                                } else {
                                                    // Multiple barcode matches - show selection modal
                                                    setBarcodeMatches(matches);
                                                }
                                            }
                                        }}
                                    />
                                    {/* Barcode scan button */}
                                    <button
                                        type="button"
                                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
                                        title="Quét mã vạch"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M3 5V3h4M17 3h4v2M3 19v2h4M17 21h4v-2" />
                                            <path d="M7 7v10M11 7v10M15 7v10M19 7v10" strokeWidth="1.5" />
                                        </svg>
                                    </button>

                                    {/* Search Dropdown */}
                                    {showSearchDropdown && filteredProducts.length > 0 && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', zIndex: 100, maxHeight: '300px', overflow: 'auto' }}>
                                            {/* Header showing search mode */}
                                            {!searchQuery.trim() && (
                                                <div style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb', fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
                                                    📋 Sản phẩm gần đây
                                                </div>
                                            )}
                                            {filteredProducts.map(item => (
                                                <div
                                                    key={item.id}
                                                    onClick={() => addProductToOrder(item)}
                                                    style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6' }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                                >
                                                    <div>
                                                        <p style={{ margin: 0, fontWeight: 500 }}>{item.name}</p>
                                                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>
                                                            {item.sku || item.barcode || ''}
                                                            {item.unit_name ? ` • ${item.unit_name} ` : ''}
                                                        </p>
                                                    </div>
                                                    <span style={{ fontWeight: 600, color: '#10b981' }}>{formatVND(item.cost_price)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Product Table */}
                        {items.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                                <span style={{ fontSize: '60px', display: 'block', marginBottom: '16px' }}>📦</span>
                                <p style={{ margin: '0 0 16px' }}>Đơn hàng nhập của bạn chưa có sản phẩm nào</p>
                                <button
                                    onClick={() => document.querySelector<HTMLInputElement>('input[placeholder*="F3"]')?.focus()}
                                    style={{ padding: '10px 24px', backgroundColor: 'white', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}
                                >
                                    Thêm sản phẩm
                                </button>
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 500, color: '#6b7280', width: '40px' }}>STT</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 500, color: '#6b7280', width: '50px' }}>Ảnh</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 500, color: '#6b7280' }}>Tên sản phẩm</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 500, color: '#6b7280', width: '70px' }}>Đơn vị</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 500, color: '#6b7280', width: '80px' }}>SL nhập</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500, color: '#6b7280', width: '100px' }}>Đơn giá</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 500, color: '#6b7280', width: '90px' }}>Chiết khấu</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 500, color: '#6b7280', width: '70px' }}>Thuế %</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500, color: '#6b7280', width: '110px' }}>Thành tiền</th>
                                        <th style={{ width: '40px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, index) => {
                                        const product = products.find(p => p.id === item.product_id);
                                        const itemTotal = calculateItemTotal(item);
                                        return (
                                            <>
                                                <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{index + 1}</td>
                                                    <td style={{ padding: '12px 8px' }}>
                                                        <div style={{ width: '40px', height: '40px', backgroundColor: '#f3f4f6', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                                            {product?.image_url ? <img src={product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} /> : '📦'}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 8px' }}>
                                                        <div>
                                                            <span
                                                                style={{ color: '#3b82f6', fontWeight: 500, cursor: 'pointer' }}
                                                                onClick={() => product && setQuickViewProduct(product)}
                                                            >
                                                                {product?.name || 'Sản phẩm'}
                                                            </span>
                                                            {item.is_promotional && <span style={{ marginLeft: '8px', padding: '2px 6px', backgroundColor: '#fef3c7', color: '#92400e', fontSize: '11px', borderRadius: '4px' }}>KM</span>}
                                                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>{product?.sku}</p>
                                                            {/* Expand arrow for products with unit conversions */}
                                                            {product?.units && product.units.length > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleRowExpand(index)}
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        cursor: 'pointer',
                                                                        color: '#0284c7',
                                                                        fontSize: '12px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        marginTop: '4px'
                                                                    }}
                                                                >
                                                                    <span style={{ fontSize: '10px' }}>{expandedRows.has(index) ? '▲' : '▼'}</span>
                                                                    Chi tiết sản phẩm
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td data-unit-dropdown style={{ padding: '12px 8px', textAlign: 'center', position: 'relative' }}>
                                                        {/* Clickable unit cell */}
                                                        <button
                                                            type="button"
                                                            onClick={() => product?.units && product.units.length > 0 ? setUnitDropdownOpen(unitDropdownOpen === index ? null : index) : undefined}
                                                            style={{
                                                                background: 'none',
                                                                border: product?.units && product.units.length > 0 ? '1px solid #e5e7eb' : 'none',
                                                                borderRadius: '6px',
                                                                padding: '6px 12px',
                                                                cursor: product?.units && product.units.length > 0 ? 'pointer' : 'default',
                                                                fontSize: '13px',
                                                                color: product?.units && product.units.length > 0 ? '#0284c7' : '#6b7280',
                                                                fontWeight: product?.units && product.units.length > 0 ? 500 : 400,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}
                                                        >
                                                            {(() => {
                                                                if (!product) return item.unit_id || 'Cái';
                                                                if (item.unit_id) {
                                                                    // Find unit by id or by unit_name (fallback for empty ids)
                                                                    const unit = product.units?.find(u =>
                                                                        (u.id && u.id === item.unit_id) || u.unit_name === item.unit_id
                                                                    );
                                                                    return unit?.unit_name || product.base_unit;
                                                                }
                                                                return product.base_unit || 'Cái';
                                                            })()}
                                                            {product?.units && product.units.length > 0 && (
                                                                <span style={{ fontSize: '10px' }}>{unitDropdownOpen === index ? '▲' : '▼'}</span>
                                                            )}
                                                        </button>

                                                        {/* Unit selection dropdown */}
                                                        {unitDropdownOpen === index && product?.units && product.units.length > 0 && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: '100%',
                                                                left: '50%',
                                                                transform: 'translateX(-50%)',
                                                                backgroundColor: 'white',
                                                                border: '1px solid #e5e7eb',
                                                                borderRadius: '8px',
                                                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                                                zIndex: 100,
                                                                minWidth: '200px',
                                                                padding: '8px 0'
                                                            }}>
                                                                {/* Base unit option */}
                                                                <div
                                                                    onClick={() => {
                                                                        updateItemUnit(index, undefined, product.cost_price || 0);
                                                                        setUnitDropdownOpen(null);
                                                                    }}
                                                                    style={{
                                                                        padding: '10px 16px',
                                                                        cursor: 'pointer',
                                                                        backgroundColor: !item.unit_id ? '#dbeafe' : 'transparent',
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'center'
                                                                    }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = !item.unit_id ? '#dbeafe' : '#f3f4f6'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = !item.unit_id ? '#dbeafe' : 'transparent'}
                                                                >
                                                                    <span style={{ fontWeight: 500 }}>{product.base_unit} <span style={{ color: '#6b7280', fontSize: '11px' }}>(gốc)</span></span>
                                                                    {!item.unit_id && <span style={{ color: '#3b82f6' }}>✓</span>}
                                                                </div>

                                                                {/* Conversion units */}
                                                                {product.units.map((unit, unitIdx) => {
                                                                    // Use unit.id or fallback to unit.unit_name for products with empty IDs
                                                                    const unitIdentifier = unit.id || unit.unit_name;
                                                                    const isSelected = item.unit_id === unitIdentifier;
                                                                    return (
                                                                        <div
                                                                            key={unitIdx}
                                                                            onClick={() => {
                                                                                updateItemUnit(index, unitIdentifier, (product.cost_price || 0) * unit.conversion_rate);
                                                                                setUnitDropdownOpen(null);
                                                                            }}
                                                                            style={{
                                                                                padding: '10px 16px',
                                                                                cursor: 'pointer',
                                                                                backgroundColor: isSelected ? '#dbeafe' : 'transparent',
                                                                                display: 'flex',
                                                                                justifyContent: 'space-between',
                                                                                alignItems: 'center'
                                                                            }}
                                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isSelected ? '#dbeafe' : '#f3f4f6'}
                                                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isSelected ? '#dbeafe' : 'transparent'}
                                                                        >
                                                                            <div>
                                                                                <span style={{ fontWeight: 500 }}>{unit.unit_name}</span>
                                                                                <div style={{ fontSize: '11px', color: '#6b7280' }}>= {unit.conversion_rate} {product.base_unit}</div>
                                                                            </div>
                                                                            {isSelected && <span style={{ color: '#3b82f6' }}>✓</span>}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '8px' }}>
                                                        <QuantityInputStyled
                                                            value={item.quantity}
                                                            onChange={(val) => updateItem(index, 'quantity', val)}
                                                            min={1}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '8px' }}>
                                                        <CurrencyInput
                                                            value={item.unit_price}
                                                            onValueChange={(val) => updateItem(index, 'unit_price', val)}
                                                            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', textAlign: 'right' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '8px' }}>
                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            {item.discount_type === '%' ? (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="100"
                                                                    value={item.discount_value}
                                                                    onChange={(e) => {
                                                                        let val = Number(e.target.value);
                                                                        if (val > 100) val = 100;
                                                                        updateItem(index, 'discount_value', val);
                                                                    }}
                                                                    style={{ width: '80px', padding: '8px 4px', border: '1px solid #fbbf24', borderRadius: '6px 0 0 6px', textAlign: 'center', backgroundColor: '#fffbeb' }}
                                                                />
                                                            ) : (
                                                                <CurrencyInput
                                                                    value={item.discount_value}
                                                                    onValueChange={(val) => updateItem(index, 'discount_value', val)}
                                                                    style={{ width: '100px', padding: '8px 4px', border: '1px solid #fbbf24', borderRadius: '6px 0 0 6px', textAlign: 'center', backgroundColor: '#fffbeb' }}
                                                                />
                                                            )}
                                                            <select
                                                                value={item.discount_type}
                                                                onChange={(e) => updateItem(index, 'discount_type', e.target.value)}
                                                                style={{ padding: '8px 2px', border: '1px solid #fbbf24', borderRadius: '0 6px 6px 0', backgroundColor: '#fffbeb', fontSize: '12px' }}
                                                            >
                                                                <option value="%">%</option>
                                                                <option value="vnd">₫</option>
                                                            </select>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '8px' }}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="0.1"
                                                            value={item.tax_percent}
                                                            onChange={(e) => updateItem(index, 'tax_percent', Number(e.target.value))}
                                                            style={{ width: '100%', padding: '8px', border: '1px solid #a3e635', borderRadius: '6px', textAlign: 'center', backgroundColor: '#f7fee7' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>{formatVND(itemTotal)}</td>
                                                    <td style={{ padding: '8px', display: 'flex', gap: '4px', alignItems: 'center' }}>

                                                        <button onClick={() => removeItem(index)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>✕</button>
                                                    </td>
                                                </tr>
                                                {/* Expanded Unit Details Row */}
                                                {expandedRows.has(index) && product?.units && product.units.length > 0 && (
                                                    <tr style={{ backgroundColor: '#f0f9ff' }}>
                                                        <td colSpan={10} style={{ padding: '12px 16px' }}>
                                                            <div style={{ fontSize: '13px' }}>
                                                                <div style={{ marginBottom: '8px', fontWeight: 600, color: '#374151' }}>Đơn vị quy đổi</div>

                                                                {/* Base unit row */}
                                                                <div
                                                                    onClick={() => {
                                                                        updateItem(index, 'unit_id', undefined);
                                                                        updateItem(index, 'unit_price', product.cost_price || 0);
                                                                    }}
                                                                    style={{
                                                                        display: 'grid',
                                                                        gridTemplateColumns: '140px 80px 100px 120px 100px auto',
                                                                        gap: '8px',
                                                                        padding: '8px 12px',
                                                                        backgroundColor: !item.unit_id ? '#dbeafe' : 'white',
                                                                        borderRadius: '6px',
                                                                        marginBottom: '4px',
                                                                        cursor: 'pointer',
                                                                        border: !item.unit_id ? '2px solid #3b82f6' : '1px solid #e5e7eb'
                                                                    }}
                                                                >
                                                                    <span style={{ fontWeight: 500 }}>{product.base_unit} <span style={{ color: '#6b7280', fontSize: '11px' }}>(gốc)</span></span>
                                                                    <span style={{ color: '#6b7280' }}>= 1</span>
                                                                    <span style={{ color: '#6b7280' }}>{product.sku || '---'}</span>
                                                                    <span style={{ color: '#6b7280' }}>{product.barcode || '---'}</span>
                                                                    <span style={{ fontWeight: 600, color: '#10b981' }}>{formatVND(product.selling_price)}</span>
                                                                    {!item.unit_id && <span style={{ color: '#3b82f6', fontWeight: 500 }}>✓ Đang chọn</span>}
                                                                </div>

                                                                {/* Conversion units */}
                                                                {product.units.map((unit, unitIdx) => (
                                                                    <div
                                                                        key={unitIdx}
                                                                        onClick={() => {
                                                                            updateItem(index, 'unit_id', unit.id);
                                                                            updateItem(index, 'unit_price', (product.cost_price || 0) * unit.conversion_rate);
                                                                        }}
                                                                        style={{
                                                                            display: 'grid',
                                                                            gridTemplateColumns: '140px 80px 100px 120px 100px auto',
                                                                            gap: '8px',
                                                                            padding: '8px 12px',
                                                                            backgroundColor: item.unit_id === unit.id ? '#dbeafe' : 'white',
                                                                            borderRadius: '6px',
                                                                            marginBottom: '4px',
                                                                            cursor: 'pointer',
                                                                            border: item.unit_id === unit.id ? '2px solid #3b82f6' : '1px solid #e5e7eb'
                                                                        }}
                                                                    >
                                                                        <span style={{ fontWeight: 500 }}>{unit.unit_name}</span>
                                                                        <span style={{ color: '#6b7280' }}>= {unit.conversion_rate} {product.base_unit}</span>
                                                                        <span style={{ color: '#6b7280' }}>{unit.sku || '---'}</span>
                                                                        <span style={{ color: '#6b7280' }}>{unit.barcode || '---'}</span>
                                                                        <span style={{ fontWeight: 600, color: '#10b981' }}>{formatVND(unit.selling_price || product.selling_price * unit.conversion_rate)}</span>
                                                                        {item.unit_id === unit.id && <span style={{ color: '#3b82f6', fontWeight: 500 }}>✓ Đang chọn</span>}
                                                                    </div>
                                                                ))}

                                                                <button
                                                                    onClick={() => toggleRowExpand(index)}
                                                                    style={{ marginTop: '8px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                                                                >
                                                                    ▲ Thu gọn
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        );
                                    })}
                                </tbody >
                            </table>
                        )}
                    </div>

                    {/* Notes */}

                </div>

                {/* Bottom Section: Notes & Totals */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
                    {/* Notes (Moved from top) */}
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div>
                                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Ghi chú đơn</h4>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="VD: Hàng tặng giỏi riêng"
                                    style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', minHeight: '80px', resize: 'vertical' }}
                                />
                            </div>
                            <div>
                                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Tags</h4>
                                <input
                                    type="text"
                                    placeholder="Nhập ký tự và ấn enter"
                                    style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px' }}
                                />
                            </div>
                        </div>

                        {/* Invoice Image Upload */}
                        <InvoiceImageUpload
                            images={invoiceImages}
                            onImagesChange={setInvoiceImages}
                        />
                    </div>

                    {/* Order Totals */}
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#6b7280' }}>Số lượng</span>
                                <span style={{ fontWeight: 500 }}>{items.reduce((s, i) => s + i.quantity, 0)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#6b7280' }}>Tổng tiền</span>
                                <span style={{ fontWeight: 500 }}>{formatVND(subtotal)}</span>
                            </div>

                            {/* Order Discount */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#3b82f6', cursor: 'pointer' }}>Chiết khấu (F6)</span>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    {orderDiscountType === '%' ? (
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={orderDiscountValue}
                                            onChange={(e) => {
                                                let val = Number(e.target.value);
                                                if (val > 100) val = 100;
                                                setOrderDiscountValue(val);
                                            }}
                                            style={{ width: '80px', padding: '6px', border: '1px solid #d1d5db', borderRadius: '6px', textAlign: 'right' }}
                                        />
                                    ) : (
                                        <CurrencyInput
                                            value={orderDiscountValue}
                                            onValueChange={(val) => setOrderDiscountValue(val)}
                                            style={{ width: '100px', padding: '6px', border: '1px solid #d1d5db', borderRadius: '6px', textAlign: 'right' }}
                                        />
                                    )}
                                    <select
                                        value={orderDiscountType}
                                        onChange={(e) => setOrderDiscountType(e.target.value as '%' | 'vnd')}
                                        style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                                    >
                                        <option value="%">%</option>
                                        <option value="vnd">₫</option>
                                    </select>
                                    <span style={{ minWidth: '80px', textAlign: 'right' }}>{formatVND(orderDiscount)}</span>
                                </div>
                            </div>

                            {/* Additional Costs */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: '#6b7280' }}>Chi phí nhập hàng</span>
                                </div>
                                {additionalCosts.map((cost, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            value={cost.note}
                                            onChange={(e) => setAdditionalCosts(costs => costs.map((c, i) => i === idx ? { ...c, note: e.target.value } : c))}
                                            placeholder="Ghi chú"
                                            style={{ flex: 1, padding: '6px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                                        />
                                        {cost.type === '%' ? (
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={cost.value}
                                                onChange={(e) => {
                                                    let val = Number(e.target.value);
                                                    if (val > 100) val = 100;
                                                    setAdditionalCosts(costs => costs.map((c, i) => i === idx ? { ...c, value: val } : c));
                                                }}
                                                style={{ width: '80px', padding: '6px', border: '1px solid #d1d5db', borderRadius: '6px', textAlign: 'right' }}
                                            />
                                        ) : (
                                            <CurrencyInput
                                                value={cost.value}
                                                onValueChange={(val) => setAdditionalCosts(costs => costs.map((c, i) => i === idx ? { ...c, value: val } : c))}
                                                style={{ width: '100px', padding: '6px', border: '1px solid #d1d5db', borderRadius: '6px', textAlign: 'right' }}
                                            />
                                        )}
                                        <select
                                            value={cost.type}
                                            onChange={(e) => setAdditionalCosts(costs => costs.map((c, i) => i === idx ? { ...c, type: e.target.value as '%' | 'vnd' } : c))}
                                            style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                                        >
                                            <option value="%">%</option>
                                            <option value="vnd">₫</option>
                                        </select>
                                        <button onClick={() => setAdditionalCosts(costs => costs.filter((_, i) => i !== idx))} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => setAdditionalCosts([...additionalCosts, { note: '', type: 'vnd', value: 0 }])}
                                    style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                    ➕ Thêm chi phí (F7)
                                </button>
                            </div>

                            {/* Tax */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={isOrderTaxApplied}
                                        onChange={(e) => setIsOrderTaxApplied(e.target.checked)}
                                    />
                                    <span style={{ color: '#6b7280' }}>Thuế ⓘ</span>
                                </label>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', opacity: isOrderTaxApplied ? 1 : 0.5 }}>
                                    {orderTaxType === '%' ? (
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            value={orderTaxValue}
                                            onChange={(e) => {
                                                let val = Number(e.target.value);
                                                if (val > 100) val = 100;
                                                setOrderTaxValue(val);
                                            }}
                                            disabled={!isOrderTaxApplied}
                                            style={{ width: '80px', padding: '6px', border: '1px solid #d1d5db', borderRadius: '6px', textAlign: 'right' }}
                                        />
                                    ) : (
                                        <CurrencyInput
                                            value={orderTaxValue}
                                            onValueChange={(val) => setOrderTaxValue(val)}
                                            disabled={!isOrderTaxApplied}
                                            style={{ width: '100px', padding: '6px', border: '1px solid #d1d5db', borderRadius: '6px', textAlign: 'right' }}
                                        />
                                    )}
                                    <select
                                        value={orderTaxType}
                                        onChange={(e) => setOrderTaxType(e.target.value as '%' | 'vnd')}
                                        style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                                    >
                                        <option value="%">%</option>
                                        <option value="vnd">₫</option>
                                    </select>
                                    <span style={{ minWidth: '80px', textAlign: 'right' }}>{formatVND(orderTax)}</span>
                                </div>
                            </div>

                            {/* Promotional Items Info */}
                            {promoItemCount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: '#fef3c7', borderRadius: '6px', fontSize: '13px' }}>
                                    <span style={{ color: '#92400e' }}>🎁 SP khuyến mại</span>
                                    <span style={{ color: '#92400e', fontWeight: 500 }}>{promoItemCount} sản phẩm</span>
                                </div>
                            )}

                            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                    <span>Tiền cần trả</span>
                                    <span style={{ fontSize: '18px', color: '#10b981' }}>{formatVND(totalAmount)}</span>
                                </div>
                            </div>

                            {/* Payment Section */}
                            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: '#6b7280' }}>Thanh toán cho NCC</span>
                                </div>
                                <button style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    ➕ Thêm phương thức
                                </button>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#ef4444' }}>
                                <span>Còn phải trả</span>
                                <span>{formatVND(totalAmount)}</span>
                            </div>

                            {/* Mismatch Warning */}
                            {hasMismatch && (
                                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
                                        <span style={{ fontSize: '18px' }}>⚠️</span>
                                        <span style={{ fontWeight: 500 }}>Số tiền không khớp!</span>
                                    </div>
                                    <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#7f1d1d' }}>
                                        Kiểm tra lại chiết khấu và chi phí của đơn hàng.
                                    </p>
                                </div>
                            )}

                            {/* Invoice Images Section */}
                            <InvoiceImageUpload
                                images={invoiceImages}
                                onImagesChange={setInvoiceImages}
                                maxImages={10}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Supplier Modal */}
            {showSupplierModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', width: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>➕ Tạo nhà cung cấp nhanh</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', color: '#374151', marginBottom: '6px' }}>Tên NCC *</label>
                                <input
                                    type="text"
                                    value={newSupplierName}
                                    onChange={(e) => setNewSupplierName(e.target.value)}
                                    placeholder="Nhập tên nhà cung cấp"
                                    style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px' }}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', color: '#374151', marginBottom: '6px' }}>Số điện thoại</label>
                                <input
                                    type="text"
                                    value={newSupplierPhone}
                                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                                    placeholder="Nhập SĐT"
                                    style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px' }}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button
                                onClick={() => setShowSupplierModal(false)}
                                style={{ flex: 1, padding: '12px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '8px', fontWeight: 500, cursor: 'pointer' }}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleCreateSupplier}
                                style={{ flex: 1, padding: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                            >
                                ✅ Tạo NCC
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Quick View Modal */}
            <ProductQuickViewModal
                product={quickViewProduct}
                isOpen={!!quickViewProduct}
                onClose={() => setQuickViewProduct(null)}
                showEditButton={false}
            />

            {/* Barcode Selection Modal - shows when multiple products have same barcode */}
            {barcodeMatches.length > 0 && (
                <BarcodeSelectionModal
                    matches={barcodeMatches}
                    onSelect={(match) => {
                        const searchItem: ProductSearchItem = {
                            id: match.product.id,
                            product_id: match.product.id,
                            name: match.product.name,
                            sku: match.product.sku ?? undefined,
                            barcode: match.barcode,
                            image_url: match.product.image_url ?? undefined,
                            price: match.price,
                            cost_price: match.unit ? (match.unit.cost_price || match.product.cost_price * match.unit.conversion_rate) : match.product.cost_price,
                            stock: match.stock,
                            unit_name: match.displayUnit,
                            type: match.unit ? 'unit' : 'product',
                            product: match.product,
                            unit: match.unit ? {
                                id: match.unit.id,
                                unit_name: match.unit.unit_name,
                                conversion_rate: match.unit.conversion_rate
                            } : undefined
                        };
                        addProductToOrder(searchItem);
                        setBarcodeMatches([]);
                    }}
                    onClose={() => setBarcodeMatches([])}
                />
            )}
        </div>
    );
}

export default PurchaseOrdersPage;
