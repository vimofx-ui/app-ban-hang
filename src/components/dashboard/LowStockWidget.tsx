// =============================================================================
// LOW STOCK WIDGET - Dashboard widget showing products needing reorder
// =============================================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Package, ArrowRight, RefreshCw } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useBrandStore } from '@/stores/brandStore';

interface LowStockProduct {
    id: string;
    name: string;
    sku: string;
    current_stock: number;
    min_stock: number;
}

export function LowStockWidget() {
    const navigate = useNavigate();
    const authBrandId = useAuthStore(state => state.brandId);
    const currentBrandId = useBrandStore(state => state.currentBrand?.id);
    const brandId = authBrandId || currentBrandId;

    const [products, setProducts] = useState<LowStockProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (brandId) {
            loadLowStockProducts();
        }
    }, [brandId]);

    const loadLowStockProducts = async () => {
        if (!isSupabaseConfigured() || !brandId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const { data: prods, error } = await supabase
                .from('products')
                .select(`
                    id,
                    name,
                    sku,
                    min_stock,
                    inventory:inventories(quantity, min_stock)
                `)
                .eq('brand_id', brandId)
                .eq('is_active', true)
                .order('name')
                .limit(100);

            if (error) throw error;

            // Filter products with stock <= min_stock
            const lowStock = (prods || [])
                .map((p: any) => {
                    const inv = Array.isArray(p.inventory) ? p.inventory[0] : p.inventory;
                    const currentStock = inv?.quantity ?? 0;
                    const minStock = inv?.min_stock ?? p.min_stock ?? 0;
                    return {
                        id: p.id,
                        name: p.name,
                        sku: p.sku || '',
                        current_stock: currentStock,
                        min_stock: minStock,
                    };
                })
                .filter((p: LowStockProduct) => p.min_stock > 0 && p.current_stock <= p.min_stock)
                .slice(0, 5); // Show only top 5

            setProducts(lowStock);
        } catch (err) {
            console.error('[LowStockWidget] Error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="space-y-3">
                        <div className="h-10 bg-gray-200 rounded"></div>
                        <div className="h-10 bg-gray-200 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-orange-50 to-red-50">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-100 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Sản phẩm sắp hết</h3>
                        <p className="text-xs text-gray-500">{products.length} sản phẩm cần đặt hàng</p>
                    </div>
                </div>
                <button
                    onClick={loadLowStockProducts}
                    className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
                    title="Làm mới"
                >
                    <RefreshCw className="w-4 h-4 text-gray-500" />
                </button>
            </div>

            {/* Content */}
            <div className="p-2">
                {products.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                        <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">Tất cả sản phẩm đủ tồn kho</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {products.map((product) => (
                            <div
                                key={product.id}
                                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {product.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        SKU: {product.sku || 'N/A'}
                                    </p>
                                </div>
                                <div className="text-right ml-2">
                                    <span className={`text-sm font-semibold ${product.current_stock <= 0
                                            ? 'text-red-600'
                                            : product.current_stock <= product.min_stock / 2
                                                ? 'text-orange-600'
                                                : 'text-yellow-600'
                                        }`}>
                                        {product.current_stock}
                                    </span>
                                    <span className="text-xs text-gray-400"> / {product.min_stock}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            {products.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                    <button
                        onClick={() => navigate('/de-xuat-dat-hang')}
                        className="w-full flex items-center justify-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"
                    >
                        Xem đề xuất đặt hàng
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
