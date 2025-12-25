// =============================================================================
// BARCODE PRINTING PAGE - Enhanced with dimension controls and settings
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProductStore } from '@/stores/productStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useOrderStore } from '@/stores/orderStore';
import { BarcodeLabelTemplate, generateBarcodeLabelHTML, type LabelItem } from '@/components/print/templates/BarcodeLabelTemplate';
import { generateShippingLabelHTML } from '@/utils/shippingLabelGenerator';
import { ShippingLabelTemplate, DEFAULT_SHIPPING_LABEL_CONFIG, type CarrierType, type ShippingLabelConfig } from '@/components/print/ShippingLabelTemplate';
import { formatVND } from '@/lib/cashReconciliation';
import { printViaDriver } from '@/lib/printService';
import { cn } from '@/lib/utils';
import type { Product, Order } from '@/types';

export function BarcodePrintPage() {
    const [searchParams] = useSearchParams();
    const { products, loadProducts } = useProductStore();
    const { labelConfig, labelConfigs, updateLabelConfig, updateLabelConfigByLayout, printSettings } = useSettingsStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [printQueue, setPrintQueue] = useState<LabelItem[]>([]);
    const [showSearch, setShowSearch] = useState(false);
    const [showZoom, setShowZoom] = useState(false);
    const [activeTab, setActiveTab] = useState<'barcode' | 'shipping'>('barcode');

    // Shipping label state
    const { orders, loadOrders } = useOrderStore();
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [shippingConfig, setShippingConfig] = useState<ShippingLabelConfig>(DEFAULT_SHIPPING_LABEL_CONFIG);
    const [shippingSearch, setShippingSearch] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);

    // Get current layout type from labelConfig.cols
    const getLayoutType = (): 'single' | 'double' | 'triple' => {
        const cols = labelConfig.cols;
        if (cols === 1) return 'single';
        if (cols === 2) return 'double';
        return 'triple';
    };

    // Get active config based on current layout
    const getActiveConfig = () => {
        const layout = getLayoutType();
        return labelConfigs?.[layout] || labelConfig;
    };

    // Switch to a layout and load its config  
    const switchLayout = (cols: 1 | 2 | 3) => {
        const layout = cols === 1 ? 'single' : cols === 2 ? 'double' : 'triple';
        const config = labelConfigs?.[layout] || labelConfig;
        updateLabelConfig({ ...config, cols });
    };

    // Load products from URL params (for bulk print from Products page)
    // or from sessionStorage (for quick print from POS)
    useEffect(() => {
        loadProducts();
        loadOrders(); // Also load orders for shipping labels
        // Check sessionStorage first (from POS quick print)
        const quickPrintData = sessionStorage.getItem('quick_print_label');
        if (quickPrintData) {
            try {
                const data = JSON.parse(quickPrintData);
                setPrintQueue([{
                    id: data.id,
                    name: data.name,
                    barcode: data.barcode || '',
                    price: data.price || 0,
                    quantity: data.quantity || 1,
                }]);
                sessionStorage.removeItem('quick_print_label');
                return;
            } catch (e) {
                console.error('Error parsing quick_print_label:', e);
                sessionStorage.removeItem('quick_print_label');
            }
        }
    }, [loadProducts, loadOrders]);

    // Get sender info from store settings
    const senderInfo = {
        name: printSettings?.storeName || 'Cửa hàng',
        phone: '0123456789',
        address: 'Địa chỉ cửa hàng'
    };

    // Get selected order
    const selectedOrder = orders.find(o => o.id === selectedOrderId);

    // Filter orders for shipping search
    const filteredOrders = orders.filter(o =>
        o.order_number.toLowerCase().includes(shippingSearch.toLowerCase()) ||
        o.customer?.name?.toLowerCase().includes(shippingSearch.toLowerCase()) ||
        o.customer?.phone?.includes(shippingSearch)
    ).slice(0, 20); // Limit to 20 results

    // Load products from URL on mount
    useEffect(() => {
        const productIds = searchParams.get('products');
        if (productIds && products.length > 0) {
            const ids = productIds.split(',');
            const items: LabelItem[] = [];
            ids.forEach(id => {
                const product = products.find(p => p.id === id);
                if (product) {
                    items.push({
                        id: product.id,
                        name: product.name,
                        barcode: product.barcode || product.sku || '',
                        price: product.selling_price || 0,
                        quantity: 1,
                    });
                }
            });
            if (items.length > 0) {
                setPrintQueue(items);
            }
        }
    }, [searchParams, products]);

    const filteredProducts = products.filter((p) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(query) ||
            p.sku?.toLowerCase().includes(query) ||
            p.barcode?.includes(searchQuery);
    }).slice(0, 10);

    const addToQueue = (product: Product) => {
        const existing = printQueue.find((q) => q.id === product.id);
        if (existing) {
            setPrintQueue(printQueue.map((q) =>
                q.id === product.id
                    ? { ...q, quantity: q.quantity + 1 }
                    : q
            ));
        } else {
            setPrintQueue([...printQueue, {
                id: product.id,
                name: product.name,
                barcode: product.barcode || product.sku || '',
                price: product.selling_price || 0,
                quantity: 1,
            }]);
        }
        setSearchQuery('');
        setShowSearch(false);
    };

    const updateQuantity = (id: string, quantity: number) => {
        if (quantity <= 0) {
            setPrintQueue(printQueue.filter((q) => q.id !== id));
        } else {
            setPrintQueue(printQueue.map((q) =>
                q.id === id ? { ...q, quantity } : q
            ));
        }
    };

    const handlePrint = () => {
        if (printQueue.length === 0) {
            alert('Vui lòng thêm sản phẩm cần in tem!');
            return;
        }
        const html = generateBarcodeLabelHTML(
            printQueue,
            labelConfig,
            printSettings.storeName || 'Cửa hàng'
        );
        printViaDriver(html);
    };

    const handleSaveSettings = () => {
        const layout = getLayoutType();
        updateLabelConfigByLayout(layout, labelConfig);
        alert(`✅ Đã lưu cài đặt cho ${layout === 'single' ? '1 tem/hàng' : layout === 'double' ? '2 tem/hàng' : '3 tem/hàng'}!`);
    };

    const totalLabels = printQueue.reduce((sum, q) => sum + q.quantity, 0);

    // Quick col presets
    const colPresets = [
        { cols: 1 as const, label: '1 Tem/Hàng' },
        { cols: 2 as const, label: '2 Tem/Hàng' },
        { cols: 3 as const, label: '3 Tem/Hàng' },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200">
                <div className="container-app py-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">🏷️ In Tem Mã Vạch</h1>
                            <p className="text-sm text-gray-500">
                                Cấu hình và in tem mã vạch cho sản phẩm
                            </p>
                        </div>
                        <button
                            onClick={handlePrint}
                            disabled={printQueue.length === 0}
                            className={cn(
                                'px-6 py-2 rounded-lg font-medium text-white',
                                'bg-gradient-to-r from-orange-500 to-orange-600',
                                'disabled:opacity-50'
                            )}
                        >
                            🖨️ In {totalLabels} Tem Mã Vạch
                        </button>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="bg-white border-b">
                <div className="container-app">
                    <div className="flex gap-1">
                        <button
                            onClick={() => setActiveTab('barcode')}
                            className={cn(
                                'px-6 py-3 font-medium text-sm border-b-2 transition-colors',
                                activeTab === 'barcode'
                                    ? 'border-orange-500 text-orange-600 bg-orange-50'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            )}
                        >
                            🏷️ Tem mã vạch
                        </button>
                        <button
                            onClick={() => setActiveTab('shipping')}
                            className={cn(
                                'px-6 py-3 font-medium text-sm border-b-2 transition-colors',
                                activeTab === 'shipping'
                                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            )}
                        >
                            📦 Vận đơn / Shipping
                        </button>
                    </div>
                </div>
            </div>

            {/* BARCODE LABELS TAB */}
            {activeTab === 'barcode' && (
                <div className="container-app py-6">
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* LEFT: Settings Panel */}
                        <div className="lg:col-span-2 space-y-4">
                            {/* Layout Settings */}
                            <div className="bg-white rounded-xl border p-4">
                                <h3 className="font-semibold text-gray-900 mb-3">📐 BỐ CỤC & KÍCH THƯỚC</h3>

                                {/* Column Presets - Visual Cards */}
                                <div className="grid grid-cols-3 gap-3 mb-5">
                                    {colPresets.map((preset) => {
                                        const isActive = labelConfig.cols === preset.cols;
                                        return (
                                            <button
                                                key={preset.cols}
                                                onClick={() => switchLayout(preset.cols)}
                                                className={cn(
                                                    'flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all',
                                                    isActive
                                                        ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm'
                                                        : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:bg-orange-50/30'
                                                )}
                                            >
                                                <div className="flex gap-1 mb-2">
                                                    {Array.from({ length: preset.cols }).map((_, i) => (
                                                        <div
                                                            key={i}
                                                            className={cn(
                                                                "w-4 h-6 rounded-sm border",
                                                                isActive ? "bg-orange-200 border-orange-400" : "bg-gray-100 border-gray-300"
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                                <span className="font-semibold text-sm">{preset.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">KHỔ GIẤY (MM)</label>
                                        <input
                                            type="number"
                                            value={labelConfig.paperWidth}
                                            onChange={(e) => updateLabelConfig({ paperWidth: Number(e.target.value) })}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">CAO TEM (MM)</label>
                                        <input
                                            type="number"
                                            value={labelConfig.labelHeight}
                                            onChange={(e) => updateLabelConfig({ labelHeight: Number(e.target.value) })}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">CÁCH NGANG (MM)</label>
                                        <input
                                            type="number"
                                            value={labelConfig.colGap}
                                            onChange={(e) => updateLabelConfig({ colGap: Number(e.target.value) })}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">CÁCH DỌC (MM)</label>
                                        <input
                                            type="number"
                                            value={labelConfig.rowGap}
                                            onChange={(e) => updateLabelConfig({ rowGap: Number(e.target.value) })}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Barcode Dimension Controls */}
                            <div className="bg-white rounded-xl border p-4">
                                <h3 className="font-semibold text-gray-900 mb-3">📊 KÍCH THƯỚC MÃ VẠCH</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">CHIỀU RỘNG (MM)</label>
                                        <input
                                            type="number"
                                            value={labelConfig.barcodeWidth || 40}
                                            onChange={(e) => updateLabelConfig({ barcodeWidth: Number(e.target.value) })}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">CHIỀU CAO (MM)</label>
                                        <input
                                            type="number"
                                            value={labelConfig.barcodeHeight || 15}
                                            onChange={(e) => updateLabelConfig({ barcodeHeight: Number(e.target.value) })}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Display Options */}
                            <div className="bg-white rounded-xl border p-4">
                                <h3 className="font-semibold text-gray-900 mb-3">👁️ THÔNG TIN HIỂN THỊ</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={labelConfig.showShopName}
                                            onChange={(e) => updateLabelConfig({ showShopName: e.target.checked })}
                                            className="rounded text-orange-500"
                                        />
                                        <span className="text-sm">Tên Cửa hàng</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={labelConfig.showProductName}
                                            onChange={(e) => updateLabelConfig({ showProductName: e.target.checked })}
                                            className="rounded text-orange-500"
                                        />
                                        <span className="text-sm">Tên Sản phẩm</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={labelConfig.showBarcode}
                                            onChange={(e) => updateLabelConfig({ showBarcode: e.target.checked })}
                                            className="rounded text-orange-500"
                                        />
                                        <span className="text-sm">Mã vạch</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={labelConfig.showPrice}
                                            onChange={(e) => updateLabelConfig({ showPrice: e.target.checked })}
                                            className="rounded text-orange-500"
                                        />
                                        <span className="text-sm">Giá tiền</span>
                                    </label>
                                </div>

                                {/* Font Size Controls */}
                                <div className="mt-4 space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">
                                            CỠ CHỮ SẢN PHẨM ({labelConfig.productFontSize || labelConfig.fontSize}px)
                                        </label>
                                        <input
                                            type="range"
                                            min="6"
                                            max="16"
                                            value={labelConfig.productFontSize || labelConfig.fontSize}
                                            onChange={(e) => updateLabelConfig({ productFontSize: Number(e.target.value) })}
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">
                                            CỠ CHỮ GIÁ ({labelConfig.priceFontSize || 12}px)
                                        </label>
                                        <input
                                            type="range"
                                            min="8"
                                            max="20"
                                            value={labelConfig.priceFontSize || 12}
                                            onChange={(e) => updateLabelConfig({ priceFontSize: Number(e.target.value) })}
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">
                                            CỠ CHỮ CHUNG ({labelConfig.fontSize}px)
                                        </label>
                                        <input
                                            type="range"
                                            min="6"
                                            max="14"
                                            value={labelConfig.fontSize}
                                            onChange={(e) => updateLabelConfig({ fontSize: Number(e.target.value) })}
                                            className="w-full"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={handleSaveSettings}
                                className="w-full py-3 rounded-lg font-medium text-white bg-green-600 hover:bg-green-700"
                            >
                                💾 Lưu Cài Đặt
                            </button>

                            {/* Product List */}
                            <div className="bg-white rounded-xl border p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-semibold text-gray-900">DANH SÁCH SP IN TEM</h3>
                                    <button
                                        onClick={() => {
                                            setShowSearch(true);
                                            setTimeout(() => searchRef.current?.focus(), 100);
                                        }}
                                        className="px-3 py-1.5 text-sm font-medium text-orange-600 hover:bg-orange-50 rounded-lg"
                                    >
                                        + Thêm
                                    </button>
                                </div>

                                {showSearch && (
                                    <div className="mb-4 relative">
                                        <input
                                            ref={searchRef}
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Tìm sản phẩm..."
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                                        />
                                        {searchQuery && filteredProducts.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg z-10 max-h-60 overflow-auto">
                                                {filteredProducts.map((p) => (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => addToQueue(p)}
                                                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                                    >
                                                        <div className="font-medium text-sm">{p.name}</div>
                                                        <div className="text-xs text-gray-500">{p.barcode || p.sku}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {printQueue.length === 0 ? (
                                    <p className="text-gray-400 text-center py-8 text-sm">
                                        Chưa có sản phẩm nào
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {printQueue.map((item) => (
                                            <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm truncate">{item.name}</p>
                                                    <p className="text-xs text-gray-400">{item.barcode}</p>
                                                    <p className="text-xs font-medium text-orange-600">{formatVND(item.price)}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-500">Sl Tem</span>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                                                        className="w-14 px-2 py-1 border rounded text-center text-sm"
                                                    />
                                                    <button
                                                        onClick={() => updateQuantity(item.id, 0)}
                                                        className="text-red-500 hover:bg-red-50 p-1 rounded"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: Preview */}
                        <div className="lg:col-span-1">
                            <div className="bg-slate-600 rounded-xl p-4 sticky top-4">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-medium text-white">👁️ Xem Trước Tem</h3>
                                    <button
                                        onClick={() => setShowZoom(true)}
                                        className="px-2 py-1 text-xs bg-white/20 hover:bg-white/30 text-white rounded"
                                    >
                                        🔍 Phóng to
                                    </button>
                                </div>
                                <div className="bg-white rounded-lg p-4 flex justify-center">
                                    <BarcodeLabelTemplate
                                        items={printQueue.length > 0 ? [printQueue[0]] : [{
                                            id: 'demo',
                                            name: 'Sản phẩm mẫu',
                                            barcode: '8934567890123',
                                            price: 50000,
                                            quantity: 1
                                        }]}
                                        config={labelConfig}
                                        storeName={printSettings.storeName || 'Cửa hàng'}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SHIPPING LABELS TAB */}
            {activeTab === 'shipping' && (
                <div className="container-app py-6">
                    <div className="bg-white rounded-xl border p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">📦 In Vận Đơn / Shipping Labels</h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Order Selection */}
                            <div>
                                <h3 className="font-semibold text-gray-700 mb-3">Chọn đơn hàng để in vận đơn</h3>
                                <div className="mb-3">
                                    <input
                                        type="text"
                                        placeholder="Tìm đơn hàng (mã, tên, SĐT)..."
                                        value={shippingSearch}
                                        onChange={(e) => setShippingSearch(e.target.value)}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                                    {filteredOrders.length > 0 ? (
                                        filteredOrders.map((order) => (
                                            <div
                                                key={order.id}
                                                onClick={() => setSelectedOrderId(order.id)}
                                                className={cn(
                                                    "p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors",
                                                    selectedOrderId === order.id && "bg-blue-50 border-blue-200"
                                                )}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="font-semibold text-sm">{order.order_number}</span>
                                                    <span className="text-xs text-gray-500">
                                                        {new Date(order.created_at).toLocaleDateString('vi-VN')}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-600">{order.customer?.name || 'Khách lẻ'}</div>
                                                <div className="text-xs text-gray-400">{order.customer?.phone || 'Không có SĐT'}</div>
                                                <div className="text-sm font-bold text-green-600 mt-1">{formatVND(order.total_amount || 0)}</div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center text-gray-400">
                                            <div className="text-3xl mb-2">📋</div>
                                            <p>Không tìm thấy đơn hàng</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Label Preview */}
                            <div>
                                <h3 className="font-semibold text-gray-700 mb-3">Xem trước nhãn vận chuyển</h3>
                                {selectedOrder ? (
                                    <div className="flex flex-col items-center">
                                        <ShippingLabelTemplate
                                            data={{
                                                order: selectedOrder,
                                                trackingNumber: `${shippingConfig.carrier}-${selectedOrder.order_number}`,
                                                weight: 500,
                                                carrier: shippingConfig.carrier,
                                                senderInfo
                                            }}
                                            config={shippingConfig}
                                        />
                                        <button
                                            onClick={() => {
                                                const html = generateShippingLabelHTML(
                                                    {
                                                        order: selectedOrder,
                                                        trackingNumber: `${shippingConfig.carrier}-${selectedOrder.order_number}`,
                                                        weight: 500, // Should be calculated from items in real app
                                                        carrier: shippingConfig.carrier,
                                                        senderInfo
                                                    },
                                                    shippingConfig
                                                );
                                                printViaDriver(html);
                                            }}
                                            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2"
                                        >
                                            🖨️ In Vận Đơn
                                        </button>
                                    </div>
                                ) : (
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 bg-gray-50 text-center">
                                        <div className="text-4xl mb-2">📋</div>
                                        <p className="text-gray-500 text-sm">Chọn đơn hàng để xem trước</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Settings */}
                        <div className="mt-6 pt-6 border-t">
                            <h3 className="font-semibold text-gray-700 mb-4">⚙️ Cài đặt nhãn vận chuyển</h3>

                            {/* Carrier Selection */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-600 mb-2">Đơn vị vận chuyển</label>
                                <div className="flex gap-2 flex-wrap">
                                    {(['GHN', 'GHTK', 'VNPost', 'generic'] as CarrierType[]).map((carrier) => (
                                        <button
                                            key={carrier}
                                            onClick={() => setShippingConfig({ ...shippingConfig, carrier })}
                                            className={cn(
                                                "px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                                                shippingConfig.carrier === carrier
                                                    ? "bg-blue-600 text-white border-blue-600"
                                                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                            )}
                                        >
                                            {carrier === 'generic' ? 'Khác' : carrier}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Toggle Options */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={shippingConfig.showSender}
                                        onChange={(e) => setShippingConfig({ ...shippingConfig, showSender: e.target.checked })}
                                        className="w-4 h-4 accent-blue-500"
                                    />
                                    Người gửi
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={shippingConfig.showReceiver}
                                        onChange={(e) => setShippingConfig({ ...shippingConfig, showReceiver: e.target.checked })}
                                        className="w-4 h-4 accent-blue-500"
                                    />
                                    Người nhận
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={shippingConfig.showItems}
                                        onChange={(e) => setShippingConfig({ ...shippingConfig, showItems: e.target.checked })}
                                        className="w-4 h-4 accent-blue-500"
                                    />
                                    Danh sách SP
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={shippingConfig.showCOD}
                                        onChange={(e) => setShippingConfig({ ...shippingConfig, showCOD: e.target.checked })}
                                        className="w-4 h-4 accent-blue-500"
                                    />
                                    Tiền COD
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={shippingConfig.showWeight}
                                        onChange={(e) => setShippingConfig({ ...shippingConfig, showWeight: e.target.checked })}
                                        className="w-4 h-4 accent-blue-500"
                                    />
                                    Khối lượng
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={shippingConfig.showNote}
                                        onChange={(e) => setShippingConfig({ ...shippingConfig, showNote: e.target.checked })}
                                        className="w-4 h-4 accent-blue-500"
                                    />
                                    Ghi chú
                                </label>
                            </div>

                            {/* Paper Size */}
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-600 mb-2">Kích thước giấy</label>
                                <div className="flex gap-2">
                                    {(['A5', 'A6', '10x15'] as const).map((size) => (
                                        <button
                                            key={size}
                                            onClick={() => setShippingConfig({ ...shippingConfig, paperSize: size })}
                                            className={cn(
                                                "px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                                                shippingConfig.paperSize === size
                                                    ? "bg-green-600 text-white border-green-600"
                                                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                            )}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Zoom Modal */}
            {showZoom && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowZoom(false)}>
                    <div className="bg-white rounded-xl p-8 w-full max-w-[95vw] h-[90vh] overflow-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 flex-shrink-0">
                            <h3 className="text-lg font-bold">🔍 Xem Tem Phóng To</h3>
                            <button onClick={() => setShowZoom(false)} className="text-gray-500 hover:text-gray-800 text-xl">✕</button>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-10 bg-gray-100 rounded-lg overflow-auto">
                            <div className="transform scale-[3.0] origin-center">
                                <BarcodeLabelTemplate
                                    items={printQueue.length > 0 ? [printQueue[0]] : [{ id: 'demo', name: 'Sản phẩm mẫu', barcode: '8934567890123', price: 50000, quantity: 1 }]}
                                    config={labelConfig}
                                    storeName={printSettings.storeName || 'Cửa hàng'}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BarcodePrintPage;
