import { useState, useMemo } from 'react';
import { formatVND } from '@/lib/cashReconciliation';
import type { Order, OrderStatus, ProductSearchItem, Customer } from '@/types';
import { ProductLink } from '@/components/products/ProductLink';
import { cn } from '@/lib/utils';
import { usePrint } from '@/hooks/usePrint';
import { OrderProgress } from '@/components/orders/OrderProgress';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { useOrderStore } from '@/stores/orderStore';
import { usePOSStore } from '@/stores/posStore';
import { useProductStore } from '@/stores/productStore';
import { useCustomerStore } from '@/stores/customerStore';
import { useNavigate } from 'react-router-dom';
import { Copy, Printer, X, Monitor, Store, Check, Package, Truck, ClipboardCheck, FileText, Search, Plus, User } from 'lucide-react';
import { searchProducts, fuzzyMatch } from '@/lib/productSearch';
import { generateId } from '@/lib/utils';
import { VietnamAddressSelector, formatVietnamAddress } from '@/components/common/VietnamAddressSelector';

interface OrderDetailsModalProps {
    order: Order;
    onClose: () => void;
    onReturn?: () => void;
    onPayment?: (order: Order) => void;
    onPrintShippingLabel?: (order: Order) => void;
}

// Copy Order Modal Component
function CopyOrderModal({ onClose, onCopy }: { onClose: () => void; onCopy: (type: 'online' | 'pos') => void }) {
    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-[400px] overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="font-bold text-gray-800">Sao chép đơn hàng</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 grid grid-cols-2 gap-4">
                    <button
                        onClick={() => onCopy('online')}
                        className="flex flex-col items-center justify-center p-6 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
                    >
                        <Monitor size={48} className="text-gray-400 group-hover:text-green-600 mb-3" />
                        <span className="font-medium text-gray-700 group-hover:text-green-700">Bán online</span>
                    </button>
                    <button
                        onClick={() => onCopy('pos')}
                        className="flex flex-col items-center justify-center p-6 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
                    >
                        <Store size={48} className="text-gray-400 group-hover:text-green-600 mb-3" />
                        <span className="font-medium text-gray-700 group-hover:text-green-700">Bán hàng tại quầy</span>
                    </button>
                </div>
                <div className="p-4 border-t text-center">
                    <button className="text-green-600 hover:text-green-700 text-sm font-medium">Xem thêm ▼</button>
                </div>
            </div>
        </div>
    );
}

export function OrderDetailsModal({ order: initialOrder, onClose, onReturn, onPayment, onPrintShippingLabel }: OrderDetailsModalProps) {
    // Subscribe to live order updates
    const order = useOrderStore(state => state.orders.find(o => o.id === initialOrder.id)) || initialOrder;

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editedOrder, setEditedOrder] = useState<Order>(order);

    // Sync editedOrder when order updates (if not editing)
    // useEffect(() => { if (!isEditing) setEditedOrder(order); }, [order, isEditing]); 
    // Actually, we want to initialize it.

    const [showCopyModal, setShowCopyModal] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [productSearchQuery, setProductSearchQuery] = useState('');
    const [showProductSearch, setShowProductSearch] = useState(false);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [showCustomerSearch, setShowCustomerSearch] = useState(false);
    const [useDifferentAddress, setUseDifferentAddress] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const isDebt = (order.debt_amount > 0 && order.payment_status !== 'paid') || order.payment_method === 'debt' || (order.remaining_debt ?? 0) > 0;
    const { printSalesReceipt } = usePrint();
    const { updateOrder, finalizeDeliveryOrder, shipOrder } = useOrderStore();
    const { loadFromOrder } = usePOSStore();
    const { products } = useProductStore();
    const { customers } = useCustomerStore();
    const navigate = useNavigate();

    // Check if order can be cancelled (only before shipping)
    const canCancel = order.is_delivery &&
        ['pending_approval', 'approved', 'packing', 'packed'].includes(order.status);

    // Check if order can be returned (after shipping, before completed)
    const canReturn = order.is_delivery && order.status === 'shipping';

    const handlePrint = async () => {
        await printSalesReceipt(order, 'Admin');
    };

    const handleCopy = (type: 'online' | 'pos') => {
        if (type === 'pos') {
            loadFromOrder(order);
            setShowCopyModal(false);
            onClose();
            navigate('/pos');
        } else {
            alert('Đã sao chép đơn hàng sang bán online - Tính năng đang phát triển');
            setShowCopyModal(false);
        }
    };

    // Toggle Edit Mode (Inline)
    const handleEditToggle = () => {
        setEditedOrder(JSON.parse(JSON.stringify(order))); // Deep copy
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditedOrder(order); // Revert
    };

    const handleSave = async () => {
        try {
            // Basic validation
            if (!editedOrder.customer?.name) return alert('Tên khách hàng không được để trống');

            // Call update
            await updateOrder(order.id, editedOrder);
            setIsEditing(false);
        } catch (err) {
            console.error(err);
            alert('Có lỗi xảy ra khi lưu đơn hàng.');
        }
    };

    // Input Handlers
    const updateCustomerField = (field: string, value: string) => {
        setEditedOrder(prev => ({
            ...prev,
            customer: { ...prev.customer!, [field]: value },
            // Also update flattened delivery info if mapped? 
            // Delivery info usually matches customer for single destination
            delivery_info: prev.delivery_info ? {
                ...prev.delivery_info,
                recipient_name: field === 'name' ? value : prev.delivery_info.recipient_name,
                recipient_phone: field === 'phone' ? value : prev.delivery_info.recipient_phone,
            } : prev.delivery_info
        }));
    };

    const updateDeliveryField = (field: string, value: string) => {
        setEditedOrder(prev => ({
            ...prev,
            delivery_info: { ...prev.delivery_info!, [field]: value }
        }));
    };

    const updateItemQuantity = (itemId: string, newQty: number) => {
        if (newQty < 1) return;
        setEditedOrder(prev => {
            const newItems = (prev.order_items || []).map(item => {
                if (item.id === itemId) {
                    return { ...item, quantity: newQty, total_price: newQty * item.unit_price };
                }
                return item;
            });

            // Recalculate totals
            const subtotal = newItems.reduce((sum, item) => sum + item.total_price, 0);
            const total = subtotal - prev.discount_amount + (prev.delivery_info?.delivery_fee || 0);

            return {
                ...prev,
                order_items: newItems,
                subtotal,
                total_amount: total,
                remaining_debt: total - (prev.paid_amount || 0) // Simple assumption
            };
        });
    };

    const removeItem = (itemId: string) => {
        if (!confirm('Xóa sản phẩm này khỏi đơn hàng?')) return;
        setEditedOrder(prev => {
            const newItems = (prev.order_items || []).filter(item => item.id !== itemId);
            const subtotal = newItems.reduce((sum, item) => sum + item.total_price, 0);
            const total = subtotal - prev.discount_amount + (prev.delivery_info?.delivery_fee || 0);
            return {
                ...prev,
                order_items: newItems,
                subtotal,
                total_amount: total
            };
        });
    };

    // Product Search Results
    const productSearchResults = useMemo(() => {
        if (!productSearchQuery.trim()) return [];
        return searchProducts(products, productSearchQuery).slice(0, 5);
    }, [products, productSearchQuery]);

    // Customer Search Results
    const customerSearchResults = useMemo(() => {
        if (!customerSearchQuery.trim()) return [];
        return customers.filter(c =>
            fuzzyMatch([c.name, c.phone || '', c.code || ''].join(' '), customerSearchQuery)
        ).slice(0, 5);
    }, [customers, customerSearchQuery]);

    const selectCustomer = (customer: Customer) => {
        setEditedOrder(prev => ({
            ...prev,
            customer_id: customer.id,
            customer: customer,
            delivery_info: prev.delivery_info ? {
                ...prev.delivery_info,
                recipient_name: customer.name,
                recipient_phone: customer.phone || '',
                shipping_address: customer.address || '' // Always sync with customer address
            } : {
                recipient_name: customer.name,
                recipient_phone: customer.phone || '',
                shipping_address: customer.address || '',
                delivery_fee: 0,
                delivery_notes: ''
            }
        }));
        setUseDifferentAddress(false); // Reset to customer address
        setCustomerSearchQuery('');
        setShowCustomerSearch(false);
    };

    const addProductToOrder = (item: ProductSearchItem) => {
        setEditedOrder(prev => {
            // Check if product already exists (by product_id and unit)
            const existingIdx = (prev.order_items || []).findIndex(
                oi => oi.product_id === item.product_id && (oi.unit?.unit_name === item.unit_name || (!oi.unit && item.type === 'product'))
            );

            let newItems;
            if (existingIdx >= 0) {
                // Increase quantity
                newItems = [...(prev.order_items || [])] as typeof prev.order_items;
                newItems![existingIdx] = {
                    ...newItems![existingIdx],
                    quantity: newItems![existingIdx].quantity + 1,
                    total_price: (newItems![existingIdx].quantity + 1) * newItems![existingIdx].unit_price
                };
            } else {
                // Add new item with all required OrderItem fields
                const newItem = {
                    id: generateId(),
                    order_id: prev.id,
                    product_id: item.product_id,
                    product: item.product,
                    unit_id: item.unit?.id,
                    unit: item.unit,
                    quantity: 1,
                    unit_price: item.price,
                    total_price: item.price,
                    discount_amount: 0,
                    returned_quantity: 0,
                    notes: '',
                    created_at: new Date().toISOString()
                };
                newItems = [...(prev.order_items || []), newItem] as typeof prev.order_items;
            }

            const subtotal = (newItems || []).reduce((sum, i) => sum + i.total_price, 0);
            const total = subtotal - prev.discount_amount + (prev.delivery_info?.delivery_fee || 0);

            return {
                ...prev,
                order_items: newItems,
                subtotal,
                total_amount: total,
                remaining_debt: total - (prev.paid_amount || 0)
            };
        });

        setProductSearchQuery('');
        setShowProductSearch(false);
    };

    const handleCancel = async () => {
        console.log('[handleCancel] Called, order status:', order.status, 'order id:', order.id);
        // Removed confirm() - execute directly
        console.log('[handleCancel] Cancelling order...');
        setIsCancelling(true);
        try {
            const success = await updateOrder(order.id, { status: 'cancelled' });
            console.log('[handleCancel] Order cancelled successfully, result:', success);
            if (success) {
                // Optionally close modal after cancel
            }
        } catch (err) {
            console.error('[handleCancel] Error:', err);
            alert('Có lỗi xảy ra khi hủy đơn hàng.');
        } finally {
            setIsCancelling(false);
        }
    };

    const handleStatusUpdate = async (newStatus: OrderStatus) => {
        console.log('[handleStatusUpdate] Called with:', { newStatus, currentStatus: order.status, isDelivery: order.is_delivery, orderId: order.id });
        try {
            // For delivery orders transitioning to shipping - use shipOrder (deducts stock)
            if (newStatus === 'shipping' && order.is_delivery) {
                console.log('[handleStatusUpdate] Going to shipping - calling shipOrder');
                // Removed confirm() - execute directly
                console.log('[handleStatusUpdate] Calling shipOrder...');
                const success = await shipOrder(order.id);
                console.log('[handleStatusUpdate] shipOrder result:', success);
                if (!success) return;
                return;
            }

            // For delivery orders completing - use finalizeDeliveryOrder (records revenue)
            if (newStatus === 'completed' && order.is_delivery) {
                console.log('[handleStatusUpdate] Going to completed - calling handleFinalize');
                await handleFinalize();
                return;
            }

            // For other status changes
            console.log('[handleStatusUpdate] Regular status update to:', newStatus);
            const success = await updateOrder(order.id, { status: newStatus });
            console.log('[handleStatusUpdate] updateOrder completed, result:', success);
        } catch (err) {
            console.error('[handleStatusUpdate] Error:', err);
            alert('Có lỗi xảy ra khi cập nhật trạng thái.');
        }
    };

    const handleFinalize = async () => {
        // Stock was already deducted when shipping, now just record revenue
        // Removed confirm() - execute directly
        console.log('[handleFinalize] Finalizing order...');
        try {
            const success = await finalizeDeliveryOrder(order.id);
            console.log('[handleFinalize] Result:', success);
            if (success) {
                onClose();
            }
        } catch (err) {
            console.error('[handleFinalize] Error:', err);
            alert('Có lỗi xảy ra khi hoàn tất đơn hàng.');
        }
    };


    // Determine which action button to show based on status
    const getActionButton = () => {
        if (!order.is_delivery) return null;

        switch (order.status) {
            case 'pending_approval':
                return (
                    <button
                        onClick={() => handleStatusUpdate('approved')}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-bold text-sm shadow-sm flex items-center gap-2 transition-all"
                    >
                        Duyệt đơn hàng
                    </button>
                );
            case 'approved':
                return (
                    <button
                        onClick={() => handleStatusUpdate('packing')}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-bold text-sm shadow-sm flex items-center gap-2 transition-all"
                    >
                        Đóng gói
                    </button>
                );
            case 'packing':
                return (
                    <button
                        onClick={() => handleStatusUpdate('packed')}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-bold text-sm shadow-sm flex items-center gap-2 transition-all"
                    >
                        Hoàn tất đóng gói
                    </button>
                );
            case 'packed':
                return (
                    <button
                        onClick={() => handleStatusUpdate('shipping')}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-bold text-sm shadow-sm flex items-center gap-2 transition-all"
                    >
                        Xuất kho giao hàng
                    </button>
                );
            case 'shipping':
                return (
                    <button
                        onClick={handleFinalize}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-bold text-sm shadow-sm flex items-center gap-2 transition-all animate-pulse"
                    >
                        Hoàn tất & Thanh toán
                    </button>
                );
            default:
                return null;
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                {/* Modal Container - 20% wider (1200px instead of 1000px) */}
                <div className="bg-gray-100 rounded-2xl shadow-2xl w-[95vw] md:w-[1200px] max-h-[92vh] overflow-hidden flex flex-col border border-gray-200">

                    {/* Header - Green Theme - Redesigned Layout */}
                    <div className="bg-[#00AC47] px-6 py-4 text-white relative">
                        {/* Close Button - Top Right */}
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-all absolute top-3 right-3 z-20">
                            <X size={22} />
                        </button>

                        {/* Row 1: Title + Status + Actions */}
                        <div className="flex items-center justify-between gap-4 mb-4 pr-12">
                            {/* Left: Order Info */}
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                    <FileText size={22} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold flex items-center gap-3">
                                        Đơn hàng #{order.order_number}
                                        <span className="text-xs font-medium bg-white text-[#00AC47] px-2.5 py-1 rounded-full">
                                            {order.status === 'pending_approval' && 'Đang chờ phê duyệt'}
                                            {order.status === 'approved' && 'Đã duyệt'}
                                            {order.status === 'packing' && 'Đang đóng gói'}
                                            {order.status === 'packed' && 'Đã đóng gói'}
                                            {order.status === 'shipping' && 'Đang giao hàng'}
                                            {order.status === 'completed' && 'Hoàn thành'}
                                            {order.status === 'cancelled' && 'Đã hủy'}
                                        </span>
                                    </h2>
                                    <div className="text-white/70 text-xs mt-0.5">
                                        {new Date(order.created_at).toLocaleString('vi-VN')} • {order.customer?.name || 'Khách lẻ'}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Action Buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {isEditing ? (
                                    <>
                                        <button onClick={handleSave} className="h-8 px-3 bg-white text-green-700 rounded-lg text-sm font-bold shadow-sm flex items-center gap-1.5 hover:bg-green-50 transition-all">
                                            <Check size={14} /> Lưu
                                        </button>
                                        <button onClick={handleCancelEdit} className="h-8 px-3 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 backdrop-blur-sm transition-all">
                                            <X size={14} /> Hủy bỏ
                                        </button>
                                    </>
                                ) : (
                                    order.is_delivery && ['pending_approval', 'approved', 'packing', 'packed'].includes(order.status) && (
                                        <button onClick={handleEditToggle} className="h-8 px-3 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 backdrop-blur-sm border border-white/20 transition-all">
                                            <FileText size={14} /> Sửa đơn
                                        </button>
                                    )
                                )}
                                <button onClick={() => setShowCopyModal(true)} className="h-8 px-3 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 backdrop-blur-sm border border-white/20 transition-all">
                                    <Copy size={14} /> Sao chép
                                </button>
                                {order.is_delivery && onPrintShippingLabel && (
                                    <button onClick={() => onPrintShippingLabel(order)} className="h-8 px-3 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 backdrop-blur-sm border border-white/20 transition-all">
                                        <Truck size={14} /> In vận đơn
                                    </button>
                                )}
                                {canCancel && (
                                    <button onClick={handleCancel} disabled={isCancelling} className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5">
                                        Hủy đơn
                                    </button>
                                )}
                                {canReturn && onReturn && (
                                    <button onClick={onReturn} className="h-8 px-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-1.5">
                                        Trả hàng
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Row 2: Order Progress Stepper - Compact */}
                        <div className="py-1 pb-4">
                            <OrderProgress
                                status={order.status}
                                order={order}
                                theme="dark"
                                onStatusChange={handleStatusUpdate}
                            />
                        </div>
                    </div>

                    {/* Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* LEFT COLUMN (2/3) */}
                        <div className="lg:col-span-2 space-y-5">
                            {/* ... (Keep existing content) ... */}
                            {/* Customer Info Card */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-green-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                                            <span className="w-1 h-4 bg-green-500 rounded-full"></span>
                                            Thông tin khách hàng
                                        </h3>
                                        <div className="space-y-2">
                                            {isEditing ? (
                                                <div className="relative">
                                                    {/* Current Customer - with X button */}
                                                    {editedOrder.customer?.name ? (
                                                        <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-100 rounded-lg">
                                                            <User size={18} className="text-green-600 flex-shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-bold text-green-700 truncate">{editedOrder.customer.name}</div>
                                                                {editedOrder.customer.phone && <div className="text-xs text-gray-500">{editedOrder.customer.phone}</div>}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditedOrder(prev => ({ ...prev, customer_id: undefined, customer: undefined }))}
                                                                className="p-1 hover:bg-red-100 rounded-full text-gray-400 hover:text-red-500 transition-colors"
                                                                title="Xóa khách hàng"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        /* Customer Search Input - shown when no customer */
                                                        <div className="relative">
                                                            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                                            <input
                                                                type="text"
                                                                value={customerSearchQuery}
                                                                onChange={(e) => { setCustomerSearchQuery(e.target.value); setShowCustomerSearch(true); }}
                                                                onFocus={() => setShowCustomerSearch(true)}
                                                                placeholder="Tìm khách hàng theo tên, SĐT..."
                                                                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                            />
                                                        </div>
                                                    )}
                                                    {/* Customer Dropdown */}
                                                    {showCustomerSearch && customerSearchResults.length > 0 && (
                                                        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-auto">
                                                            {customerSearchResults.map((c) => (
                                                                <button
                                                                    key={c.id}
                                                                    onClick={() => selectCustomer(c)}
                                                                    className="w-full px-3 py-2 text-left hover:bg-green-50 flex items-center gap-2 border-b border-gray-100 last:border-0 text-sm"
                                                                >
                                                                    <User size={16} className="text-green-500" />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="font-medium text-gray-800 truncate">{c.name}</div>
                                                                        <div className="text-xs text-gray-500">{c.phone || ''} {c.code ? `• ${c.code}` : ''}</div>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="font-bold text-green-600 text-xl">{editedOrder.customer?.name || 'Khách lẻ'}</div>
                                                    {editedOrder.customer?.phone && <div className="text-gray-600">SĐT: {editedOrder.customer.phone}</div>}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {order.is_delivery && (
                                        <div className="w-1/2 border-l border-gray-200 pl-5">
                                            <h3 className="font-bold text-gray-500 mb-3 text-xs uppercase tracking-wide">Địa chỉ giao hàng</h3>
                                            <div className="text-sm text-gray-600">
                                                {isEditing ? (
                                                    <div className="space-y-2">
                                                        {/* Show current address from customer */}
                                                        {editedOrder.customer?.address && !useDifferentAddress && (
                                                            <div className="p-2 bg-gray-50 rounded-lg border border-gray-100 text-gray-700">
                                                                {editedOrder.customer.address}
                                                            </div>
                                                        )}

                                                        {/* Checkbox for different address */}
                                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-green-600">
                                                            <input
                                                                type="checkbox"
                                                                checked={useDifferentAddress}
                                                                onChange={(e) => {
                                                                    setUseDifferentAddress(e.target.checked);
                                                                    if (!e.target.checked && editedOrder.customer?.address) {
                                                                        updateDeliveryField('shipping_address', editedOrder.customer.address);
                                                                    }
                                                                }}
                                                                className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                                                            />
                                                            <span>Giao đến địa chỉ khác</span>
                                                        </label>

                                                        {/* Textarea for custom address */}
                                                        {useDifferentAddress && (
                                                            <VietnamAddressSelector
                                                                value={{
                                                                    province: editedOrder.delivery_info?.province,
                                                                    provinceCode: editedOrder.delivery_info?.province_code,
                                                                    district: editedOrder.delivery_info?.district,
                                                                    districtCode: editedOrder.delivery_info?.district_code,
                                                                    ward: editedOrder.delivery_info?.ward,
                                                                    wardCode: editedOrder.delivery_info?.ward_code,
                                                                    detail: editedOrder.delivery_info?.address_detail
                                                                }}
                                                                onChange={(addr) => {
                                                                    setEditedOrder(prev => ({
                                                                        ...prev,
                                                                        delivery_info: {
                                                                            ...prev.delivery_info!,
                                                                            province: addr.province,
                                                                            province_code: addr.provinceCode,
                                                                            district: addr.district,
                                                                            district_code: addr.districtCode,
                                                                            ward: addr.ward,
                                                                            ward_code: addr.wardCode,
                                                                            address_detail: addr.detail,
                                                                            shipping_address: formatVietnamAddress(addr)
                                                                        }
                                                                    }));
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                ) : (
                                                    editedOrder.delivery_info?.shipping_address ? (
                                                        <>
                                                            <p className="font-medium text-gray-800">{editedOrder.delivery_info.recipient_name}</p>
                                                            <p className="text-green-600">{editedOrder.delivery_info.recipient_phone}</p>
                                                            <p className="mt-1 text-gray-500">{editedOrder.delivery_info.shipping_address}</p>
                                                        </>
                                                    ) : (
                                                        <p className="italic text-gray-400">Chưa có thông tin giao hàng</p>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ... (Keep rest of left column) ... */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-green-500 text-xl">💳</span>
                                    <h3 className="font-bold text-green-700 text-sm uppercase tracking-wide">Thông tin thanh toán</h3>
                                </div>
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 flex flex-wrap justify-between items-center gap-4 text-sm border border-green-100">
                                    <div className="text-center">
                                        <span className="block text-gray-500 text-xs mb-1">Khách phải trả</span>
                                        <span className="font-bold text-red-600 text-lg">{formatVND(isEditing ? editedOrder.total_amount : order.total_amount)}</span>
                                    </div>
                                    <div className="text-center">
                                        <span className="block text-gray-500 text-xs mb-1">Đã thanh toán</span>
                                        <span className="font-bold text-green-600 text-lg">{formatVND(order.paid_amount || order.cash_received + order.transfer_amount + order.card_amount)}</span>
                                    </div>
                                    <div className="text-center">
                                        <span className="block text-gray-500 text-xs mb-1">Còn phải trả</span>
                                        <span className="font-bold text-orange-600 text-lg">{formatVND(isEditing ? (editedOrder.total_amount - (order.paid_amount || 0)) : (order.remaining_debt ?? order.debt_amount))}</span>
                                    </div>
                                    {isDebt && onPayment && (
                                        <button onClick={() => onPayment(order)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium shadow-sm hover:bg-green-700 transition-colors">
                                            Thanh toán ngay
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Items Table Card */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-white">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold text-green-700 flex items-center gap-2 text-sm uppercase tracking-wide">
                                            <span className="w-1 h-4 bg-green-500 rounded-full"></span>
                                            Thông tin sản phẩm
                                        </h3>
                                        {!isEditing && (
                                            <button className="text-xs text-gray-500 hover:text-green-600 flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                                ⚙️ Kiểm tra tồn kho
                                            </button>
                                        )}
                                    </div>
                                    {/* Product Search - Only in Edit Mode */}
                                    {isEditing && (
                                        <div className="mt-3 relative">
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        value={productSearchQuery}
                                                        onChange={(e) => { setProductSearchQuery(e.target.value); setShowProductSearch(true); }}
                                                        onFocus={() => setShowProductSearch(true)}
                                                        placeholder="Tìm hoặc quét mã sản phẩm để thêm vào đơn..."
                                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                    />
                                                </div>
                                            </div>
                                            {/* Search Results Dropdown */}
                                            {showProductSearch && productSearchResults.length > 0 && (
                                                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-auto">
                                                    {productSearchResults.map((item) => (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => addProductToOrder(item)}
                                                            className="w-full px-4 py-3 text-left hover:bg-green-50 flex items-center gap-3 border-b border-gray-100 last:border-0"
                                                        >
                                                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                                                                {item.image_url ? (
                                                                    <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-lg">📦</span>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-medium text-gray-800 truncate">{item.name}</div>
                                                                <div className="text-xs text-gray-500">{item.sku || item.barcode || ''} • Tồn: {item.stock}</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="font-bold text-green-600">{formatVND(item.price)}</div>
                                                            </div>
                                                            <Plus size={16} className="text-green-500 flex-shrink-0" />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50/50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-4 py-4 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">STT</th>
                                            <th className="px-4 py-4 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">Ảnh</th>
                                            <th className="px-4 py-4 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">Tên sản phẩm</th>
                                            <th className="px-4 py-4 text-center font-medium text-gray-500 text-xs uppercase tracking-wider">SL</th>
                                            <th className="px-4 py-4 text-right font-medium text-gray-500 text-xs uppercase tracking-wider">Đơn giá</th>
                                            <th className="px-4 py-4 text-right font-medium text-gray-500 text-xs uppercase tracking-wider">Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {(editedOrder.order_items || []).map((item, idx) => (
                                            <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-4 py-4 text-gray-400 font-medium">{idx + 1}</td>
                                                <td className="px-4 py-4">
                                                    <div className="relative w-10 h-10 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden group">
                                                        {item.product?.image_url ? (
                                                            <img src={item.product.image_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-sm">📦</span>
                                                        )}
                                                        {isEditing && (
                                                            <button
                                                                onClick={() => removeItem(item.id)}
                                                                className="absolute inset-0 bg-red-500/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                                title="Xóa sản phẩm"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <ProductLink
                                                        productId={item.product_id}
                                                        productName={item.product?.name || 'Sản phẩm'}
                                                        style={{ fontWeight: 600, color: '#374151', fontSize: '14px' }}
                                                    />
                                                    <div className="text-xs text-gray-400 mt-0.5">{item.product?.sku}</div>
                                                    {isEditing ? (
                                                        <input
                                                            value={item.notes || ''}
                                                            onChange={(e) => {
                                                                // Handle note change (complex deep update, skipping for brevity unless implementing full item update)
                                                                // Let's focus on Qty first. Notes update is nice to have.
                                                            }}
                                                            placeholder="Ghi chú..."
                                                            className="text-xs p-1 border rounded w-full mt-1"
                                                        />
                                                    ) : (
                                                        item.notes && <div className="text-xs text-orange-500 mt-1">📝 {item.notes}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    {isEditing ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                className="w-6 h-6 bg-gray-100 rounded text-gray-600 hover:bg-gray-200"
                                                                onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                                                            >-</button>
                                                            <span className="font-semibold text-gray-800 w-6 text-center">{item.quantity}</span>
                                                            <button
                                                                className="w-6 h-6 bg-gray-100 rounded text-gray-600 hover:bg-gray-200"
                                                                onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                                                            >+</button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <span className="font-semibold text-gray-800">{item.quantity}</span>
                                                            {item.returned_quantity > 0 && <span className="block text-xs text-red-500">(-{item.returned_quantity})</span>}
                                                        </>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-right text-gray-600">{formatVND(item.unit_price)}</td>
                                                <td className="px-4 py-4 text-right font-bold text-gray-900">{formatVND(item.total_price)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="p-5 border-t bg-gradient-to-r from-gray-50 to-green-50">
                                    <div className="flex justify-end">
                                        <div className="w-72 space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Tổng tiền ({order.order_items?.length} sản phẩm)</span>
                                                <span className="font-medium">{formatVND(order.subtotal)}</span>
                                            </div>
                                            {order.discount_amount > 0 && (
                                                <div className="flex justify-between text-orange-600">
                                                    <span>Chiết khấu</span>
                                                    <span>-{formatVND(order.discount_amount)}</span>
                                                </div>
                                            )}
                                            {order.delivery_info?.delivery_fee && (
                                                <div className="flex justify-between text-gray-600">
                                                    <span>Phí giao hàng</span>
                                                    <span>{formatVND(order.delivery_info.delivery_fee)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-bold text-lg pt-3 border-t-2 border-green-200">
                                                <span className="text-gray-800">Khách phải trả</span>
                                                <span className="text-green-600">{formatVND(order.total_amount)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN (1/3) */}
                        <div className="lg:col-span-1 space-y-5">
                            {/* ... (Keep existing content) ... */}
                            {/* Order Info Summary */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                                <h3 className="font-bold text-green-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                                    <span className="w-1 h-4 bg-green-500 rounded-full"></span>
                                    Thông tin đơn hàng
                                </h3>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                                        <span className="text-gray-500">Chính sách giá</span>
                                        <span className="font-medium text-green-600">Giá bán lẻ</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                                        <span className="text-gray-500">Bán tại</span>
                                        <span className="font-medium text-gray-800">Chi nhánh mặc định</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                                        <span className="text-gray-500">Người bán</span>
                                        <span className="font-medium text-gray-800">Admin</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                                        <span className="text-gray-500">Nguồn</span>
                                        <span className="font-medium text-gray-800 capitalize">{order.source || 'Pos'}</span>
                                    </div>
                                    <div className="flex justify-between pb-2">
                                        <span className="text-gray-500">Ngày tạo</span>
                                        <span className="font-medium text-gray-800">{new Date(order.created_at).toLocaleString('vi-VN')}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowHistoryModal(true)}
                                    className="w-full mt-4 py-2.5 text-green-600 border-2 border-green-200 rounded-lg hover:bg-green-50 text-sm font-medium transition-colors"
                                >
                                    Xem lịch sử đơn hàng
                                </button>
                            </div>

                            {/* Notes */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                                <h3 className="font-bold text-green-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                                    <span className="w-1 h-4 bg-green-500 rounded-full"></span>
                                    Ghi chú
                                </h3>
                                <p className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    {order.notes || 'Chưa có ghi chú'}
                                </p>
                            </div>

                            {/* Tags */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                                <h3 className="font-bold text-green-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                                    <span className="w-1 h-4 bg-green-500 rounded-full"></span>
                                    Tags
                                </h3>
                                <p className="text-sm text-gray-400 italic">Chưa có tag</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions (Sticky Bottom) - With Workflow Buttons */}
                    <div className="p-4 border-t-2 border-gray-100 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
                        <div className="text-sm text-gray-500">
                            {order.status === 'completed' && (
                                <span className="text-green-600 flex items-center gap-2 font-medium">
                                    <Check size={18} className="text-green-500" /> Đã hoàn thành đơn hàng
                                </span>
                            )}
                            {order.status === 'cancelled' && (
                                <span className="text-red-600 flex items-center gap-2 font-medium">
                                    <X size={18} /> Đơn hàng đã bị hủy
                                </span>
                            )}
                        </div>
                        <div className="flex gap-3">
                            {/* Workflow Action Button */}
                            {getActionButton()}

                            {onReturn && order.status === 'completed' && (
                                <button onClick={onReturn} className="px-5 py-2.5 bg-red-50 border-2 border-red-200 text-red-600 rounded-lg hover:bg-red-100 font-medium transition-colors">
                                    Trả hàng
                                </button>
                            )}
                            <button
                                onClick={handlePrint}
                                className="px-5 py-2.5 bg-blue-50 border-2 border-blue-200 text-blue-600 rounded-lg hover:bg-blue-100 font-medium transition-colors flex items-center gap-2"
                            >
                                <Printer size={16} /> In đơn
                            </button>
                            <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors border border-gray-200">
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Copy Order Modal */}
            {showCopyModal && (
                <CopyOrderModal onClose={() => setShowCopyModal(false)} onCopy={handleCopy} />
            )}

            {/* Order History Modal */}
            {showHistoryModal && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full min-w-[450px] max-w-lg shadow-2xl">
                        <header className="px-6 py-4 border-b bg-gradient-to-r from-green-50 to-green-100 flex justify-between items-center rounded-t-2xl">
                            <h2 className="text-lg font-bold text-green-700">📋 Lịch sử đơn hàng #{order.order_number}</h2>
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 text-lg"
                            >
                                ×
                            </button>
                        </header>

                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            <div className="relative pl-6">
                                {/* Timeline Line */}
                                <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />

                                {/* Build timeline based on status */}
                                <div className="space-y-4">
                                    {/* Order Created - Always show */}
                                    <div className="relative flex gap-4">
                                        <div className="absolute left-[-20px] w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow" />
                                        <div className="flex-1 bg-green-50 rounded-lg p-3 border border-green-100">
                                            <div className="flex justify-between items-start">
                                                <span className="font-medium text-green-700">Tạo đơn hàng</span>
                                                <span className="text-xs text-gray-500">{new Date(order.created_at).toLocaleString('vi-VN')}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1">Đơn hàng được tạo bởi <strong>{order.seller_name || 'Admin'}</strong></p>
                                        </div>
                                    </div>

                                    {/* Approved - Show if status >= approved */}
                                    {['approved', 'packing', 'packed', 'shipping', 'completed'].includes(order.status) && (
                                        <div className="relative flex gap-4">
                                            <div className="absolute left-[-20px] w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow" />
                                            <div className="flex-1 bg-blue-50 rounded-lg p-3 border border-blue-100">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-medium text-blue-700">Duyệt đơn</span>
                                                    <span className="text-xs text-gray-500">{order.approved_at ? new Date(order.approved_at).toLocaleString('vi-VN') : '---'}</span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">Đơn hàng được duyệt bởi <strong>Admin</strong></p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Packing - Show if status >= packing */}
                                    {['packing', 'packed', 'shipping', 'completed'].includes(order.status) && (
                                        <div className="relative flex gap-4">
                                            <div className="absolute left-[-20px] w-4 h-4 bg-orange-500 rounded-full border-2 border-white shadow" />
                                            <div className="flex-1 bg-orange-50 rounded-lg p-3 border border-orange-100">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-medium text-orange-700">Bắt đầu đóng gói</span>
                                                    <span className="text-xs text-gray-500">{order.packing_at ? new Date(order.packing_at).toLocaleString('vi-VN') : '---'}</span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">Đơn hàng đang được đóng gói</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Packed - Show if status >= packed */}
                                    {['packed', 'shipping', 'completed'].includes(order.status) && (
                                        <div className="relative flex gap-4">
                                            <div className="absolute left-[-20px] w-4 h-4 bg-purple-500 rounded-full border-2 border-white shadow" />
                                            <div className="flex-1 bg-purple-50 rounded-lg p-3 border border-purple-100">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-medium text-purple-700">Đóng gói xong</span>
                                                    <span className="text-xs text-gray-500">{order.packed_at ? new Date(order.packed_at).toLocaleString('vi-VN') : '---'}</span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">Đơn hàng đã đóng gói xong, chờ xuất kho</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Shipped - Show if status >= shipping */}
                                    {['shipping', 'completed'].includes(order.status) && (
                                        <div className="relative flex gap-4">
                                            <div className="absolute left-[-20px] w-4 h-4 bg-cyan-500 rounded-full border-2 border-white shadow" />
                                            <div className="flex-1 bg-cyan-50 rounded-lg p-3 border border-cyan-100">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-medium text-cyan-700">Xuất kho giao hàng</span>
                                                    <span className="text-xs text-gray-500">{order.shipped_at ? new Date(order.shipped_at).toLocaleString('vi-VN') : '---'}</span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">Đơn hàng đã xuất kho và bàn giao cho shipper</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Completed */}
                                    {order.status === 'completed' && (
                                        <div className="relative flex gap-4">
                                            <div className="absolute left-[-20px] w-4 h-4 bg-green-600 rounded-full border-2 border-white shadow" />
                                            <div className="flex-1 bg-green-50 rounded-lg p-3 border border-green-200">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-medium text-green-700">Hoàn tất</span>
                                                    <span className="text-xs text-gray-500">{order.completed_at ? new Date(order.completed_at).toLocaleString('vi-VN') : '---'}</span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">Đơn hàng giao thành công - Thanh toán {formatVND(order.total_amount)}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Cancelled */}
                                    {order.status === 'cancelled' && (
                                        <div className="relative flex gap-4">
                                            <div className="absolute left-[-20px] w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow" />
                                            <div className="flex-1 bg-red-50 rounded-lg p-3 border border-red-200">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-medium text-red-700">Đã hủy</span>
                                                    <span className="text-xs text-gray-500">{order.cancelled_at ? new Date(order.cancelled_at).toLocaleString('vi-VN') : '---'}</span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">Đơn hàng đã bị hủy</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <footer className="px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                            >
                                Đóng
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </>
    );
}
