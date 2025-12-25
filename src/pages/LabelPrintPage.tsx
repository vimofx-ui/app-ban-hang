// =============================================================================
// LABEL PRINT PAGE - Barcode Labels & Shipping Labels
// =============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProductStore } from '@/stores/productStore';
import { BarcodeLabelTemplate, type LabelItem, generateBarcodeLabelHTML } from '@/components/print/templates/BarcodeLabelTemplate';
import { ShippingLabelTemplate, type ShippingLabelData } from '@/components/print/templates/ShippingLabelTemplate';
import { formatVND } from '@/lib/cashReconciliation';
import { printViaDriver } from '@/lib/printService';

type TabMode = 'invoice' | 'barcode' | 'shipping';

export default function LabelPrintPage() {
    const [searchParams] = useSearchParams();
    const [activeMode, setActiveMode] = useState<TabMode>('barcode');
    const [activeTab, setActiveTab] = useState<'template' | 'connection'>('template');

    // Settings
    const { printSettings, labelConfig, shippingLabelConfig, updateLabelConfig, updateShippingLabelConfig } = useSettingsStore();
    const { products } = useProductStore();

    // Items to print - start with empty list
    const [labelItems, setLabelItems] = useState<LabelItem[]>([]);

    const [isPrinting, setIsPrinting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showProductSearch, setShowProductSearch] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    // Load products from URL params (for bulk print from Products page)
    // or from sessionStorage (for quick print from POS)
    useEffect(() => {
        // Check sessionStorage first (from POS quick print)
        const quickPrintData = sessionStorage.getItem('quick_print_label');
        if (quickPrintData) {
            try {
                const data = JSON.parse(quickPrintData);
                setLabelItems([{
                    id: data.id,
                    name: data.name,
                    barcode: data.barcode || '',
                    price: data.price || 0,
                    quantity: data.quantity || 1,
                }]);
                setActiveMode('barcode');
                sessionStorage.removeItem('quick_print_label'); // Clear after using
                return; // Don't process URL params if we have sessionStorage data
            } catch (e) {
                console.error('Error parsing quick_print_label:', e);
                sessionStorage.removeItem('quick_print_label');
            }
        }

        // Check URL params (from Products page bulk action)
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
                setLabelItems(items);
                setActiveMode('barcode'); // Switch to barcode mode
            }
        }
    }, [searchParams, products]);

    // Filter products for search
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);

    // Add product to label list
    const addProductToLabels = (product: typeof products[0]) => {
        const existing = labelItems.find(i => i.id === product.id);
        if (existing) {
            setLabelItems(items => items.map(i =>
                i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
            ));
        } else {
            setLabelItems(items => [...items, {
                id: product.id,
                name: product.name,
                barcode: product.barcode || product.sku || '',
                price: product.selling_price || 0,
                quantity: 1,
            }]);
        }
        setSearchQuery('');
        setShowProductSearch(false);
    };

    // Remove item from list
    const removeItem = (id: string) => {
        setLabelItems(items => items.filter(i => i.id !== id));
    };

    // Update item quantity
    const updateQuantity = (id: string, qty: number) => {
        setLabelItems(items => items.map(i =>
            i.id === id ? { ...i, quantity: Math.max(0, qty) } : i
        ));
    };

    // Handle print via driver
    const handlePrint = async () => {
        if (activeMode === 'barcode') {
            if (labelItems.length === 0) {
                alert('Vui lòng thêm sản phẩm cần in tem!');
                return;
            }
            setIsPrinting(true);
            try {
                // Generate HTML and print via driver (iframe method)
                const html = generateBarcodeLabelHTML(
                    labelItems,
                    labelConfig,
                    printSettings.storeName || 'Cửa hàng'
                );
                printViaDriver(html);
            } catch (error) {
                console.error('Print error:', error);
                alert('Lỗi in ấn: ' + (error as Error).message);
            } finally {
                setIsPrinting(false);
            }
        } else {
            // For invoice and shipping modes, use window.print for now
            window.print();
        }
    };

    // Total labels to print
    const totalLabels = labelItems.reduce((sum, item) => sum + item.quantity, 0);

    // Tab button style helper
    const getTabClass = (mode: TabMode) => {
        const baseClass = "flex-1 py-2.5 rounded-lg flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all";
        if (activeMode === mode) {
            if (mode === 'invoice') return `${baseClass} bg-blue-600 text-white shadow`;
            if (mode === 'barcode') return `${baseClass} bg-orange-600 text-white shadow`;
            if (mode === 'shipping') return `${baseClass} bg-green-600 text-white shadow`;
        }
        return `${baseClass} text-slate-400 hover:text-white hover:bg-slate-700`;
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row print:block print:bg-white">

            {/* SIDEBAR - Settings */}
            <div className="w-full md:w-[420px] bg-white shadow-xl z-20 overflow-y-auto h-screen print:hidden flex flex-col border-r border-gray-200">

                {/* Mode Switcher */}
                <div className="p-4 bg-slate-900 text-white border-b border-slate-700 sticky top-0 z-20">
                    <div className="flex bg-slate-800 p-1 rounded-lg gap-1">
                        <button onClick={() => setActiveMode('invoice')} className={getTabClass('invoice')}>
                            📄 Hóa Đơn
                        </button>
                        <button onClick={() => setActiveMode('barcode')} className={getTabClass('barcode')}>
                            🏷️ Tem Mã Vạch
                        </button>
                        <button onClick={() => setActiveMode('shipping')} className={getTabClass('shipping')}>
                            🚚 Vận Đơn
                        </button>
                    </div>
                </div>

                {/* Tabs Header */}
                <div className="flex border-b border-gray-200 bg-white z-10">
                    <button
                        onClick={() => setActiveTab('template')}
                        className={`flex-1 py-3 font-medium border-b-2 ${activeTab === 'template' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
                    >
                        Mẫu In
                    </button>
                    <button
                        onClick={() => setActiveTab('connection')}
                        className={`flex-1 py-3 font-medium border-b-2 ${activeTab === 'connection' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
                    >
                        Kết nối
                    </button>
                </div>

                {/* Template Tab Content */}
                {activeTab === 'template' && (
                    <div className="p-5 space-y-6 flex-1 overflow-auto">

                        {/* BARCODE MODE */}
                        {activeMode === 'barcode' && (
                            <>
                                {/* Layout & Size */}
                                <section className="bg-orange-50 p-4 rounded-lg border border-orange-100 space-y-4">
                                    <h3 className="text-xs font-bold text-orange-800 uppercase tracking-wider flex items-center gap-2">
                                        📐 Bố cục & Kích thước
                                    </h3>

                                    {/* Columns */}
                                    <div className="grid grid-cols-3 gap-2">
                                        {[1, 2, 3].map(col => (
                                            <button
                                                key={col}
                                                onClick={() => updateLabelConfig({ cols: col as 1 | 2 | 3 })}
                                                className={`p-2 rounded border text-xs flex flex-col items-center gap-1 ${labelConfig.cols === col
                                                    ? 'bg-white border-orange-500 text-orange-700 shadow'
                                                    : 'border-orange-200 text-gray-500 hover:bg-orange-100'
                                                    }`}
                                            >
                                                <span className="text-lg">{'▢'.repeat(col)}</span>
                                                {col} Tem/Hàng
                                            </button>
                                        ))}
                                    </div>

                                    {/* Size inputs */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Khổ Giấy (mm)</label>
                                            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded px-2">
                                                <span className="text-gray-400">↔</span>
                                                <input
                                                    type="number"
                                                    value={labelConfig.paperWidth}
                                                    onChange={(e) => updateLabelConfig({ paperWidth: Number(e.target.value) })}
                                                    className="w-full text-xs py-2 outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Cao Tem (mm)</label>
                                            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded px-2">
                                                <span className="text-gray-400">↕</span>
                                                <input
                                                    type="number"
                                                    value={labelConfig.labelHeight}
                                                    onChange={(e) => updateLabelConfig({ labelHeight: Number(e.target.value) })}
                                                    className="w-full text-xs py-2 outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Cách Ngang (mm)</label>
                                            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded px-2">
                                                <span className="text-gray-400">↔</span>
                                                <input
                                                    type="number"
                                                    value={labelConfig.colGap}
                                                    onChange={(e) => updateLabelConfig({ colGap: Number(e.target.value) })}
                                                    className="w-full text-xs py-2 outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Cách Dọc (mm)</label>
                                            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded px-2">
                                                <span className="text-gray-400">↕</span>
                                                <input
                                                    type="number"
                                                    value={labelConfig.rowGap}
                                                    onChange={(e) => updateLabelConfig({ rowGap: Number(e.target.value) })}
                                                    className="w-full text-xs py-2 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Display Options */}
                                <section className="space-y-4">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Thông tin hiển thị</h3>

                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={labelConfig.showShopName}
                                                onChange={(e) => updateLabelConfig({ showShopName: e.target.checked })}
                                                className="rounded text-orange-600"
                                            />
                                            Tên Cửa hàng
                                        </label>
                                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={labelConfig.showProductName}
                                                onChange={(e) => updateLabelConfig({ showProductName: e.target.checked })}
                                                className="rounded text-orange-600"
                                            />
                                            Tên Sản phẩm
                                        </label>
                                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={labelConfig.showBarcode}
                                                onChange={(e) => updateLabelConfig({ showBarcode: e.target.checked })}
                                                className="rounded text-orange-600"
                                            />
                                            Mã vạch
                                        </label>
                                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={labelConfig.showPrice}
                                                onChange={(e) => updateLabelConfig({ showPrice: e.target.checked })}
                                                className="rounded text-orange-600"
                                            />
                                            Giá tiền
                                        </label>
                                    </div>

                                    {/* Font Size */}
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Cỡ chữ (px)</label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400">T</span>
                                            <input
                                                type="range"
                                                min="8"
                                                max="16"
                                                value={labelConfig.fontSize}
                                                onChange={(e) => updateLabelConfig({ fontSize: Number(e.target.value) })}
                                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                                            />
                                            <span className="text-xs w-6 text-right">{labelConfig.fontSize}</span>
                                        </div>
                                    </div>
                                </section>

                                {/* Product List */}
                                <section className="border-t pt-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            Danh sách SP in tem
                                        </h3>
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowProductSearch(!showProductSearch)}
                                                className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-100 transition-colors"
                                            >
                                                ➕ Thêm
                                            </button>
                                        </div>
                                    </div>

                                    {/* Product Search */}
                                    {showProductSearch && (
                                        <div className="mb-3 border rounded-lg overflow-hidden bg-white shadow-lg">
                                            <input
                                                ref={searchRef}
                                                type="text"
                                                placeholder="Tìm sản phẩm theo tên, mã..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full px-3 py-2 text-sm border-b outline-none"
                                                autoFocus
                                            />
                                            <div className="max-h-[200px] overflow-auto">
                                                {filteredProducts.map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => addProductToLabels(p)}
                                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs flex justify-between items-center border-b last:border-b-0"
                                                    >
                                                        <div>
                                                            <div className="font-medium">{p.name}</div>
                                                            <div className="text-gray-500">{p.barcode || p.sku}</div>
                                                        </div>
                                                        <span className="text-orange-600 font-bold">{formatVND(p.selling_price || 0)}</span>
                                                    </button>
                                                ))}
                                                {filteredProducts.length === 0 && (
                                                    <div className="px-3 py-4 text-center text-gray-400 text-sm">
                                                        Không tìm thấy sản phẩm
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Items List */}
                                    <div className="space-y-2 max-h-[250px] overflow-auto pr-1">
                                        {labelItems.map((item) => (
                                            <div key={item.id} className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 flex items-center gap-2 text-xs">
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold truncate">{item.name}</div>
                                                    <div className="flex gap-2 text-gray-500 mt-0.5">
                                                        <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-mono">{item.barcode}</span>
                                                        <span className="text-orange-600 font-bold">{formatVND(item.price)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center gap-1 border-l pl-2">
                                                    <label className="text-[9px] text-gray-400">SL Tem</label>
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                                                        className="w-12 text-center border-orange-300 border rounded font-bold py-0.5"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    className="text-red-400 hover:text-red-600 p-1"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        ))}

                                        {labelItems.length === 0 && (
                                            <div className="text-center py-8 text-gray-400 text-sm">
                                                Chưa có sản phẩm nào.<br />Nhấn "Thêm" để chọn sản phẩm.
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </>
                        )}

                        {/* INVOICE MODE */}
                        {activeMode === 'invoice' && (
                            <div className="text-center py-12">
                                <p className="text-gray-500 mb-4">Cấu hình hóa đơn trong</p>
                                <a
                                    href="/settings"
                                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                                >
                                    ⚙️ Cài đặt → In ấn
                                </a>
                            </div>
                        )}

                        {/* SHIPPING MODE */}
                        {activeMode === 'shipping' && (
                            <section className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Cấu hình Vận đơn</h3>

                                {/* Paper Size */}
                                <div className="grid grid-cols-3 gap-2">
                                    {(['100x150', '75x100', '50x50'] as const).map(size => (
                                        <button
                                            key={size}
                                            onClick={() => updateShippingLabelConfig({ paperSize: size })}
                                            className={`p-2 rounded border text-xs font-bold ${shippingLabelConfig.paperSize === size
                                                ? 'bg-white border-green-600 text-green-700 shadow'
                                                : 'border-green-200 text-gray-500 hover:bg-green-50'
                                                }`}
                                        >
                                            {size === '100x150' ? 'A6 (100x150)' : size === '75x100' ? 'A7 (75x100)' : 'Vuông (50x50)'}
                                        </button>
                                    ))}
                                </div>

                                {/* Display Options */}
                                <div className="space-y-2">
                                    {[
                                        { key: 'showSender', label: 'Hiển thị người gửi' },
                                        { key: 'showRecipient', label: 'Hiển thị người nhận' },
                                        { key: 'showItems', label: 'Hiển thị danh sách hàng' },
                                        { key: 'showCod', label: 'Hiển thị tiền COD' },
                                        { key: 'showNote', label: 'Hiển thị ghi chú' },
                                        { key: 'showOrderBarcode', label: 'Hiển thị mã vạch đơn' },
                                        { key: 'showLogo', label: 'Hiển thị logo' },
                                    ].map(opt => (
                                        <label key={opt.key} className="flex items-center gap-2 text-xs cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={shippingLabelConfig[opt.key as keyof typeof shippingLabelConfig] as boolean}
                                                onChange={(e) => updateShippingLabelConfig({ [opt.key]: e.target.checked })}
                                                className="rounded text-green-600"
                                            />
                                            {opt.label}
                                        </label>
                                    ))}
                                </div>

                                {/* Custom Note */}
                                {shippingLabelConfig.showNote && (
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Ghi chú mặc định</label>
                                        <input
                                            type="text"
                                            value={shippingLabelConfig.customNote}
                                            onChange={(e) => updateShippingLabelConfig({ customNote: e.target.value })}
                                            className="w-full border rounded px-3 py-2 text-sm"
                                            placeholder="VD: Cho xem hàng - Không thử"
                                        />
                                    </div>
                                )}

                                <div className="text-center py-4 text-gray-400 text-sm">
                                    Vận đơn được tạo tự động từ đơn hàng.<br />
                                    Vào <b>Đơn hàng</b> để in vận đơn.
                                </div>
                            </section>
                        )}
                    </div>
                )}

                {/* Connection Tab */}
                {activeTab === 'connection' && (
                    <div className="p-5 text-center py-12">
                        <p className="text-gray-500 mb-4">Cấu hình máy in trong</p>
                        <a
                            href="/settings"
                            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                        >
                            ⚙️ Cài đặt → In ấn
                        </a>
                    </div>
                )}

                {/* Print Button */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 sticky bottom-0">
                    <button
                        onClick={handlePrint}
                        disabled={isPrinting || (activeMode === 'barcode' && labelItems.length === 0)}
                        className={`w-full text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 shadow transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed ${activeMode === 'invoice' ? 'bg-blue-600 hover:bg-blue-700' :
                            activeMode === 'barcode' ? 'bg-orange-600 hover:bg-orange-700' :
                                'bg-green-600 hover:bg-green-700'
                            }`}
                    >
                        🖨️ {isPrinting ? 'Đang in...' :
                            activeMode === 'invoice' ? 'In Hóa Đơn' :
                                activeMode === 'barcode' ? `In ${totalLabels} Tem Mã Vạch` :
                                    'In Vận Đơn'}
                    </button>
                </div>
            </div>

            {/* PREVIEW AREA */}
            <div className="flex-1 bg-slate-500 p-8 overflow-auto flex justify-center items-start print:p-0 print:bg-white print:block">
                <div className="print-area bg-white shadow-2xl transition-all duration-300 print:shadow-none">
                    {activeMode === 'barcode' && (
                        <BarcodeLabelTemplate
                            items={labelItems}
                            config={labelConfig}
                            storeName={printSettings.storeName}
                        />
                    )}

                    {activeMode === 'invoice' && (
                        <div className="w-[80mm] min-h-[300px] p-4 text-center text-gray-400">
                            <p className="text-lg">📄</p>
                            <p>Xem trước hóa đơn</p>
                            <p className="text-xs mt-2">Vào Cài đặt → In ấn để cấu hình</p>
                        </div>
                    )}

                    {activeMode === 'shipping' && (
                        <ShippingLabelTemplate
                            data={{
                                orderId: 'demo-001',
                                orderCode: 'DH240001',
                                senderName: printSettings.storeName || 'Cửa hàng',
                                senderPhone: printSettings.storePhone || '0901234567',
                                senderAddress: printSettings.storeAddress || '123 Đường ABC',
                                recipientName: 'Nguyễn Văn A',
                                recipientPhone: '0987654321',
                                recipientAddress: '456 Đường XYZ, Phường 1',
                                recipientDistrict: 'Quận 1',
                                recipientProvince: 'TP.HCM',
                                items: [
                                    { name: 'Dầu gội X-Men', quantity: 2 },
                                    { name: 'Kem đánh răng PS', quantity: 1 },
                                ],
                                totalItems: 3,
                                codAmount: 250000,
                                note: shippingLabelConfig.customNote || 'Cho xem hàng',
                                createdAt: new Date().toISOString(),
                            }}
                            config={shippingLabelConfig}
                            storeName={printSettings.storeName}
                            storeLogo={printSettings.storeLogo}
                        />
                    )}
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    body { background: white; -webkit-print-color-adjust: exact; }
                    .print\\:hidden { display: none !important; }
                    .print\\:block { display: block !important; }
                    .print\\:shadow-none { box-shadow: none !important; }
                    .print-area { width: 100% !important; height: auto !important; margin: 0 !important; box-shadow: none !important; }
                }
            `}</style>
        </div>
    );
}
