// =============================================================================
// SMART ORDER PAGE - Đề xuất đặt hàng thông minh
// =============================================================================

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Lightbulb, ShoppingCart, RefreshCw, Check, AlertTriangle,
    TrendingUp, Package, ChevronDown, ChevronUp, X
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useBrandStore } from '@/stores/brandStore';
import { useSupplierStore } from '@/stores/supplierStore';
import { usePurchaseOrderStore } from '@/stores/purchaseOrderStore';
import { Loading } from '@/components/common/Loading';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

interface SmartSuggestion {
    product_id: string;
    product_name: string;
    product_sku: string;
    current_stock: number;
    min_stock: number;
    shortage: number;
    suggested_supplier_id: string | null;
    suggested_supplier_name: string | null;
    suggested_price: number;
    avg_daily_sales: number;
    suggested_quantity: number;
    // UI state
    selected?: boolean;
    override_qty?: number;
    override_supplier_id?: string;
}

interface SupplierGroup {
    supplier_id: string;
    supplier_name: string;
    items: SmartSuggestion[];
    total_amount: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SmartOrderPage() {
    const navigate = useNavigate();
    // Use authStore brandId like other pages do (e.g., productStore)
    const authBrandId = useAuthStore(state => state.brandId);
    const currentBrandId = useBrandStore(state => state.currentBrand?.id);
    const brandId = authBrandId || currentBrandId;

    const { suppliers, fetchSuppliers } = useSupplierStore();
    const { createPurchaseOrder } = usePurchaseOrderStore();

    // State - start with false, set to true only when actually loading
    const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());
    const [selectAll, setSelectAll] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);



    // Load data
    useEffect(() => {
        if (brandId && !hasLoaded) {
            loadSuggestions();
            fetchSuppliers();
        }
    }, [brandId, hasLoaded]);

    const loadSuggestions = async () => {
        if (!isSupabaseConfigured() || !brandId) {
            setHasLoaded(true);
            return;
        }

        setIsLoading(true);
        console.log('[SmartOrderPage] Starting loadSuggestions, brandId:', brandId);

        try {
            // Try RPC first, fallback to direct query
            let suggestions: SmartSuggestion[] = [];

            try {
                // Try RPC with timeout
                console.log('[SmartOrderPage] Trying RPC get_products_needing_reorder...');

                const rpcPromise = supabase.rpc('get_products_needing_reorder', {
                    p_brand_id: brandId
                });

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('RPC timeout after 10s')), 10000)
                );

                const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as any;

                if (error) throw error;

                console.log('[SmartOrderPage] RPC success, items:', data?.length || 0);

                suggestions = (data || []).map((item: any) => ({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    product_sku: item.product_sku || '',
                    current_stock: item.current_stock || 0,
                    min_stock: item.min_stock || 0,
                    shortage: item.shortage || 0,
                    suggested_supplier_id: item.suggested_supplier_id,
                    suggested_supplier_name: item.suggested_supplier_name,
                    suggested_price: item.suggested_price || 0,
                    avg_daily_sales: item.avg_daily_sales || 0,
                    suggested_quantity: item.suggested_quantity || 1,
                    selected: false,
                    override_qty: item.suggested_quantity || 1,
                }));
            } catch (rpcError: any) {
                console.warn('[SmartOrderPage] RPC failed, using fallback:', rpcError.message);

                // Fallback: Query products with inventory join
                const { data: products, error: prodError } = await supabase
                    .from('products')
                    .select(`
                        id,
                        name,
                        sku,
                        min_stock,
                        cost_price,
                        inventory:inventories(quantity, branch_id, min_stock)
                    `)
                    .eq('brand_id', brandId)
                    .eq('is_active', true)
                    .order('name');

                if (prodError) throw prodError;

                console.log('[SmartOrderPage] Fallback query done, products:', products?.length || 0);

                // Map and filter products where current_stock <= min_stock
                const mappedProducts = (products || []).map((p: any) => {
                    const inv = Array.isArray(p.inventory) ? p.inventory[0] : p.inventory;
                    const currentStock = inv?.quantity ?? 0;
                    const minStock = inv?.min_stock ?? p.min_stock ?? 0;
                    return { ...p, current_stock: currentStock, min_stock: minStock };
                });

                // Filter: only products needing reorder (stock <= min_stock AND min_stock > 0)
                const filtered = mappedProducts.filter((p: any) =>
                    p.min_stock > 0 && p.current_stock <= p.min_stock
                );

                console.log('[SmartOrderPage] Products needing reorder:', filtered.length);

                suggestions = filtered.map((p: any) => ({
                    product_id: p.id,
                    product_name: p.name,
                    product_sku: p.sku || '',
                    current_stock: p.current_stock,
                    min_stock: p.min_stock,
                    shortage: Math.max(0, p.min_stock - p.current_stock),
                    suggested_supplier_id: null,
                    suggested_supplier_name: null,
                    suggested_price: p.cost_price || 0,
                    avg_daily_sales: 0,
                    suggested_quantity: Math.max(1, p.min_stock - p.current_stock + 5),
                    selected: false,
                    override_qty: Math.max(1, p.min_stock - p.current_stock + 5),
                }));
            }

            setSuggestions(suggestions);
        } catch (err: any) {
            console.error('Error loading suggestions:', err);
            toast.error('Không thể tải đề xuất: ' + err.message);
        } finally {
            setIsLoading(false);
            setHasLoaded(true);
        }
    };

    // Toggle selection
    const toggleSelect = (productId: string) => {
        setSuggestions(prev => prev.map(s =>
            s.product_id === productId ? { ...s, selected: !s.selected } : s
        ));
    };

    // Toggle select all
    const handleSelectAll = () => {
        const newValue = !selectAll;
        setSelectAll(newValue);
        setSuggestions(prev => prev.map(s => ({ ...s, selected: newValue })));
    };

    // Update quantity
    const updateQuantity = (productId: string, qty: number) => {
        if (qty < 1) qty = 1;
        setSuggestions(prev => prev.map(s =>
            s.product_id === productId ? { ...s, override_qty: qty } : s
        ));
    };

    // Update supplier
    const updateSupplier = (productId: string, supplierId: string) => {
        const supplier = suppliers.find(s => s.id === supplierId);
        setSuggestions(prev => prev.map(s =>
            s.product_id === productId ? {
                ...s,
                override_supplier_id: supplierId,
                suggested_supplier_id: supplierId,
                suggested_supplier_name: supplier?.name || null
            } : s
        ));
    };

    // Toggle supplier expand
    const toggleSupplierExpand = (supplierId: string) => {
        setExpandedSuppliers(prev => {
            const next = new Set(prev);
            if (next.has(supplierId)) {
                next.delete(supplierId);
            } else {
                next.add(supplierId);
            }
            return next;
        });
    };

    // Group by supplier
    const supplierGroups = useMemo((): SupplierGroup[] => {
        const selected = suggestions.filter(s => s.selected);
        const groups: Map<string, SupplierGroup> = new Map();

        selected.forEach(item => {
            const supplierId = item.override_supplier_id || item.suggested_supplier_id || 'unknown';
            const supplierName = item.suggested_supplier_name || 'Chưa chọn NCC';

            if (!groups.has(supplierId)) {
                groups.set(supplierId, {
                    supplier_id: supplierId,
                    supplier_name: supplierName,
                    items: [],
                    total_amount: 0
                });
            }

            const group = groups.get(supplierId)!;
            group.items.push(item);
            group.total_amount += (item.override_qty || item.suggested_quantity) * item.suggested_price;
        });

        return Array.from(groups.values());
    }, [suggestions]);

    // Stats
    const stats = useMemo(() => {
        const selected = suggestions.filter(s => s.selected);
        return {
            total: suggestions.length,
            selected: selected.length,
            totalAmount: selected.reduce((sum, s) =>
                sum + (s.override_qty || s.suggested_quantity) * s.suggested_price, 0
            ),
            suppliers: new Set(selected.map(s => s.suggested_supplier_id)).size
        };
    }, [suggestions]);

    // Create POs
    const handleCreatePOs = async () => {
        if (supplierGroups.length === 0) {
            toast.warning('Vui lòng chọn ít nhất 1 sản phẩm');
            return;
        }

        // Check for unknown supplier
        const unknownGroup = supplierGroups.find(g => g.supplier_id === 'unknown');
        if (unknownGroup) {
            toast.error('Có sản phẩm chưa chọn nhà cung cấp');
            return;
        }

        setIsCreating(true);
        try {
            let createdCount = 0;

            for (const group of supplierGroups) {
                const items = group.items.map(item => ({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    sku: item.product_sku,
                    ordered_qty: item.override_qty || item.suggested_quantity,
                    unit_price: item.suggested_price,
                }));

                const result = await createPurchaseOrder(
                    { supplier_id: group.supplier_id, status: 'draft' },
                    items
                );

                if (result) createdCount++;
            }

            toast.success(`Đã tạo ${createdCount} đơn đặt hàng`);

            // Navigate to PO list
            navigate('/nhap-hang');
        } catch (err: any) {
            toast.error('Lỗi tạo đơn: ' + err.message);
        } finally {
            setIsCreating(false);
        }
    };

    // Format helpers
    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

    const formatNumber = (num: number) =>
        new Intl.NumberFormat('vi-VN').format(num);

    // =============================================================================
    // RENDER
    // =============================================================================

    // Show loading while initial fetch or during refresh
    if (isLoading || (brandId && !hasLoaded)) return <Loading />;

    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Lightbulb className="text-yellow-500" />
                            Đề Xuất Đặt Hàng Thông Minh
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Hệ thống tự động phân tích tồn kho và đề xuất sản phẩm cần đặt
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={loadSuggestions}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
                        >
                            <RefreshCw size={18} />
                            <span className="hidden sm:inline">Làm mới</span>
                        </button>
                        <button
                            onClick={handleCreatePOs}
                            disabled={stats.selected === 0 || isCreating}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isCreating ? (
                                <RefreshCw size={18} className="animate-spin" />
                            ) : (
                                <ShoppingCart size={18} />
                            )}
                            Tạo đơn ({stats.selected})
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center gap-2 text-orange-600 mb-1">
                            <AlertTriangle size={18} />
                            <span className="text-sm font-medium">Sắp hết</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center gap-2 text-green-600 mb-1">
                            <Check size={18} />
                            <span className="text-sm font-medium">Đã chọn</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{stats.selected}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                            <Package size={18} />
                            <span className="text-sm font-medium">NCC</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{stats.suppliers}</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl shadow-sm border border-green-200">
                        <div className="flex items-center gap-2 text-green-700 mb-1">
                            <TrendingUp size={18} />
                            <span className="text-sm font-medium">Tổng tiền</span>
                        </div>
                        <div className="text-lg md:text-xl font-bold text-green-700 truncate">
                            {formatCurrency(stats.totalAmount)}
                        </div>
                    </div>
                </div>

                {suggestions.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                        <Package size={48} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">
                            Không có sản phẩm cần đặt
                        </h3>
                        <p className="text-gray-500">
                            Tất cả sản phẩm đều đủ tồn kho hoặc chưa thiết lập ngưỡng min_stock
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Select All */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4 flex items-center justify-between">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectAll}
                                    onChange={handleSelectAll}
                                    className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <span className="font-medium text-gray-700">
                                    Chọn tất cả ({suggestions.length} sản phẩm)
                                </span>
                            </label>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-3">
                            {suggestions.map(item => (
                                <div
                                    key={item.product_id}
                                    className={`bg-white rounded-xl shadow-sm border p-4 ${item.selected ? 'border-green-500 bg-green-50/50' : 'border-gray-200'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={item.selected || false}
                                            onChange={() => toggleSelect(item.product_id)}
                                            className="w-5 h-5 mt-1 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-gray-900 truncate">
                                                {item.product_name}
                                            </div>
                                            {item.product_sku && (
                                                <div className="text-xs text-gray-500">{item.product_sku}</div>
                                            )}
                                            <div className="flex flex-wrap gap-2 mt-2 text-sm">
                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                                                    Tồn: {formatNumber(item.current_stock)}
                                                </span>
                                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">
                                                    Min: {formatNumber(item.min_stock)}
                                                </span>
                                            </div>

                                            {/* Quantity & Supplier */}
                                            <div className="mt-3 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-gray-600 w-16">SL đặt:</span>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.override_qty || item.suggested_quantity}
                                                        onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 1)}
                                                        className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-center"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-gray-600 w-16">NCC:</span>
                                                    <select
                                                        value={item.override_supplier_id || item.suggested_supplier_id || ''}
                                                        onChange={(e) => updateSupplier(item.product_id, e.target.value)}
                                                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                                    >
                                                        <option value="">Chọn NCC</option>
                                                        {suppliers.map(s => (
                                                            <option key={s.id} value={s.id}>{s.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                                                <span className="text-sm text-gray-500">
                                                    Giá: {formatCurrency(item.suggested_price)}
                                                </span>
                                                <span className="font-semibold text-green-600">
                                                    {formatCurrency((item.override_qty || item.suggested_quantity) * item.suggested_price)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="w-12 px-4 py-3"></th>
                                            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Sản phẩm</th>
                                            <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Tồn kho</th>
                                            <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Ngưỡng</th>
                                            <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Bán/ngày</th>
                                            <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600 min-w-[100px]">SL đặt</th>
                                            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 min-w-[200px]">Nhà cung cấp</th>
                                            <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Giá nhập</th>
                                            <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {suggestions.map(item => (
                                            <tr
                                                key={item.product_id}
                                                className={`hover:bg-gray-50 ${item.selected ? 'bg-green-50/50' : ''}`}
                                            >
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.selected || false}
                                                        onChange={() => toggleSelect(item.product_id)}
                                                        className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-gray-900">{item.product_name}</div>
                                                    {item.product_sku && (
                                                        <div className="text-xs text-gray-500">{item.product_sku}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${item.current_stock <= 0
                                                        ? 'bg-red-100 text-red-700'
                                                        : item.current_stock <= item.min_stock
                                                            ? 'bg-yellow-100 text-yellow-700'
                                                            : 'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {formatNumber(item.current_stock)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center text-gray-600">
                                                    {formatNumber(item.min_stock)}
                                                </td>
                                                <td className="px-4 py-3 text-center text-gray-600">
                                                    {item.avg_daily_sales.toFixed(1)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.override_qty || item.suggested_quantity}
                                                        onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 1)}
                                                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-center"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <select
                                                        value={item.override_supplier_id || item.suggested_supplier_id || ''}
                                                        onChange={(e) => updateSupplier(item.product_id, e.target.value)}
                                                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                                    >
                                                        <option value="">Chọn NCC</option>
                                                        {suppliers.map(s => (
                                                            <option key={s.id} value={s.id}>{s.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-600">
                                                    {formatCurrency(item.suggested_price)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-green-600">
                                                    {formatCurrency((item.override_qty || item.suggested_quantity) * item.suggested_price)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Summary by Supplier */}
                        {supplierGroups.length > 0 && (
                            <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-4 bg-gray-50 border-b border-gray-200">
                                    <h3 className="font-semibold text-gray-900">
                                        Tóm tắt đơn hàng theo NCC
                                    </h3>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {supplierGroups.map(group => (
                                        <div key={group.supplier_id}>
                                            <button
                                                onClick={() => toggleSupplierExpand(group.supplier_id)}
                                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Package size={20} className="text-blue-600" />
                                                    <div className="text-left">
                                                        <div className="font-medium text-gray-900">
                                                            {group.supplier_name}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {group.items.length} sản phẩm
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="font-semibold text-green-600">
                                                        {formatCurrency(group.total_amount)}
                                                    </span>
                                                    {expandedSuppliers.has(group.supplier_id) ? (
                                                        <ChevronUp size={20} className="text-gray-400" />
                                                    ) : (
                                                        <ChevronDown size={20} className="text-gray-400" />
                                                    )}
                                                </div>
                                            </button>
                                            {expandedSuppliers.has(group.supplier_id) && (
                                                <div className="px-4 pb-4 bg-gray-50">
                                                    <div className="space-y-2">
                                                        {group.items.map(item => (
                                                            <div
                                                                key={item.product_id}
                                                                className="flex justify-between items-center text-sm py-2 px-3 bg-white rounded-lg"
                                                            >
                                                                <span className="text-gray-700">{item.product_name}</span>
                                                                <div className="flex items-center gap-4">
                                                                    <span className="text-gray-500">
                                                                        x{item.override_qty || item.suggested_quantity}
                                                                    </span>
                                                                    <span className="font-medium text-gray-900">
                                                                        {formatCurrency((item.override_qty || item.suggested_quantity) * item.suggested_price)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
