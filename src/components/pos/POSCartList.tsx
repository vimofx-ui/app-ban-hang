import type { CartItem } from '@/stores/posStore';
import { getProductEmoji } from '@/lib/posUtils';
import { formatVND } from '@/lib/cashReconciliation';

interface POSCartListProps {
    items: CartItem[];
    onUpdateQuantity: (id: string, quantity: number) => void;
    onRemoveItem: (id: string) => void;
    onUnitChange: (item: CartItem, newUnitName: string) => void;
    onRequestPriceAdjustment: (item: CartItem) => void;
    onRequestEdit: (item: CartItem) => void;
}

export const POSCartList = ({
    items,
    onUpdateQuantity,
    onRemoveItem,
    onUnitChange,
    onRequestPriceAdjustment,
    onRequestEdit
}: POSCartListProps) => {
    return (
        <div className="flex-1 flex flex-col bg-white m-2 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Cart Header */}
            <div className="h-10 border-b border-gray-100 flex items-center px-2 md:px-4 text-[10px] md:text-xs font-semibold text-gray-400 bg-white">
                <span className="w-8 hidden md:block">STT</span>
                <span className="flex-1">Sản phẩm ({items.length})</span>
                <span className="w-20 text-center hidden md:block">ĐVT</span>
                <span className="w-24 text-right">Đơn giá</span>
                <span className="w-24 md:w-32 text-center">Số lượng</span>
                <span className="w-20 md:w-24 text-right hidden sm:block">Thành tiền</span>
                <span className="w-8"></span>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-auto">
                {items.length === 0 ? (
                    <div className="text-center py-16 text-gray-300 select-none">
                        <span className="text-6xl block mb-4 opacity-50">🛒</span>
                        <p className="font-light">Chưa có sản phẩm</p>
                    </div>
                ) : (
                    items.map((item, index) => (
                        <div
                            key={item.id}
                            className="flex items-center px-4 py-2 border-b border-gray-50 hover:bg-green-50/30 transition-colors group relative"
                        >
                            <span className="w-8 text-gray-300 text-sm font-light">{index + 1}</span>
                            <div className="flex-1 flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-xl flex-shrink-0 shadow-sm border border-gray-100">
                                    {getProductEmoji(item.product?.name)}
                                </div>
                                <div className="min-w-0">
                                    {item.notes && <p className="text-[10px] text-amber-600 mb-0.5 font-medium line-clamp-1 bg-amber-50 inline-block px-1 rounded">📝 {item.notes}</p>}
                                    <p className="font-medium text-gray-800 text-sm truncate">{item.product?.name || 'Sản phẩm lỗi'}</p>
                                </div>
                            </div>
                            {/* Unit Selector - Only show dropdown if product has conversion units */}
                            <div className="w-20 text-center hidden md:block" onClick={(e) => e.stopPropagation()}>
                                {item.product?.units && item.product.units.length > 0 ? (
                                    <select
                                        value={item.unitName || item.product?.base_unit || 'Cái'}
                                        onChange={(e) => onUnitChange(item, e.target.value)}
                                        className="w-full bg-transparent text-xs text-center font-medium border-none focus:ring-0 cursor-pointer text-gray-500 hover:text-green-600 py-1"
                                    >
                                        <option value={item.product?.base_unit || 'Cái'}>{item.product?.base_unit || 'Cái'}</option>
                                        {item.product.units.map(unit => (
                                            <option key={unit.id} value={unit.unit_name}>{unit.unit_name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <span className="text-xs text-gray-500">{item.unitName || item.product?.base_unit || 'Cái'}</span>
                                )}
                            </div>
                            {/* Unit Price Click -> Price Adjustment */}
                            <div
                                className="w-24 text-right text-gray-700 font-medium text-sm cursor-pointer hover:bg-gray-100 py-1 rounded transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRequestPriceAdjustment(item);
                                }}
                            >
                                {formatVND(item.unit_price)}
                                {item.discount_amount > 0 && <p className="text-[10px] text-red-400 line-through">-{formatVND(item.discount_amount)}</p>}
                            </div>
                            {/* Quantity Click -> Edit Modal */}
                            <div
                                className="w-24 md:w-32 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-gray-50 rounded p-1"
                                onClick={(e) => {
                                    e.stopPropagation(); // Avoid double trigger if any
                                    onRequestEdit(item);
                                }}
                            >
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUpdateQuantity(item.id, item.quantity - 1); }}
                                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 font-bold text-sm transition-colors flex items-center justify-center"
                                >−</button>
                                <input
                                    type="number"
                                    value={item.quantity}
                                    step="any"
                                    min="0"
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        if (!isNaN(val) && val > 0) {
                                            onUpdateQuantity(item.id, val);
                                        }
                                    }}
                                    onBlur={(e) => {
                                        const val = parseFloat(e.target.value);
                                        if (isNaN(val) || val <= 0) {
                                            onRemoveItem(item.id);
                                        } else {
                                            onUpdateQuantity(item.id, val);
                                        }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-14 h-7 text-center font-bold bg-transparent border-b border-gray-200 focus:border-green-500 focus:outline-none text-sm text-gray-800"
                                />
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUpdateQuantity(item.id, item.quantity + 1); }}
                                    className="w-7 h-7 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-700 font-bold text-sm transition-colors flex items-center justify-center"
                                >+</button>
                            </div>
                            {/* Total Price Click -> Edit Modal */}
                            <span
                                className="w-20 md:w-24 text-right font-bold text-sm hidden sm:block cursor-pointer hover:text-green-600 text-gray-800"
                                onClick={() => onRequestEdit(item)}
                            >
                                {formatVND(item.total_price)}
                            </span>
                            {/* Print Barcode Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // Open new tab to labels page with product pre-selected
                                    const product = item.product;
                                    if (product) {
                                        const labelData = {
                                            id: product.id,
                                            name: product.name,
                                            barcode: product.barcode || product.sku || '',
                                            price: item.unit_price || product.selling_price || 0,
                                            quantity: 1 // Default 1 label per click
                                        };
                                        // Store in sessionStorage and navigate
                                        sessionStorage.setItem('quick_print_label', JSON.stringify(labelData));
                                        window.open('/barcode-print', '_blank');
                                    }
                                }}
                                className="w-8 flex items-center justify-center text-gray-300 hover:text-orange-500 transition-colors"
                                title="In tem mã vạch"
                            >
                                🏷️
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemoveItem(item.id); }}
                                className="w-8 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
