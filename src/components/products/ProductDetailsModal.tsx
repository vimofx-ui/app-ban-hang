import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useStockMovementStore } from '@/stores/stockMovementStore';
import { canViewCostPrice, canViewPurchasePrice } from '@/stores/authStore';
import { formatVND } from '@/lib/cashReconciliation';
import type { Product, OrderItem } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
    product: Product;
    onClose: () => void;
    onEdit: (product: Product) => void;
}

export function ProductDetailsModal({ product, onClose, onEdit }: Props) {
    const [activeTab, setActiveTab] = useState<'info' | 'sales' | 'imports'>('info');
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const getMovementsByProduct = useStockMovementStore((s) => s.getMovementsByProduct);

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
                        const { data: moves, error } = await supabase
                            .from('stock_movements')
                            .select('*')
                            .eq('product_id', product.id)
                            .in('movement_type', ['purchase', 'import', 'adjustment_in', 'return'])
                            .order('created_at', { ascending: false })
                            .limit(50);
                        if (!error) data = moves || [];
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <div className="bg-white p-5 rounded-2xl border shadow-sm">
                                        <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Thông tin giá & mã</h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                                                <span className="text-gray-500">Giá bán lẻ</span>
                                                <span className="font-bold text-primary text-lg">{formatVND(product.selling_price || 0)}</span>
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
                                                    <span className="font-semibold text-amber-600">{formatVND(product.avg_cost_price || product.cost_price || 0)}</span>
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
                                    {/* Unit Conversions Section */}
                                    {product.units && product.units.length > 0 && (
                                        <div className="bg-white p-5 rounded-2xl border shadow-sm">
                                            <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Đơn vị quy đổi</h3>
                                            <div className="space-y-2">
                                                {product.units.filter(u => !u.is_base_unit).map((unit) => (
                                                    <div key={unit.id} className="flex justify-between items-center py-1.5 border-b border-dashed border-gray-200 last:border-0">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-gray-800">{unit.unit_name}</span>
                                                                <span className="text-gray-300">=</span>
                                                                <span className="text-primary font-bold">{unit.conversion_rate} {product.base_unit}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right text-sm">
                                                            {unit.barcode && (
                                                                <div className="font-mono text-gray-400 text-xs mb-0.5">{unit.barcode}</div>
                                                            )}
                                                            {unit.selling_price && (
                                                                <div className="font-bold text-green-600">{formatVND(unit.selling_price)}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
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
                                                    {(product as any).created_by_name || (product as any).created_by || '---'}
                                                </span>
                                            </div>

                                            <div className="mt-6 pt-4 border-t border-gray-100">
                                                <button
                                                    onClick={() => { onClose(); onEdit(product); }}
                                                    className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors flex items-center justify-center gap-2 shadow-md shadow-primary/20"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                    </svg>
                                                    Chỉnh sửa sản phẩm
                                                </button>
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
                                                <tr key={item.id} className="hover:bg-gray-50/80 border-b border-gray-50 last:border-0 transition-colors">
                                                    <td className="px-6 py-4 text-gray-600 font-medium">{formatDate(item.order?.created_at || item.created_at)}</td>
                                                    <td className="px-6 py-4">
                                                        <span className="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                                                            {item.order?.order_number || '---'}
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
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Loại giao dịch</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Số lượng</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ghi chú</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {history.map((item: any) => (
                                                <tr key={item.id} className="hover:bg-gray-50/80 border-b border-gray-50 last:border-0 transition-colors">
                                                    <td className="px-6 py-4 text-gray-600 font-medium">{formatDate(item.created_at)}</td>
                                                    <td className="px-6 py-4 capitalize">
                                                        <span className={cn("px-3 py-1 rounded-full text-xs font-bold border",
                                                            item.movement_type === 'import' ? "bg-green-50 text-green-700 border-green-200" :
                                                                item.movement_type === 'return' ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-gray-50 text-gray-700 border-gray-200"
                                                        )}>
                                                            {item.movement_type === 'import' ? '📥 Nhập hàng' :
                                                                item.movement_type === 'return' ? '↩️ Khách trả' :
                                                                    item.movement_type === 'purchase' ? '🛒 Nhập mua' :
                                                                        item.movement_type === 'adjustment_in' ? '⚖️ Cân bằng kho' :
                                                                            item.movement_type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-primary">+{item.quantity}</td>
                                                    <td className="px-6 py-4 text-gray-500 truncate max-w-[200px]" title={item.notes}>{item.notes || '---'}</td>
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
