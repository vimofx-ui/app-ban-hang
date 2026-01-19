// =============================================================================
// IMPORT GOODS PAGE - Nhập hàng trực tiếp từ nhà cung cấp (không qua PO)
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Search, Package, Barcode, CheckCircle, Save, Printer } from 'lucide-react';
import { usePurchaseOrderStore } from '@/stores/purchaseOrderStore';
import { useSupplierStore, type Supplier } from '@/stores/supplierStore';
import { useProductStore } from '@/stores/productStore';
import { useBrandStore } from '@/stores/brandStore';
import { useBranchStore } from '@/stores/branchStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Loading } from '@/components/common/Loading';

interface ImportItem {
    key: string;
    product_id: string;
    product_name: string;
    sku?: string;
    barcode?: string;
    unit: string;
    quantity: number;
    unit_price: number;
    total: number;
    lot_number?: string;
    expiry_date?: string;
}

export function ImportGoodsPage() {
    const navigate = useNavigate();
    const { suppliers, fetchSuppliers } = useSupplierStore();
    const { products, loadProducts } = useProductStore();
    const brandId = useBrandStore(state => state.currentBrand?.id);
    const branchId = useBranchStore(state => state.getCurrentBranch()?.id);

    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [items, setItems] = useState<ImportItem[]>([]);
    const [barcodeInput, setBarcodeInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [notes, setNotes] = useState('');
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const barcodeRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (brandId) {
            fetchSuppliers();
            loadProducts();
        }
    }, [brandId, fetchSuppliers, loadProducts]);

    // Focus on barcode input
    useEffect(() => {
        if (barcodeRef.current) {
            barcodeRef.current.focus();
        }
    }, [items]);

    // Handle barcode scan
    const handleBarcodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!barcodeInput.trim()) return;

        const term = barcodeInput.trim().toLowerCase();

        // 1. Try exact match Barcode or SKU
        const exactMatch = products.find(p =>
            p.barcode === barcodeInput ||
            p.sku === barcodeInput
        );

        if (exactMatch) {
            addProduct(exactMatch);
            setBarcodeInput('');
            return;
        }

        // 2. Try fuzzy search by Name, SKU, Barcode
        const matches = products.filter(p =>
            p.name.toLowerCase().includes(term) ||
            p.sku?.toLowerCase().includes(term) ||
            p.barcode?.includes(term)
        );

        if (matches.length === 1) {
            addProduct(matches[0]);
            setBarcodeInput('');
        } else if (matches.length > 1) {
            // Multiple matches -> Open picker
            setSearchQuery(barcodeInput);
            setShowProductPicker(true);
            setBarcodeInput(''); // Clear main input causing confusion? Maybe keep it? Let's clear it and use searchQuery.
        } else {
            alert(`Không tìm thấy sản phẩm nào khớp với: ${barcodeInput}`);
        }
    };

    const addProduct = (product: any) => {
        const existing = items.find(item => item.product_id === product.id);
        if (existing) {
            setItems(items.map(item =>
                item.product_id === product.id
                    ? {
                        ...item,
                        quantity: item.quantity + 1,
                        total: (item.quantity + 1) * item.unit_price
                    }
                    : item
            ));
        } else {
            const newItem: ImportItem = {
                key: `${product.id}-${Date.now()}`,
                product_id: product.id,
                product_name: product.name,
                sku: product.sku,
                barcode: product.barcode,
                unit: product.unit || 'cái',
                quantity: 1,
                unit_price: product.cost_price || 0,
                total: product.cost_price || 0,
            };
            setItems([...items, newItem]);
        }
    };

    const handleRemoveItem = (key: string) => {
        setItems(items.filter(item => item.key !== key));
    };

    const handleUpdateQuantity = (key: string, qty: number) => {
        if (qty < 1) return;
        setItems(items.map(item =>
            item.key === key ? {
                ...item,
                quantity: qty,
                total: qty * item.unit_price
            } : item
        ));
    };

    const handleUpdatePrice = (key: string, price: number) => {
        setItems(items.map(item =>
            item.key === key ? {
                ...item,
                unit_price: price,
                total: item.quantity * price
            } : item
        ));
    };

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum + item.total, 0);
    };

    const generateReceiptNumber = () => {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `NK-${dateStr}-${random}`;
    };

    // Save import to database
    const handleSaveImport = async (complete: boolean = false) => {
        if (!brandId || !branchId) {
            alert('Vui lòng chọn chi nhánh');
            return;
        }
        if (items.length === 0) {
            alert('Vui lòng thêm sản phẩm');
            return;
        }

        setIsSaving(true);
        try {
            const receiptNumber = generateReceiptNumber();

            // Create goods receipt (direct import, no PO)
            const { data: receipt, error: receiptError } = await supabase
                .from('goods_receipts')
                .insert({
                    brand_id: brandId,
                    branch_id: branchId,
                    supplier_id: selectedSupplierId || null,
                    receipt_number: receiptNumber,
                    status: complete ? 'completed' : 'draft',
                    total_items: items.length,
                    total_amount: calculateTotal(),
                    notes: notes,
                })
                .select()
                .single();

            if (receiptError) throw receiptError;

            // Create receipt items
            const receiptItems = items.map(item => ({
                goods_receipt_id: receipt.id,
                product_id: item.product_id,
                product_name: item.product_name,
                sku: item.sku,
                barcode: item.barcode,
                expected_qty: item.quantity,
                received_qty: item.quantity,
                unit_price: item.unit_price,
                total: item.total,
                lot_number: item.lot_number,
                expiry_date: item.expiry_date,
            }));

            const { error: itemsError } = await supabase
                .from('goods_receipt_items')
                .insert(receiptItems);

            if (itemsError) throw itemsError;

            // If completing, update inventory
            if (complete) {
                for (const item of items) {
                    // Get current inventory
                    const { data: inv } = await supabase
                        .from('branch_inventory')
                        .select('quantity')
                        .eq('branch_id', branchId)
                        .eq('product_id', item.product_id)
                        .single();

                    if (inv) {
                        // Update existing
                        await supabase
                            .from('branch_inventory')
                            .update({
                                quantity: inv.quantity + item.quantity,
                                updated_at: new Date().toISOString()
                            })
                            .eq('branch_id', branchId)
                            .eq('product_id', item.product_id);
                    } else {
                        // Insert new
                        await supabase
                            .from('branch_inventory')
                            .insert({
                                branch_id: branchId,
                                brand_id: brandId,
                                product_id: item.product_id,
                                quantity: item.quantity,
                            });
                    }

                    // Log inventory change
                    await supabase
                        .from('inventory_logs')
                        .insert({
                            branch_id: branchId,
                            brand_id: brandId,
                            product_id: item.product_id,
                            change_type: 'import',
                            quantity_change: item.quantity,
                            reference_type: 'goods_receipt',
                            reference_id: receipt.id,
                            notes: `Nhập kho từ phiếu ${receiptNumber}`,
                        });
                }

                alert('Nhập kho thành công!');
                navigate('/inventory');
            } else {
                alert('Đã lưu phiếu nháp');
                navigate('/dat-hang-ncc');
            }
        } catch (err: any) {
            console.error('Error saving import:', err);
            alert(`Lỗi: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN').format(amount);
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.includes(searchQuery)
    );

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => navigate('/inventory')}
                        className="p-2 hover:bg-gray-200 rounded-lg"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-gray-900">📦 Nhập Hàng</h1>
                        <p className="text-gray-500 text-sm">Nhập hàng từ nhà cung cấp vào kho</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Barcode Scanner */}
                        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Barcode className="text-blue-600" size={20} />
                                <span className="font-medium text-blue-800">Quét Barcode</span>
                            </div>
                            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                                <input
                                    ref={barcodeRef}
                                    type="text"
                                    value={barcodeInput}
                                    onChange={(e) => setBarcodeInput(e.target.value)}
                                    placeholder="Quét mã vạch, SKU hoặc nhập tên sản phẩm..."
                                    className="flex-1 px-4 py-3 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                                >
                                    Thêm
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowProductPicker(true)}
                                    className="px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                                >
                                    <Search size={20} />
                                </button>
                            </form>
                        </div>

                        {/* Supplier Selection */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Nhà cung cấp (tuỳ chọn)</label>
                            <select
                                value={selectedSupplierId}
                                onChange={(e) => setSelectedSupplierId(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                <option value="">-- Không chọn --</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Products List */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="font-semibold text-gray-900">
                                    Sản phẩm nhập ({items.length})
                                </h3>
                            </div>

                            {items.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <Package size={48} className="mx-auto mb-2 opacity-50" />
                                    <p>Quét barcode hoặc tìm sản phẩm để thêm</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {items.map(item => (
                                        <div key={item.key} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-900">{item.product_name}</div>
                                                <div className="text-sm text-gray-500">
                                                    {item.sku && <span className="mr-2">SKU: {item.sku}</span>}
                                                    {item.barcode && <span>Barcode: {item.barcode}</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-center">
                                                    <label className="text-xs text-gray-500 block">SL</label>
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => handleUpdateQuantity(item.key, parseInt(e.target.value) || 0)}
                                                        className="w-20 px-2 py-1 border border-gray-200 rounded text-center"
                                                        min="1"
                                                    />
                                                </div>
                                                <div className="text-center">
                                                    <label className="text-xs text-gray-500 block">Đơn giá</label>
                                                    <input
                                                        type="number"
                                                        value={item.unit_price}
                                                        onChange={(e) => handleUpdatePrice(item.key, parseFloat(e.target.value) || 0)}
                                                        className="w-28 px-2 py-1 border border-gray-200 rounded text-right"
                                                    />
                                                </div>
                                                <div className="w-28 text-right">
                                                    <label className="text-xs text-gray-500 block">Thành tiền</label>
                                                    <div className="font-medium text-gray-900">
                                                        {formatCurrency(item.total)}đ
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveItem(item.key)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Ghi chú</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                placeholder="Ghi chú cho phiếu nhập..."
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        {/* Summary */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-4">
                            <h3 className="font-semibold text-gray-900 mb-4">Tóm tắt</h3>

                            <div className="space-y-3 mb-4">
                                <div className="flex justify-between text-gray-600">
                                    <span>Số mặt hàng</span>
                                    <span className="font-medium">{items.length}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>Tổng số lượng</span>
                                    <span className="font-medium">
                                        {items.reduce((sum, i) => sum + i.quantity, 0)}
                                    </span>
                                </div>
                                <div className="border-t border-gray-200 pt-3">
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold text-gray-900">Tổng tiền</span>
                                        <span className="text-2xl font-bold text-green-600">
                                            {formatCurrency(calculateTotal())}đ
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <button
                                    onClick={() => handleSaveImport(false)}
                                    disabled={isSaving || items.length === 0}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
                                >
                                    <Save size={18} />
                                    Lưu nháp
                                </button>
                                <button
                                    onClick={() => handleSaveImport(true)}
                                    disabled={isSaving || items.length === 0}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                                >
                                    <CheckCircle size={18} />
                                    {isSaving ? 'Đang xử lý...' : 'Hoàn tất nhập kho'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Product Picker Modal */}
                {showProductPicker && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-gray-200">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-gray-900">Chọn sản phẩm</h3>
                                    <button onClick={() => setShowProductPicker(false)} className="text-gray-500 hover:text-gray-700">
                                        ✕
                                    </button>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input
                                        type="text"
                                        placeholder="Tìm sản phẩm..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                <div className="grid grid-cols-1 gap-2">
                                    {filteredProducts.slice(0, 50).map(product => (
                                        <button
                                            key={product.id}
                                            onClick={() => {
                                                addProduct(product);
                                                setShowProductPicker(false);
                                                setSearchQuery('');
                                            }}
                                            className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-green-50 text-left transition-colors"
                                        >
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-900">{product.name}</div>
                                                <div className="text-sm text-gray-500">
                                                    {product.sku && <span className="mr-2">SKU: {product.sku}</span>}
                                                    {product.barcode && <span>Barcode: {product.barcode}</span>}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-medium text-green-600">
                                                    {formatCurrency(product.cost_price || 0)}đ
                                                </div>
                                                <div className="text-xs text-gray-500">Giá nhập</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
