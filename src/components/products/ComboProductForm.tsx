// =============================================================================
// COMBO PRODUCT FORM - Create and Edit Combo Products
// =============================================================================

import { useState, useEffect } from 'react';
import { useProductStore } from '@/stores/productStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { formatVND } from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';
import { QuantityInputStyled } from '@/components/common/QuantityInput';
import { CurrencyInput } from '@/components/common/CurrencyInput';
import type { Product, ComboItem, ProductSearchItem } from '@/types';
import { searchProducts } from '@/lib/productSearch';

interface ComboProductFormProps {
    editingProduct?: Product | null;
    onSave: (data: Partial<Product>) => void;
    onCancel: () => void;
}

export function ComboProductForm({ editingProduct, onSave, onCancel }: ComboProductFormProps) {
    const { products } = useProductStore();
    const { categories, brands } = useCategoryStore();

    // Form state
    const [name, setName] = useState(editingProduct?.name || '');
    const [sku, setSku] = useState(editingProduct?.sku || '');
    const [barcode, setBarcode] = useState(editingProduct?.barcode || '');
    const [baseUnit, setBaseUnit] = useState(editingProduct?.base_unit || 'combo');
    const [categoryId, setCategoryId] = useState(editingProduct?.category_id || '');
    const [brandId, setBrandId] = useState(editingProduct?.brand_id || '');
    const [sellingPrice, setSellingPrice] = useState(editingProduct?.selling_price || 0);
    const [wholesalePrice, setWholesalePrice] = useState(editingProduct?.wholesale_price || 0);
    const [purchasePrice, setPurchasePrice] = useState(editingProduct?.purchase_price || 0);
    const [isActive, setIsActive] = useState(editingProduct?.is_active ?? true);
    const [taxApply, setTaxApply] = useState(editingProduct?.tax_apply ?? false);

    // Combo items state
    const [comboItems, setComboItems] = useState<ComboItem[]>(editingProduct?.combo_items || []);
    const [searchQuery, setSearchQuery] = useState('');
    const [showProductSearch, setShowProductSearch] = useState(false);

    // Available products for combo (exclude combo products and current product)
    const availableProducts = products.filter(p =>
        p.product_kind !== 'combo' &&
        p.id !== editingProduct?.id &&
        p.is_active
    );

    // Search results
    const searchResults = searchQuery.trim()
        ? searchProducts(availableProducts, searchQuery)
        : [];

    // Add product to combo
    const addProductToCombo = (item: ProductSearchItem) => {
        // Use conversion rate as quantity if unit selected
        const quantityToAdd = item.type === 'unit' && item.unit ? item.unit.conversion_rate : 1;

        if (comboItems.find(i => i.product_id === item.product_id)) {
            // Already exists, increase quantity
            setComboItems(items => items.map(i =>
                i.product_id === item.product_id
                    ? { ...i, quantity: i.quantity + quantityToAdd }
                    : i
            ));
        } else {
            // Add new
            setComboItems([...comboItems, {
                product_id: item.product_id,
                product_name: item.product.name,
                quantity: quantityToAdd
            }]);
        }
        setSearchQuery('');
        setShowProductSearch(false);
    };

    // Remove product from combo
    const removeProductFromCombo = (productId: string) => {
        setComboItems(items => items.filter(item => item.product_id !== productId));
    };

    // Update quantity
    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity <= 0) {
            removeProductFromCombo(productId);
            return;
        }
        setComboItems(items => items.map(item =>
            item.product_id === productId ? { ...item, quantity } : item
        ));
    };

    // Calculate totals
    const calculateTotals = () => {
        let totalCost = 0;
        let totalRetail = 0;

        comboItems.forEach(item => {
            const product = products.find(p => p.id === item.product_id);
            if (product) {
                totalCost += (product.cost_price || 0) * item.quantity;
                totalRetail += product.selling_price * item.quantity;
            }
        });

        return { totalCost, totalRetail };
    };

    const { totalCost, totalRetail } = calculateTotals();

    // Handle save
    const handleSave = () => {
        if (!name.trim()) {
            alert('Vui lòng nhập tên combo');
            return;
        }
        if (comboItems.length === 0) {
            alert('Vui lòng thêm ít nhất 1 sản phẩm vào combo');
            return;
        }

        onSave({
            name,
            sku: sku || undefined,
            barcode: barcode || undefined,
            base_unit: baseUnit,
            category_id: categoryId || undefined,
            brand_id: brandId || undefined,
            selling_price: sellingPrice,
            wholesale_price: wholesalePrice || undefined,
            purchase_price: purchasePrice || undefined,
            cost_price: totalCost,
            is_active: isActive,
            tax_apply: taxApply,
            product_kind: 'combo',
            combo_items: comboItems,
            current_stock: 999999, // Combo doesn't track stock directly
            min_stock: 0,
            allow_negative_stock: true
        });
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="container-app py-4 flex items-center justify-between">
                    <button onClick={onCancel} className="text-blue-500 hover:text-blue-600 flex items-center gap-2">
                        ← Quay lại danh sách sản phẩm
                    </button>
                    <div className="flex items-center gap-3">
                        <button onClick={onCancel} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50">
                            Thoát
                        </button>
                        <button className="px-4 py-2 border border-blue-500 text-blue-500 rounded-lg hover:bg-blue-50">
                            Lưu và in mã vạch
                        </button>
                        <button onClick={handleSave} className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium">
                            Lưu
                        </button>
                    </div>
                </div>
            </header>

            <div className="container-app py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Main Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Thông tin chung */}
                        <div className="bg-white rounded-xl border p-6">
                            <h2 className="text-lg font-semibold mb-4">Thông tin chung</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-blue-600 mb-1">Tên combo sản phẩm <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Nhập tên combo sản phẩm"
                                        className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Mã sản phẩm/SKU</label>
                                        <input
                                            type="text"
                                            value={sku}
                                            onChange={(e) => setSku(e.target.value)}
                                            className="w-full px-4 py-2.5 border rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Khối lượng</label>
                                        <div className="flex">
                                            <input type="text" className="flex-1 px-4 py-2.5 border rounded-l-lg" />
                                            <select className="px-3 border-y border-r rounded-r-lg bg-gray-50">
                                                <option>g</option>
                                                <option>kg</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Mã vạch/Barcode</label>
                                        <input
                                            type="text"
                                            value={barcode}
                                            onChange={(e) => setBarcode(e.target.value)}
                                            placeholder="Nhập tay hoặc sử dụng máy để quét mã vạch (3-15 ký tự)"
                                            className="w-full px-4 py-2.5 border rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Đơn vị tính</label>
                                        <input
                                            type="text"
                                            value={baseUnit}
                                            onChange={(e) => setBaseUnit(e.target.value)}
                                            className="w-full px-4 py-2.5 border rounded-lg"
                                        />
                                    </div>
                                </div>

                                <button className="text-blue-500 text-sm hover:underline">
                                    Mô tả sản phẩm
                                </button>
                            </div>
                        </div>

                        {/* Thành phần trong combo */}
                        <div className="bg-white rounded-xl border p-6">
                            <h2 className="text-lg font-semibold mb-2">Thành phần trong combo</h2>
                            <p className="text-sm text-gray-500 mb-4">
                                Bạn có thể chọn các sản phẩm thường, là date làm thành phần trong combo sản phẩm
                            </p>

                            {/* Product Search */}
                            <div className="relative mb-4">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => { setSearchQuery(e.target.value); setShowProductSearch(true); }}
                                    onFocus={() => setShowProductSearch(true)}
                                    placeholder="🔍 Tìm kiếm sản phẩm"
                                    className="w-full px-4 py-2.5 border rounded-lg"
                                />
                                {showProductSearch && searchResults.length > 0 && (
                                    <div className="absolute left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                                        {searchResults.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => addProductToCombo(item)}
                                                className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center justify-between border-b last:border-b-0"
                                            >
                                                <div>
                                                    <div className="font-medium">{item.name}</div>
                                                    <div className="text-sm text-gray-500">
                                                        {item.sku || item.barcode || ''}
                                                        {item.unit_name ? ` • ${item.unit_name}` : ''}
                                                    </div>
                                                </div>
                                                <div className="text-blue-600">{formatVND(item.price)}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Combo Items Table */}
                            {comboItems.length > 0 ? (
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b text-sm text-gray-500">
                                            <th className="py-3 text-left w-12">STT</th>
                                            <th className="py-3 text-left">Phiên bản sản phẩm</th>
                                            <th className="py-3 text-center w-24">Số lượng</th>
                                            <th className="py-3 text-right w-28">Giá bán lẻ</th>
                                            <th className="py-3 text-right w-28">Thành tiền</th>
                                            <th className="py-3 w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {comboItems.map((item, idx) => {
                                            const product = products.find(p => p.id === item.product_id);
                                            const itemTotal = (product?.selling_price || 0) * item.quantity;
                                            return (
                                                <tr key={item.product_id} className="border-b">
                                                    <td className="py-3 text-gray-500">{idx + 1}</td>
                                                    <td className="py-3">
                                                        <div className="font-medium">{item.product_name}</div>
                                                        <div className="text-sm text-gray-500">{product?.sku}</div>
                                                    </td>
                                                    <td className="py-3">
                                                        <QuantityInputStyled
                                                            value={item.quantity}
                                                            onChange={(val) => updateQuantity(item.product_id, val)}
                                                            min={1}
                                                        />
                                                    </td>
                                                    <td className="py-3 text-right">{formatVND(product?.selling_price || 0)}</td>
                                                    <td className="py-3 text-right font-medium">{formatVND(itemTotal)}</td>
                                                    <td className="py-3 text-center">
                                                        <button
                                                            onClick={() => removeProductFromCombo(item.product_id)}
                                                            className="text-red-500 hover:text-red-600"
                                                        >
                                                            ✕
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50">
                                            <td colSpan={4} className="py-3 text-right font-medium">Tổng giá trị combo:</td>
                                            <td className="py-3 text-right font-bold text-blue-600">{formatVND(totalRetail)}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            ) : (
                                <div className="text-center py-12 text-gray-400">
                                    <div className="text-4xl mb-4">📦</div>
                                    <p>Combo chưa có sản phẩm nào</p>
                                    <button
                                        onClick={() => (document.querySelector('input[placeholder*="Tìm kiếm"]') as HTMLInputElement)?.focus()}
                                        className="mt-4 px-4 py-2 border border-blue-500 text-blue-500 rounded-lg hover:bg-blue-50"
                                    >
                                        ➕ Thêm sản phẩm ngay
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Giá sản phẩm */}
                        <div className="bg-white rounded-xl border p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">Giá sản phẩm</h2>
                                <button className="text-blue-500 text-sm hover:underline">
                                    ➕ Thêm chính sách giá
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Giá bán lẻ</label>
                                    <CurrencyInput
                                        value={sellingPrice}
                                        onValueChange={setSellingPrice}
                                        className="w-full px-4 py-2.5 border rounded-lg text-right"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Giá gợi ý từ thành phần: {formatVND(totalRetail)}</p>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Giá bán buôn</label>
                                    <CurrencyInput
                                        value={wholesalePrice}
                                        onValueChange={setWholesalePrice}
                                        className="w-full px-4 py-2.5 border rounded-lg text-right"
                                    />
                                </div>
                            </div>

                            <div className="mt-4">
                                <label className="block text-sm text-gray-600 mb-1">Giá nhập (Giá vốn combo)</label>
                                <CurrencyInput
                                    value={purchasePrice || totalCost}
                                    onValueChange={setPurchasePrice}
                                    className="w-full px-4 py-2.5 border rounded-lg text-right"
                                />
                                <p className="text-xs text-gray-400 mt-1">Giá vốn tính từ thành phần: {formatVND(totalCost)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Classification */}
                    <div className="space-y-6">
                        {/* Phân loại */}
                        <div className="bg-white rounded-xl border p-6">
                            <h2 className="text-lg font-semibold mb-4">Phân loại</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Loại sản phẩm</label>
                                    <select
                                        value={categoryId}
                                        onChange={(e) => setCategoryId(e.target.value)}
                                        className="w-full px-4 py-2.5 border rounded-lg"
                                    >
                                        <option value="">Chọn loại sản phẩm</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Nhãn hiệu</label>
                                    <select
                                        value={brandId}
                                        onChange={(e) => setBrandId(e.target.value)}
                                        className="w-full px-4 py-2.5 border rounded-lg"
                                    >
                                        <option value="">Chọn nhãn hiệu</option>
                                        {brands.map(brand => (
                                            <option key={brand.id} value={brand.id}>{brand.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Tags</label>
                                    <textarea
                                        placeholder="Nhập tag, cách nhau bằng dấu phẩy"
                                        className="w-full px-4 py-2.5 border rounded-lg resize-none"
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Trạng thái */}
                        <div className="bg-white rounded-xl border p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <label className="block text-sm font-medium">Trạng thái</label>
                                    <span className="text-sm text-gray-500">Cho phép bán</span>
                                </div>
                                <button
                                    onClick={() => setIsActive(!isActive)}
                                    className={cn(
                                        "w-12 h-6 rounded-full transition-colors relative",
                                        isActive ? "bg-blue-500" : "bg-gray-300"
                                    )}
                                >
                                    <div className={cn(
                                        "w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow",
                                        isActive ? "right-0.5" : "left-0.5"
                                    )} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t">
                                <div>
                                    <label className="block text-sm font-medium">Thuế</label>
                                    <span className="text-sm text-gray-500">Áp dụng thuế</span>
                                </div>
                                <button
                                    onClick={() => setTaxApply(!taxApply)}
                                    className={cn(
                                        "w-12 h-6 rounded-full transition-colors relative",
                                        taxApply ? "bg-blue-500" : "bg-gray-300"
                                    )}
                                >
                                    <div className={cn(
                                        "w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow",
                                        taxApply ? "right-0.5" : "left-0.5"
                                    )} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
