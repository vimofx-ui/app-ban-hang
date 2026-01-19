import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useStockMovementStore } from '@/stores/stockMovementStore';
import { canViewCostPrice, canViewPurchasePrice, canDeleteProduct, getDeleteErrorMessage } from '@/stores/authStore';
import { formatVND } from '@/lib/cashReconciliation';
import type { Product, OrderItem } from '@/types';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useProductStore } from '@/stores/productStore';
import { Edit2, Check, X, ExternalLink, Trash2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

interface Props {
    product: Product;
    onClose: () => void;
    onEdit: (product: Product) => void;
    onDelete?: (product: Product) => Promise<void>;
}

export function ProductDetailsModal({ product, onClose, onEdit, onDelete }: Props) {
    const navigate = useNavigate();
    const { deleteProduct } = useProductStore();
    const [activeTab, setActiveTab] = useState<'info' | 'sales' | 'imports'>('info');
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const getMovementsByProduct = useStockMovementStore((s) => s.getMovementsByProduct);

    // Branch Price Edit State
    const [isEditingPrice, setIsEditingPrice] = useState(false);
    const [newPrice, setNewPrice] = useState(product.selling_price);
    const { branchId } = useAuthStore();
    const { updateBranchPrice } = useProductStore();

    // Creator name state
    const [creatorName, setCreatorName] = useState<string | null>(product.created_by_name || null);

    // Fetch creator name if not available
    useEffect(() => {
        async function fetchCreatorName() {
            if (!product.created_by || product.created_by_name) return;

            if (supabase) {
                const { data } = await supabase
                    .from('user_profiles')
                    .select('full_name')
                    .eq('id', product.created_by)
                    .single();

                if (data?.full_name) {
                    setCreatorName(data.full_name);
                }
            }
        }
        fetchCreatorName();
    }, [product.created_by, product.created_by_name]);

    useEffect(() => {
        setNewPrice(product.selling_price);
    }, [product.selling_price]);

    const handleUpdatePrice = async () => {
        if (!branchId) return;
        const success = await updateBranchPrice(product.id, newPrice);
        if (success) setIsEditingPrice(false);
    };

    useEffect(() => {
        if (activeTab === 'info') return;

        async function fetchHistory() {
            setLoading(true);
            try {
                let data: any[] = [];

                if (supabase) {
                    // Supabase mode
                    if (activeTab === 'sales') {
                        const { data: items, error } = await supabase
                            .from('order_items')
                            .select('*, order:orders(created_at, order_number)')
                            .eq('product_id', product.id)
                            .order('created_at', { ascending: false })
                            .limit(50);
                        if (!error) data = items || [];
                    } else {
                        // Fetch từ purchase_order_items để có thông tin đơn nhập chi tiết hơn
                        const { data: poItems, error } = await supabase
                            .from('purchase_order_items')
                            .select(`
                                id,
                                quantity,
                                unit_price,
                                received_quantity,
                                created_at,
                                purchase_order_id,
                                purchase_order:purchase_orders(id, po_number, created_at, status, supplier:suppliers(name))
                            `)
                            .eq('product_id', product.id)
                            .order('created_at', { ascending: false })
                            .limit(50);
                        if (!error) data = poItems || [];
                    }
                } else {
                    // Demo mode - use stockMovementStore
                    const movements = getMovementsByProduct(product.id);
                    if (activeTab === 'sales') {
                        data = movements
                            .filter(m => m.movement_type === 'sale')
                            .map(m => ({
                                id: m.id,
                                quantity: Math.abs(m.quantity),
                                unit_price: m.cost_price_at_time,
                                total_price: Math.abs(m.quantity) * (m.cost_price_at_time || 0),
                                order: { created_at: m.created_at, order_number: m.reference_number || m.notes }
                            }));
                    } else {
                        data = movements
                            .filter(m => ['purchase', 'return', 'adjustment_in'].includes(m.movement_type))
                            .map(m => ({
                                id: m.id,
                                movement_type: m.movement_type,
                                quantity: m.quantity,
                                created_at: m.created_at,
                                notes: m.notes
                            }));
                    }
                }
                setHistory(data);
            } catch (e) {
                console.error("Error loading history:", e);
            } finally {
                setLoading(false);
            }
        }

        fetchHistory();
    }, [activeTab, product.id, getMovementsByProduct]);

    const formatDate = (isoString?: string) => {
        if (!isoString) return 'N/A';
        return new Date(isoString).toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm md:p-4">
            {/* Mobile: full screen, Desktop: max-w-5xl centered */}
            <div className="bg-white md:rounded-2xl w-full md:max-w-5xl h-full md:h-auto md:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b bg-white">
                    <div className="flex gap-4 items-center">
                        <div className="w-16 h-16 bg-white rounded-xl border-2 border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                            {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-3xl">📦</span>
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{product.name}</h2>
                            <div className="flex gap-2 text-sm text-gray-500 mt-1 items-center">
                                <span className="bg-gray-100 px-2.5 py-1 rounded-md text-gray-700 font-mono text-xs font-bold border">
                                    {product.barcode || product.sku || 'No Code'}
                                </span>
                                <span className="text-gray-300">•</span>
                                <span>Tồn kho: <b className={product.current_stock <= product.min_stock ? 'text-red-500' : 'text-primary'}>{product.current_stock}</b> {product.base_unit}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b px-6">
                    <button
                        onClick={() => setActiveTab('info')}
                        className={cn("px-6 py-4 text-sm font-bold border-b-2 transition-all", activeTab === 'info' ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700")}
                    >
                        Thông tin chi tiết
                    </button>
                    <button
                        onClick={() => setActiveTab('sales')}
                        className={cn("px-6 py-4 text-sm font-bold border-b-2 transition-all", activeTab === 'sales' ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700")}
                    >
                        Lịch sử bán hàng
                    </button>
                    <button
                        onClick={() => setActiveTab('imports')}
                        className={cn("px-6 py-4 text-sm font-bold border-b-2 transition-all", activeTab === 'imports' ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700")}
                    >
                        Lịch sử nhập hàng
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
                    {activeTab === 'info' && (
                        <div className="space-y-4">
                            {/* Responsive: 1 column on mobile, 2 on desktop */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <div className="bg-white p-5 rounded-2xl border shadow-sm">
                                        <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Thông tin giá & mã</h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between border-b border-dashed border-gray-200 pb-2 items-center">
                                                <div className="flex flex-col">
                                                    <span className="text-gray-500">Giá bán lẻ {product.has_price_override ? '(Chi nhánh)' : ''}</span>
                                                    {product.has_price_override && product.base_price && (
                                                        <span className="text-xs text-gray-400 line-through">Gốc: {formatVND(product.base_price)}</span>
                                                    )}
                                                </div>
                                                {isEditingPrice ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            className="w-24 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-primary/50 outline-none"
                                                            value={newPrice}
                                                            onChange={(e) => setNewPrice(Number(e.target.value))}
                                                            autoFocus
                                                        />
                                                        <button onClick={handleUpdatePrice} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={16} /></button>
                                                        <button onClick={() => setIsEditingPrice(false)} className="p-1 text-red-500 hover:bg-red-50 rounded"><X size={16} /></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn("font-bold text-lg", product.has_price_override ? "text-orange-600" : "text-primary")}>
                                                            {formatVND(product.selling_price || 0)}
                                                        </span>
                                                        {branchId && (
                                                            <button
                                                                onClick={() => setIsEditingPrice(true)}
                                                                className="p-1 text-gray-300 hover:text-primary transition-colors"
                                                                title="Sửa giá tại chi nhánh này"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {canViewPurchasePrice() && (
                                                <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                                                    <span className="text-gray-500">Giá nhập</span>
                                                    <span className="font-semibold text-blue-600">{formatVND(product.purchase_price || product.cost_price || 0)}</span>
                                                </div>
                                            )}
                                            {canViewCostPrice() && (
                                                <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                                                    <span className="text-gray-500">Giá vốn (bình quân)</span>
                                                    <span className="font-semibold text-amber-600">{formatVND(product.avg_cost || product.cost_price || 0)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                                                <span className="text-gray-500">Giá sỉ</span>
                                                <span className="font-medium">{product.wholesale_price ? formatVND(product.wholesale_price) : '---'}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                                                <span className="text-gray-500">Mã SKU</span>
                                                <span className="font-mono text-gray-700">{product.sku || '---'}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                                                <span className="text-gray-500">Mã vạch / Barcode</span>
                                                <span className="font-mono text-gray-700">{product.barcode || '---'}</span>
                                            </div>
                                            <div className="flex justify-between pt-1">
                                                <span className="text-gray-500">Thuế (VAT)</span>
                                                <span className="font-medium text-gray-900">{product.tax_apply ? 'Có áp dụng' : 'Không'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white p-5 rounded-2xl border shadow-sm">
                                        <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Kho hàng</h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                                                <span className="text-gray-500">Trọng lượng</span>
                                                <span className="font-medium text-gray-900">{product.weight ? `${product.weight} g` : '---'}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                                                <span className="text-gray-500">Thương hiệu</span>
                                                <span className="font-medium text-gray-900">{product.brand || '---'}</span>
                                            </div>
                                            <div className="flex justify-between pt-1">
                                                <span className="text-gray-500">Cho phép bán âm</span>
                                                <span className={`font-medium ${product.allow_negative_stock ? 'text-amber-600' : 'text-gray-700'}`}>
                                                    {product.allow_negative_stock ? 'Cho phép' : 'Không'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* Unit Conversions Section - Only show if has converted units */}
                                    {product.units && product.units.filter(u => !u.is_base_unit).length > 0 && (
                                        <div className="bg-gray-50 p-4 rounded-xl">
                                            <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Phiên bản sản phẩm</h3>
                                            <div className="space-y-2">
                                                {/* Base Unit */}
                                                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                                                    <div className="w-12 h-12 rounded-lg overflow-hidden border bg-gray-50 flex-shrink-0">
                                                        {product.image_url ? (
                                                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-xl bg-gray-100">📦</div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-gray-900">{product.base_unit || 'cái'}</div>
                                                        <div className="text-xs text-gray-500 truncate">SKU: {product.sku || '---'}</div>
                                                        <div className="text-xs text-gray-400 truncate">BC: {product.barcode || '---'}</div>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <div className="text-lg font-bold text-green-600">{formatVND(product.selling_price)}</div>
                                                        {canViewPurchasePrice() && product.cost_price > 0 && (
                                                            <div className="text-xs text-gray-500">Nhập: {formatVND(product.cost_price)}</div>
                                                        )}
                                                        <div className="text-xs text-gray-600 mt-0.5">
                                                            Tồn: <span className={cn("font-bold", product.current_stock <= product.min_stock ? "text-red-600" : "text-green-600")}>{product.current_stock}</span>
                                                            {' • '}Có thể bán: {Math.max(0, product.current_stock)}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Converted Units */}
                                                {product.units.filter(u => !u.is_base_unit).map((unit) => {
                                                    const unitStock = Math.floor((product.current_stock || 0) / (unit.conversion_rate || 1));
                                                    return (
                                                        <div key={unit.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                                                            <div className="text-gray-300 text-lg">↳</div>
                                                            <div className="w-12 h-12 rounded-lg overflow-hidden border bg-gray-50 flex-shrink-0">
                                                                {unit.image_url ? (
                                                                    <img src={unit.image_url} alt={unit.unit_name} className="w-full h-full object-cover" />
                                                                ) : product.image_url ? (
                                                                    <img src={product.image_url} alt={unit.unit_name} className="w-full h-full object-cover opacity-50" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-xl bg-gray-100">📦</div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-bold text-gray-900">
                                                                    {unit.unit_name}
                                                                    <span className="text-xs font-normal text-gray-400 ml-1">= {unit.conversion_rate} {product.base_unit}</span>
                                                                </div>
                                                                <div className="text-xs text-gray-500 truncate">SKU: {unit.sku || '---'}</div>
                                                                <div className="text-xs text-gray-400 truncate">BC: {unit.barcode || '---'}</div>
                                                            </div>
                                                            <div className="text-right flex-shrink-0">
                                                                <div className="text-lg font-bold text-green-600">{formatVND(unit.selling_price || 0)}</div>
                                                                {canViewPurchasePrice() && unit.cost_price && unit.cost_price > 0 && (
                                                                    <div className="text-xs text-gray-500">Nhập: {formatVND(unit.cost_price)}</div>
                                                                )}
                                                                <div className="text-xs text-gray-600 mt-0.5">
                                                                    Tồn: <span className={cn("font-bold", unitStock < 0 ? "text-red-600" : "text-green-600")}>{unitStock}</span>
                                                                    {' • '}Có thể bán: {Math.max(0, unitStock)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* System Info Section */}
                                    <div className="bg-white p-5 rounded-2xl border shadow-sm h-fit">
                                        <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Hệ thống</h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Ngày tạo</span>
                                                <span className="font-medium text-gray-900">{formatDate(product.created_at)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Cập nhật cuối</span>
                                                <span className="font-medium text-gray-900">{formatDate(product.updated_at)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Người tạo</span>
                                                <span className="font-medium text-blue-600">
                                                    {creatorName || '---'}
                                                </span>
                                            </div>

                                            <div className="mt-6 pt-4 border-t border-gray-100 space-y-2">
                                                <button
                                                    onClick={() => { onClose(); onEdit(product); }}
                                                    className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors flex items-center justify-center gap-2 shadow-md shadow-primary/20"
                                                >
                                                    <Edit2 size={16} />
                                                    Chỉnh sửa sản phẩm
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        // Check permission first
                                                        if (!canDeleteProduct(product)) {
                                                            const errorMsg = getDeleteErrorMessage(product);
                                                            toast.error(errorMsg || 'Bạn không có quyền xóa sản phẩm này');
                                                            return;
                                                        }
                                                        setShowDeleteConfirm(true);
                                                    }}
                                                    className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2 border border-red-200"
                                                >
                                                    <Trash2 size={16} />
                                                    Xóa sản phẩm
                                                </button>

                                                {/* Delete Confirmation Dialog */}
                                                <ConfirmDialog
                                                    isOpen={showDeleteConfirm}
                                                    title="Xóa sản phẩm?"
                                                    message={`Bạn có chắc muốn xóa sản phẩm:\n\n"${product.name}"\n\nHành động này không thể hoàn tác!`}
                                                    confirmText="Xóa"
                                                    cancelText="Hủy"
                                                    type="danger"
                                                    onConfirm={async () => {
                                                        setShowDeleteConfirm(false);
                                                        try {
                                                            await deleteProduct(product.id);
                                                            toast.success(`Đã xóa sản phẩm "${product.name}"`);
                                                            onClose();
                                                        } catch (err: any) {
                                                            console.error('Delete error:', err);
                                                            toast.error('Không thể xóa: ' + (err.message || 'Lỗi không xác định'));
                                                        }
                                                    }}
                                                    onCancel={() => setShowDeleteConfirm(false)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'sales' && (
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden h-full flex flex-col">
                            {loading ? (
                                <div className="p-8 text-center text-gray-500">Đang tải...</div>
                            ) : history.length === 0 ? (
                                <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center h-48">
                                    <span className="text-4xl mb-3">🧾</span>
                                    <span>Chưa có lịch sử bán hàng</span>
                                </div>
                            ) : (
                                <div className="overflow-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-white border-b border-gray-100 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Thời gian</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Đơn hàng</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Số lượng</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Giá bán</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Tổng tiền</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {history.map((item: any) => (
                                                <tr
                                                    key={item.id}
                                                    className="hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors cursor-pointer"
                                                    onClick={() => {
                                                        if (item.order_id) {
                                                            onClose();
                                                            navigate(`/don-hang?order=${item.order_id}`);
                                                        }
                                                    }}
                                                    title="Bấm để xem chi tiết đơn hàng"
                                                >
                                                    <td className="px-6 py-4 text-gray-600 font-medium">{formatDate(item.order?.created_at || item.created_at)}</td>
                                                    <td className="px-6 py-4">
                                                        <span className="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 inline-flex items-center gap-1">
                                                            {item.order?.order_number || '---'}
                                                            {item.order_id && <ExternalLink size={12} />}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-gray-900">{item.quantity}</td>
                                                    <td className="px-6 py-4 text-right text-gray-600">{formatVND(item.unit_price)}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-primary">{formatVND(item.total_price)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'imports' && (
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden h-full flex flex-col">
                            {loading ? (
                                <div className="p-8 text-center text-gray-500">Đang tải...</div>
                            ) : history.length === 0 ? (
                                <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center h-48">
                                    <span className="text-4xl mb-3">🚛</span>
                                    <span>Chưa có lịch sử nhập hàng</span>
                                </div>
                            ) : (
                                <div className="overflow-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-white border-b border-gray-100 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Thời gian</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Đơn nhập</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nhà cung cấp</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Số lượng</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Giá nhập</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {history.map((item: any) => (
                                                <tr
                                                    key={item.id}
                                                    className="hover:bg-green-50 border-b border-gray-50 last:border-0 transition-colors cursor-pointer"
                                                    onClick={() => {
                                                        if (item.purchase_order_id) {
                                                            onClose();
                                                            navigate(`/nhap-hang/${item.purchase_order_id}`);
                                                        }
                                                    }}
                                                    title="Bấm để xem chi tiết đơn nhập"
                                                >
                                                    <td className="px-6 py-4 text-gray-600 font-medium">{formatDate(item.purchase_order?.created_at || item.created_at)}</td>
                                                    <td className="px-6 py-4">
                                                        <span className="font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-200 inline-flex items-center gap-1">
                                                            {item.purchase_order?.po_number || '---'}
                                                            {item.purchase_order_id && <ExternalLink size={12} />}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-700">{item.purchase_order?.supplier?.name || '---'}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-primary">
                                                        {item.received_quantity > 0 ? (
                                                            <span>{item.received_quantity}/{item.quantity}</span>
                                                        ) : (
                                                            <span>+{item.quantity}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-gray-600">{formatVND(item.unit_price)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
