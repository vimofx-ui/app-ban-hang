// =============================================================================
// PURCHASE ORDER DETAIL PAGE - Chi tiết đơn nhập hàng
// =============================================================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Printer, Copy, MoreHorizontal, Truck, Check, CheckCircle,
    Package, Edit, ChevronRight, Tag, Plus, X, Clock, CreditCard, User
} from 'lucide-react';
import { usePurchaseOrderStore, type OrderActivityLog } from '@/stores/purchaseOrderStore';
import { useSupplierStore } from '@/stores/supplierStore';
import { Loading } from '@/components/common/Loading';
import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { PurchaseReceiptTemplate } from '@/components/print';
import { useBrandStore } from '@/stores/brandStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { ReturnToSupplierModal } from '@/components/purchase-orders/ReturnToSupplierModal';
import { ProductDetailsModal } from '@/components/products/ProductDetailsModal';
import { useProductStore } from '@/stores/productStore';

export function PurchaseOrderDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const {
        currentPO: po,
        isLoading,
        getPurchaseOrder,
        updatePOStatus,
        createGoodsReceipt,
        updatePurchaseOrder,
        cancelPurchaseOrder,
        logActivity,
        getActivityLogs
    } = usePurchaseOrderStore();

    // State for modals
    const [showReceiveConfirm, setShowReceiveConfirm] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [isCreatingReceipt, setIsCreatingReceipt] = useState(false);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null); // Lightbox state
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [photoIndex, setPhotoIndex] = useState(0);
    const [activityLogs, setActivityLogs] = useState<OrderActivityLog[]>([]);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

    // Product Details Modal
    const [viewingProduct, setViewingProduct] = useState<any | null>(null);
    const { products } = useProductStore();

    // State for editable sell prices
    const [sellPrices, setSellPrices] = useState<Record<string, number>>({});

    // State for calculation columns - Giá nhập gần nhất và giá vốn
    const [lastImportPrices, setLastImportPrices] = useState<Record<string, number>>({});
    const [currentCosts, setCurrentCosts] = useState<Record<string, number>>({});
    const [discounts, setDiscounts] = useState<Record<string, number>>({});

    const currentBrand = useBrandStore((state) => state.currentBrand);
    const { printSettings } = useSettingsStore();
    const componentRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `PO_${po?.po_number || 'Order'}`,
    });

    useEffect(() => {
        getPurchaseOrder(id!);
    }, [id, getPurchaseOrder]);

    useEffect(() => {
        if (po?.id) {
            usePurchaseOrderStore.getState().getActivityLogs(po.id).then(setActivityLogs);
        }
    }, [po?.id]);

    // Derived values
    const items = po?.items || [];
    const totalQty = items.reduce((sum: number, item: any) => sum + (item.ordered_qty || item.quantity || 0), 0);
    const invoiceImages = po?.invoice_images || [];

    // Fetch giá nhập gần nhất và giá vốn khi có items
    useEffect(() => {
        const fetchPriceData = async () => {
            if (!items || items.length === 0) return;

            const productIds = items.map((item: any) => item.product_id).filter(Boolean);
            if (productIds.length === 0) return;

            try {
                const { supabase, isSupabaseConfigured } = await import('@/lib/supabase');
                const { useAuthStore } = await import('@/stores/authStore');
                const branchId = useAuthStore.getState().branchId;

                if (!isSupabaseConfigured() || !supabase || !branchId) return;

                // 1. Lấy giá nhập từ đơn gần nhất (không phải đơn hiện tại)
                const { data: lastPrices } = await supabase
                    .from('purchase_order_items')
                    .select(`
                        product_id,
                        unit_price,
                        purchase_orders!inner(id, created_at, status)
                    `)
                    .in('product_id', productIds)
                    .neq('purchase_orders.id', po?.id) // Không lấy đơn hiện tại
                    .neq('purchase_orders.status', 'cancelled')
                    .order('purchase_orders(created_at)', { ascending: false });

                // Map giá nhập gần nhất cho mỗi sản phẩm
                const priceMap: Record<string, number> = {};
                if (lastPrices) {
                    for (const productId of productIds) {
                        const itemData = lastPrices.find((p: any) => p.product_id === productId);
                        priceMap[productId] = itemData?.unit_price || 0;
                    }
                }
                setLastImportPrices(priceMap);

                // 2. Lấy giá vốn từ inventory_costs
                const { data: costs } = await supabase
                    .from('inventory_costs')
                    .select('product_id, avg_cost')
                    .in('product_id', productIds)
                    .eq('branch_id', branchId);

                const costMap: Record<string, number> = {};
                if (costs) {
                    for (const cost of costs) {
                        costMap[cost.product_id] = cost.avg_cost || 0;
                    }
                }
                setCurrentCosts(costMap);

                // 3. Khởi tạo discounts từ items
                const discountMap: Record<string, number> = {};
                for (const item of items) {
                    discountMap[item.id] = item.discount_percent || 0;
                }
                setDiscounts(discountMap);

            } catch (error) {
                console.error('Error fetching price data:', error);
            }
        };

        fetchPriceData();
    }, [items, po?.id]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN').format(amount);
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            draft: 'bg-gray-100 text-gray-600',
            pending: 'bg-yellow-100 text-yellow-700',
            approved: 'bg-blue-100 text-blue-700',
            partial: 'bg-purple-100 text-purple-700',
            received: 'bg-green-100 text-green-700',
            cancelled: 'bg-red-100 text-red-600',
        };
        return colors[status] || 'bg-gray-100 text-gray-600';
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            draft: 'Nháp',
            pending: 'Chờ duyệt',
            approved: 'Đã duyệt',
            partial: 'Nhập 1 phần',
            received: 'Đã nhập kho',
            cancelled: 'Đã hủy',
        };
        return labels[status] || status;
    };

    const handleStartReceipt = async () => {
        if (!po || isCreatingReceipt) return;
        setShowReceiveConfirm(false);
        setIsCreatingReceipt(true);
        try {
            const result = await createGoodsReceipt(po.id);

            if (result) {
                await getPurchaseOrder(po.id);
                alert('Đã tạo phiếu nhập kho thành công!');
            }
        } catch (err) {
            console.error('Error creating receipt:', err);
            alert('Lỗi khi tạo phiếu nhập kho.');
        } finally {
            setIsCreatingReceipt(false);
        }
    };

    const handlePayment = async () => {
        if (!po || isProcessingPayment) return;

        // Confirm confirmation
        setShowPaymentModal(false);
        setIsProcessingPayment(true);
        try {
            // Update payment status to paid
            // We use updatePurchaseOrder directly as updatePOStatus only updates the main status
            const success = await usePurchaseOrderStore.getState().updatePurchaseOrder(po.id, {
                payment_status: 'paid',
                paid_amount: po.total_amount
            });

            if (success) {
                await usePurchaseOrderStore.getState().logActivity(po.id, 'payment', `Thanh toán cho đơn hàng: ${formatCurrency(po.total_amount)}đ`);
                alert('Thanh toán thành công!');
                // Reload to reflect changes clearly
                window.location.reload();
            } else {
                throw new Error('Failed to update payment status');
            }
        } catch (err) {
            console.error('Error processing payment:', err);
            alert('Lỗi khi thanh toán.');
        } finally {
            setIsProcessingPayment(false);
        }
    };

    const handleCopyOrder = () => {
        if (!po) return;

        try {
            // Prepare draft data for CreatePage
            const draftData = {
                selectedSupplierId: po.supplier_id,
                cartItems: po.items?.map((item: any) => ({
                    ...item,
                    key: `${item.product_id}-${Date.now()}-${Math.random()}`,
                    ordered_qty: item.ordered_qty || item.quantity || 1,
                    unit_options: [{ name: item.unit || 'Cái', ratio: 1, price: item.unit_price }],
                    selected_unit: item.unit
                })) || [],
                notes: po.notes,
                expectedDate: po.expected_date,
                savedAt: new Date().toISOString(),
            };

            // Save to localStorage using the same key as CreatePage (po_draft_new)
            localStorage.setItem('po_draft_new', JSON.stringify(draftData));

            // Navigate to create page
            navigate('/nhap-hang/tao-moi');

        } catch (error) {
            console.error('Error copying order:', error);
            alert('Lỗi khi sao chép đơn hàng');
        }
    };

    const handleSellPriceChange = (itemId: string, value: number) => {
        setSellPrices(prev => ({ ...prev, [itemId]: value }));
    };

    // Handler để thay đổi chiết khấu
    const handleDiscountChange = (itemId: string, value: number) => {
        // Giới hạn 0-100%
        const validValue = Math.max(0, Math.min(100, value));
        setDiscounts(prev => ({ ...prev, [itemId]: validValue }));
    };

    const handleCancelOrder = async () => {
        console.log('[DEBUG] handleCancelOrder called, po:', po?.id, 'status:', po?.status);
        if (!po) return;

        const isReturn = po.status === 'received';
        console.log('[DEBUG] isReturn:', isReturn);

        // Nếu là đơn đã nhập kho, mở modal trả hàng thay vì hủy trực tiếp
        if (isReturn) {
            console.log('[DEBUG] Opening return modal');
            setShowReturnModal(true);
            return;
        }

        // Mở custom confirm modal thay vì dùng window.confirm
        console.log('[DEBUG] Setting showCancelConfirm to true');
        setShowCancelConfirm(true);
    };

    // Xác nhận hủy đơn từ modal
    const confirmCancelOrder = async () => {
        if (!po) return;
        try {
            const success = await usePurchaseOrderStore.getState().cancelPurchaseOrder(po.id);
            if (success) {
                setShowCancelConfirm(false);
                alert('Đã hủy đơn hàng!');
                window.location.reload();
            } else {
                alert('Có lỗi xảy ra.');
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Handle return confirmation from modal
    const handleReturnConfirm = async (returnItems: Array<{ productId: string; returnQty: number; cost: number }>) => {
        if (!po) return;

        try {
            // Call the cancel/return API with the items to return
            const success = await usePurchaseOrderStore.getState().cancelPurchaseOrder(po.id, returnItems);
            if (success) {
                setShowReturnModal(false);
                alert('Đã trả hàng cho NCC thành công! Kho đã được cập nhật.');
                window.location.reload();
            } else {
                alert('Có lỗi xảy ra khi trả hàng.');
            }
        } catch (err) {
            console.error('Error returning items:', err);
            alert('Có lỗi xảy ra khi trả hàng.');
        }
    };

    // Timeline steps
    const getTimelineSteps = () => {
        const status = po?.status || '';
        const paymentStatus = po?.payment_status || 'unpaid';
        const isReceived = status === 'received';
        const isPaid = paymentStatus === 'paid';
        const isCancelled = status === 'cancelled';

        return [
            {
                key: 'created',
                label: 'Tạo đơn',
                date: po?.created_at,
                done: true,
                inProgress: false
            },
            {
                key: 'importing',
                label: 'Nhập hàng',
                date: po?.received_date || null,
                done: isReceived,
                inProgress: ['pending', 'approved', 'partial'].includes(status) && !isReceived && !isCancelled
            },
            {
                key: 'payment',
                label: 'Thanh toán',
                date: isPaid ? po?.updated_at : null,
                done: isPaid,
                inProgress: paymentStatus === 'partial' && !isCancelled
            },
            {
                key: 'completed',
                label: 'Hoàn thành',
                date: (isReceived && isPaid) ? po?.updated_at : null,
                done: isReceived && isPaid,
                inProgress: false
            },
        ];
    };

    if (isLoading) return <Loading />;
    if (!po) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
                <Package size={48} className="mx-auto mb-4 text-gray-400" />
                <h2 className="text-xl font-semibold text-gray-900">Không tìm thấy đơn nhập hàng</h2>
                <button
                    onClick={() => navigate('/nhap-hang')}
                    className="mt-4 text-blue-600 hover:underline"
                >
                    Quay lại danh sách
                </button>
            </div>
        </div>
    );

    const timelineSteps = getTimelineSteps();
    const isReceived = po.status === 'received';
    const isCancelled = po.status === 'cancelled';

    return (
        <>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
                    <div className="max-w-7xl mx-auto px-4 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => navigate('/nhap-hang')}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                    <ArrowLeft size={20} />
                                </button>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-lg font-bold text-gray-900">{po.po_number}</h1>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(po.status)}`}>
                                            {getStatusLabel(po.status)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        {new Date(po.created_at).toLocaleDateString('vi-VN')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Cancel / Return Button */}
                                {!isCancelled && (
                                    <button
                                        onClick={handleCancelOrder}
                                        className={`px-3 py-2 text-sm font-medium rounded-lg text-red-600 bg-red-50 hover:bg-red-100 border border-red-200`}
                                    >
                                        {isReceived ? 'Trả hàng NCC' : 'Hủy đơn'}
                                    </button>
                                )}

                                {/* Edit Button - Only if not received/cancelled */}
                                {!isReceived && !isCancelled && (
                                    <button
                                        onClick={() => navigate(`/nhap-hang/${po.id}/chinh-sua`)}
                                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        Sửa
                                    </button>
                                )}

                                <button
                                    onClick={() => handlePrint()}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                    title="In phiếu nhập"
                                >
                                    <Printer size={18} />
                                </button>
                                <button
                                    onClick={handleCopyOrder}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                    title="Sao chép đơn hàng"
                                >
                                    <Copy size={18} />
                                </button>
                                <button className="p-2 hover:bg-gray-100 rounded-lg">
                                    <MoreHorizontal size={18} />
                                </button>
                                {!isReceived && !isCancelled && (
                                    <button
                                        onClick={() => setShowReceiveConfirm(true)}
                                        disabled={isCreatingReceipt}
                                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                                    >
                                        <Truck size={16} />
                                        {isCreatingReceipt ? 'Đang tạo...' : 'Nhập kho'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Timeline */}
                        <div className="flex items-center gap-4 mt-4 pb-2 overflow-x-auto">
                            {timelineSteps.map((step, index) => (
                                <div key={step.key} className="flex items-center">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step.done ? 'bg-green-500 text-white' :
                                            step.inProgress ? 'bg-blue-500 text-white' :
                                                'bg-gray-200 text-gray-500'
                                            }`}>
                                            {step.done ? <Check size={14} /> : index + 1}
                                        </div>
                                        <div>
                                            <div className={`text-sm font-medium ${step.done ? 'text-green-600' : step.inProgress ? 'text-blue-600' : 'text-gray-500'}`}>
                                                {step.label}
                                            </div>
                                            {step.date && (
                                                <div className="text-xs text-gray-400">
                                                    {new Date(step.date).toLocaleDateString('vi-VN')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {index < timelineSteps.length - 1 && (
                                        <ChevronRight size={16} className="mx-2 text-gray-400" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="max-w-7xl mx-auto px-4 py-6">
                    {/* Row 1: Supplier Info + Order Info */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        {/* Supplier Info */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Package size={18} />
                                Thông tin nhà cung cấp
                            </h3>
                            <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
                                <div>
                                    <div className="font-semibold text-blue-600">{po.supplier_name || 'Chưa có NCC'}</div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        Địa chỉ: Chưa cập nhật
                                    </div>
                                </div>
                                <div className="text-right text-sm">
                                    <div className="text-gray-600">Công nợ: <span className="font-medium">0</span></div>
                                    <div className="text-gray-600">Tổng đơn nhập (1 đơn): <span className="font-medium text-blue-600">{formatCurrency(po.total_amount)}đ</span></div>
                                    <div className="text-gray-600">Trả hàng: <span className="font-medium">0</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Order Info */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                📋 Thông tin đơn nhập hàng
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Chi nhánh</span>
                                    <span className="font-medium">{po.branch_name || 'Cửa hàng chính'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Nhân viên phụ trách</span>
                                    <span className="font-medium">Admin</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Ngày tạo</span>
                                    <span>{new Date(po.created_at).toLocaleDateString('vi-VN')}</span>
                                </div>
                            </div>
                            <button
                                className="text-sm text-blue-600 hover:underline mt-4"
                                onClick={() => setShowHistoryModal(true)}
                            >
                                Xem lịch sử đơn nhập hàng
                            </button>
                        </div>
                    </div>

                    {/* Payment Section */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                💳 {po.payment_status === 'paid' ? 'Đơn nhập hàng đã thanh toán' : 'Đơn nhập hàng chưa thanh toán'}
                            </h3>
                            {po.payment_status !== 'paid' && (
                                <button
                                    onClick={() => setShowPaymentModal(true)}
                                    className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                                >
                                    Thanh toán
                                </button>
                            )}
                            {po.payment_status === 'paid' && (
                                <span className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 rounded-full">
                                    ✓ Đã thanh toán
                                </span>
                            )}
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Tiền cần trả NCC: <span className="font-medium text-blue-600">{formatCurrency(po.total_amount)}đ</span></span>
                            <span className="text-gray-600">Đã trả: <span className="font-medium text-green-600">{formatCurrency(po.paid_amount || 0)}đ</span></span>
                        </div>
                        <div className="text-right text-sm mt-2">
                            {po.payment_status === 'paid' ? (
                                <span className="text-green-600 font-medium">Đã thanh toán đủ</span>
                            ) : (
                                <span className="text-red-600 font-medium">Còn phải trả: {formatCurrency((po.total_amount || 0) - (po.paid_amount || 0))}đ</span>
                            )}
                        </div>
                    </div>

                    {/* Products Table - Full Width */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-gray-900">Thông tin sản phẩm</h3>
                            <button className="text-gray-400 hover:text-gray-600">
                                <MoreHorizontal size={18} />
                            </button>
                        </div>

                        {/* Desktop Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-y border-gray-200">
                                    <tr>
                                        <th className="text-left px-2 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap">STT</th>
                                        <th className="text-left px-2 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap hidden sm:table-cell">Ảnh</th>
                                        <th className="text-left px-2 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap min-w-[150px]">Tên sản phẩm</th>
                                        <th className="text-center px-2 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap hidden md:table-cell">Đơn vị</th>
                                        <th className="text-center px-2 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap">SL nhập</th>
                                        <th className="text-right px-2 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap">Đơn giá</th>
                                        <th className="text-right px-2 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap hidden lg:table-cell">Giá bán</th>
                                        <th className="text-right px-2 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap hidden xl:table-cell">± Giá nhập</th>
                                        <th className="text-right px-2 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap hidden xl:table-cell">± Giá vốn</th>
                                        <th className="text-center px-2 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap hidden md:table-cell">CK%</th>
                                        <th className="text-right px-2 py-2 text-xs font-semibold text-green-600 whitespace-nowrap hidden lg:table-cell">Lợi nhuận</th>
                                        <th className="text-center px-2 py-2 text-xs font-semibold text-green-600 whitespace-nowrap hidden lg:table-cell">%</th>
                                        <th className="text-center px-2 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap hidden xl:table-cell">Thuế</th>
                                        <th className="text-right px-2 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap">Thành tiền</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {items.map((item: any, index: number) => {
                                        const unitPrice = item.unit_price || 0;
                                        const sellPrice = sellPrices[item.id] ?? (item.sell_price ?? unitPrice * 1.3);
                                        const qty = item.quantity || item.ordered_qty || 0;
                                        const discount = discounts[item.id] ?? (item.discount_percent || 0);
                                        const tax = item.tax_percent || 0;
                                        const total = qty * unitPrice * (1 - discount / 100);
                                        const profit = sellPrice - unitPrice;
                                        const profitPercent = unitPrice > 0 ? (profit / unitPrice) * 100 : 0;

                                        // Tính ± Giá nhập (so với đơn gần nhất)
                                        const lastImportPrice = lastImportPrices[item.product_id] || 0;
                                        const priceChange = lastImportPrice > 0 ? unitPrice - lastImportPrice : 0;

                                        // Tính ± Giá vốn (so với giá vốn hiện tại trước khi nhập đơn này)
                                        const currentCost = currentCosts[item.product_id] || 0;
                                        // Nếu đơn chưa nhập kho, giá vốn mới sẽ = WAC(currentCost, unitPrice)
                                        // Đây là preview, chưa thực sự thay đổi
                                        const costChange = currentCost > 0 ? unitPrice - currentCost : 0;

                                        // Đơn vị từ database hoặc mặc định
                                        const itemUnit = item.unit || 'Cái';

                                        // Cho phép chỉnh chiết khấu khi đơn ở trạng thái pending
                                        const canEditDiscount = po?.status === 'pending';

                                        return (
                                            <tr key={item.id} className="hover:bg-blue-50">
                                                <td className="px-2 py-3 text-gray-600">{index + 1}</td>
                                                <td className="px-2 py-3 hidden sm:table-cell">
                                                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                                        <Package size={16} className="text-gray-400" />
                                                    </div>
                                                </td>
                                                <td className="px-2 py-3">
                                                    <div
                                                        className="font-medium text-gray-900 text-sm cursor-pointer hover:text-blue-600 hover:underline"
                                                        onClick={() => {
                                                            const product = products.find(p => p.id === item.product_id);
                                                            if (product) setViewingProduct(product);
                                                        }}
                                                    >{item.product_name || 'Sản phẩm'}</div>
                                                    <div className="text-xs text-gray-500">{item.sku}</div>
                                                </td>
                                                <td className="px-2 py-3 text-center text-gray-600 hidden md:table-cell">{itemUnit}</td>
                                                <td className="px-2 py-3 text-center font-medium">{qty}</td>
                                                <td className="px-2 py-3 text-right text-blue-600 font-medium">{formatCurrency(unitPrice)}đ</td>
                                                <td className="px-2 py-3 text-right hidden lg:table-cell">
                                                    <input
                                                        type="number"
                                                        value={sellPrice}
                                                        onChange={(e) => handleSellPriceChange(item.id, parseInt(e.target.value) || 0)}
                                                        className="w-20 px-1 py-0.5 border border-gray-300 rounded text-right text-sm"
                                                    />
                                                </td>
                                                {/* ± Giá nhập */}
                                                <td className={`px-2 py-3 text-right hidden xl:table-cell ${priceChange > 0 ? 'text-red-600' : priceChange < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                                    {priceChange !== 0 ? (
                                                        <>{priceChange > 0 ? '+' : ''}{formatCurrency(priceChange)}đ</>
                                                    ) : (
                                                        '0đ'
                                                    )}
                                                </td>
                                                {/* ± Giá vốn */}
                                                <td className={`px-2 py-3 text-right hidden xl:table-cell ${costChange > 0 ? 'text-red-600' : costChange < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                                    {costChange !== 0 ? (
                                                        <>{costChange > 0 ? '+' : ''}{formatCurrency(costChange)}</>
                                                    ) : (
                                                        '0'
                                                    )}
                                                </td>
                                                {/* Chiết khấu */}
                                                <td className="px-2 py-3 text-center hidden md:table-cell">
                                                    {canEditDiscount ? (
                                                        <input
                                                            type="number"
                                                            value={discount}
                                                            onChange={(e) => handleDiscountChange(item.id, parseFloat(e.target.value) || 0)}
                                                            className="w-14 px-1 py-0.5 border border-gray-300 rounded text-center text-sm"
                                                            min={0}
                                                            max={100}
                                                        />
                                                    ) : (
                                                        <span className="text-gray-600">{discount}%</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-3 text-right text-green-600 font-medium hidden lg:table-cell">+{formatCurrency(profit)}đ</td>
                                                <td className="px-2 py-3 text-center text-green-600 hidden lg:table-cell">+{profitPercent.toFixed(0)}%</td>
                                                <td className="px-2 py-3 text-center text-gray-600 hidden xl:table-cell">{tax}%</td>
                                                <td className="px-2 py-3 text-right font-semibold text-gray-900">{formatCurrency(total)}đ</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {items.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                Chưa có sản phẩm nào
                            </div>
                        )}
                    </div>

                    {/* Bottom Row: Notes/Tags + Summary */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Notes & Tags */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="bg-white rounded-xl border border-gray-200 p-4">
                                    <h3 className="font-semibold text-gray-900 mb-3">Ghi chú đơn</h3>
                                    <p className="text-sm text-gray-600">{po.notes || 'Chưa có ghi chú'}</p>
                                </div>
                                <div className="bg-white rounded-xl border border-gray-200 p-4">
                                    <h3 className="font-semibold text-gray-900 mb-3">Tags</h3>
                                    <p className="text-sm text-gray-500">Chưa có tags</p>
                                </div>
                            </div>

                            {/* Activity Log */}
                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <Clock size={16} />
                                    Lịch sử hoạt động
                                </h3>
                                {activityLogs.length > 0 ? (
                                    <div className="space-y-3 max-h-64 overflow-y-auto">
                                        {activityLogs.map((log, index) => (
                                            <div key={log.id || index} className="flex items-start gap-3 text-sm border-l-2 border-blue-200 pl-3">
                                                <div className="flex-1">
                                                    <div className="font-medium text-gray-900">{log.action}</div>
                                                    {log.details && (
                                                        <div className="text-gray-600">{log.details}</div>
                                                    )}
                                                    <div className="text-xs text-gray-400 mt-1">
                                                        {log.user_name || 'Hệ thống'} • {new Date(log.created_at).toLocaleString('vi-VN')}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 italic">Chưa có hoạt động nào được ghi lại</p>
                                )}
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Số lượng</span>
                                        <span className="font-medium">{totalQty}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Tổng tiền</span>
                                        <span className="font-medium text-blue-600">{formatCurrency(po.total_amount)}đ</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Chiết khấu (F6)</span>
                                        <span>0</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Chi phí nhập hàng</span>
                                        <span className="text-blue-600">+ Thêm chi phí (F7)</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Thuế</span>
                                        <span>0</span>
                                    </div>

                                    <div className="border-t border-gray-200 pt-3">
                                        <div className="flex justify-between">
                                            <span className="font-semibold text-gray-900">Tiền cần trả</span>
                                            <span className="font-bold text-lg text-green-600">{formatCurrency(po.total_amount)}đ</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Invoice Images */}
                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                                <h3 className="font-semibold text-gray-900 mb-3">
                                    📄 Ảnh hóa đơn <span className="text-sm font-normal text-gray-500">({invoiceImages.length}/10)</span>
                                </h3>
                                {invoiceImages.length > 0 ? (
                                    <div className="grid grid-cols-4 gap-2">
                                        {invoiceImages.map((url, index) => (
                                            <div
                                                key={index}
                                                className="relative aspect-square rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                                onClick={() => setSelectedImage(url)}
                                            >
                                                <img src={url} alt={`Invoice ${index + 1}`} className="w-full h-full object-cover" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-yellow-50 text-yellow-700 text-xs p-2 rounded-lg">
                                        Chưa có ảnh hóa đơn nào
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Image Lightbox */}
                {selectedImage && (
                    <div
                        className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-pointer"
                        onClick={() => setSelectedImage(null)}
                    >
                        <button
                            className="absolute top-4 right-4 text-white hover:text-gray-300"
                            onClick={() => setSelectedImage(null)}
                        >
                            <X size={32} />
                        </button>
                        <img
                            src={selectedImage}
                            alt="Invoice Full"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )}

                {/* Receive Confirmation Modal */}
                {showReceiveConfirm && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md min-w-[350px] p-6 animate-scale-in">
                            <div className="text-center mb-4">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Truck size={32} className="text-green-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">Xác nhận nhập hàng</h3>
                                <p className="text-sm text-gray-600 mt-2">
                                    Bạn có chắc muốn bắt đầu nhập kho cho đơn này?
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
                                <div className="flex justify-between mb-1">
                                    <span className="text-gray-600">Mã đơn:</span>
                                    <span className="font-medium">{po?.po_number}</span>
                                </div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-gray-600">Nhà cung cấp:</span>
                                    <span className="font-medium">{po?.supplier_name || 'Không có'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Tổng tiền:</span>
                                    <span className="font-medium text-blue-600">{formatCurrency(po?.total_amount || 0)} đ</span>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowReceiveConfirm(false)}
                                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleStartReceipt}
                                    disabled={isCreatingReceipt}
                                    className="flex-1 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    {isCreatingReceipt ? 'Đang xử lý...' : 'Xác nhận nhập'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Payment Confirmation Modal */}
                {showPaymentModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md min-w-[350px] p-6 animate-scale-in">
                            <div className="text-center mb-4">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <CreditCard size={32} className="text-blue-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">Xác nhận thanh toán</h3>
                                <p className="text-sm text-gray-600 mt-2">
                                    Bạn có chắc muốn thanh toán cho đơn này?
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
                                <div className="flex justify-between mb-1">
                                    <span className="text-gray-600">Mã đơn:</span>
                                    <span className="font-medium">{po?.po_number}</span>
                                </div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-gray-600">Nhà cung cấp:</span>
                                    <span className="font-medium">{po?.supplier_name || 'Không có'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Số tiền thanh toán:</span>
                                    <span className="font-medium text-green-600">{formatCurrency(po?.total_amount || 0)} đ</span>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handlePayment}
                                    disabled={isProcessingPayment}
                                    className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {isProcessingPayment ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Print Template - Hidden */}
                <div style={{ display: 'none' }}>
                    <div ref={componentRef}>
                        {po && (
                            <PurchaseReceiptTemplate
                                data={{
                                    receiptNumber: po.po_number,
                                    date: new Date(po.created_at),
                                    supplier: {
                                        name: po.supplier_name || 'N/A',
                                        phone: po.supplier_phone,
                                        address: po.supplier_address,
                                    },
                                    items: (po.items || []).map(item => ({
                                        name: item.product_name,
                                        sku: item.sku,
                                        quantity: item.ordered_qty || 0,
                                        unitName: item.unit,
                                        unitPrice: item.unit_price || 0,
                                    })),
                                    totalAmount: po.total_amount || 0,
                                    paidAmount: po.paid_amount || 0,
                                    debtAmount: (po.total_amount || 0) - (po.paid_amount || 0),
                                    notes: po.notes,
                                    createdBy: po.created_by || 'Admin',
                                    storeName: printSettings.storeName,
                                    storeAddress: printSettings.storeAddress,
                                }}
                                config={printSettings.templates.purchase_receipt}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Activity Logs Modal */}
            {showHistoryModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50" onClick={() => setShowHistoryModal(false)} />

                    {/* Dialog */}
                    <div
                        className="relative bg-white rounded-xl shadow-xl max-h-[80vh] overflow-hidden z-10"
                        style={{ width: '95vw', maxWidth: '500px' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                            <h2 className="text-lg font-semibold text-gray-900">📜 Lịch sử đơn nhập hàng</h2>
                            <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-blue-100 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                        {/* Content */}
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            {activityLogs.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">Chưa có lịch sử hoạt động</p>
                            ) : (
                                <div className="space-y-4">
                                    {activityLogs.map(log => (
                                        <div key={log.id} className="flex gap-4 pb-4 border-b last:border-0">
                                            <div className="w-2 h-2 mt-2 rounded-full bg-blue-500 flex-shrink-0" />
                                            <div className="flex-1">
                                                <div className="flex justify-between text-sm">
                                                    <span className="font-medium text-gray-900">{log.action}</span>
                                                    <span className="text-gray-500">{new Date(log.created_at).toLocaleString('vi-VN')}</span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                                                {log.user_name && (
                                                    <p className="text-xs text-gray-400 mt-1">Bởi: {log.user_name}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Footer */}
                        <div className="px-6 py-4 border-t bg-gray-50">
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Confirm Modal */}
            {showCancelConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50" onClick={() => setShowCancelConfirm(false)} />

                    {/* Dialog */}
                    <div
                        className="relative bg-white rounded-xl shadow-xl overflow-hidden z-10"
                        style={{ width: '90vw', maxWidth: '400px' }}
                    >
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                                <X className="w-8 h-8 text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Xác nhận hủy đơn</h3>
                            <p className="text-gray-600 mb-6">Bạn có chắc chắn muốn hủy đơn hàng này? Thao tác này không thể hoàn tác.</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowCancelConfirm(false)}
                                    className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                                >
                                    Quay lại
                                </button>
                                <button
                                    onClick={confirmCancelOrder}
                                    className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                                >
                                    Xác nhận hủy
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Return to Supplier Modal */}
            <ReturnToSupplierModal
                isOpen={showReturnModal}
                onClose={() => setShowReturnModal(false)}
                items={items.map((item: any) => ({
                    id: item.id,
                    product_id: item.product_id,
                    product_name: item.product_name || 'Sản phẩm',
                    sku: item.sku || '',
                    ordered_qty: item.ordered_qty || item.quantity || 0,
                    unit_price: item.unit_price || 0
                }))}
                poNumber={po?.po_number || ''}
                onConfirm={handleReturnConfirm}
            />

            {/* Product Details Modal */}
            {viewingProduct && (
                <ProductDetailsModal
                    product={viewingProduct}
                    onClose={() => setViewingProduct(null)}
                    onEdit={() => { /* No-op in PO detail */ }}
                />
            )}
        </>
    );
}
