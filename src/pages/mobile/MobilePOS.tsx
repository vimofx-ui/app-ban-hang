import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MoreVertical, Plus, Minus, X, Gift, User, Tag, Printer, Save, ClipboardList, Clock, ScanBarcode } from 'lucide-react';
import { usePOSStore } from '@/stores/posStore';
import { cn } from '@/lib/utils';
import { formatVND } from '@/lib/cashReconciliation';
import { MobileProductSearch } from '@/components/mobile/MobileProductSearch';
import { MobileCustomerSearch } from '@/components/mobile/MobileCustomerSearch';
import { toast } from 'sonner';
import { BarcodeScannerModal } from '@/components/common/BarcodeScannerModal';
import { BarcodeSelectionModal, findProductsByBarcode, type BarcodeMatch } from '@/components/common/BarcodeSelectionModal';
import { useProductStore } from '@/stores/productStore';
import { POSAudio } from '@/lib/posAudio';
import { MOCK_PRODUCTS } from '@/data/mockProducts';

export function MobilePOS() {
    const navigate = useNavigate();
    const {
        cartItems,
        addItem,
        updateItemQuantity,
        removeItem,
        total,
        clearCart,
        customer,
        setCustomer,
        wholesaleMode,
        toggleWholesaleMode,
        parkOrder,
        submitOrder
    } = usePOSStore();

    const storeProducts = useProductStore((state) => state.products);
    const products = storeProducts.length > 0 ? storeProducts : MOCK_PRODUCTS;

    const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [barcodeMatches, setBarcodeMatches] = useState<BarcodeMatch[]>([]);

    const handleBarcodeScan = (code: string) => {
        // Find all products/units matching this barcode
        const matches = findProductsByBarcode(products, code);

        if (matches.length === 0) {
            POSAudio.playError();
            toast.error(`Mã "${code}" không tồn tại!`);
        } else if (matches.length === 1) {
            const match = matches[0];
            addItem(match.product);
            POSAudio.playAddItem();
            setShowScanner(false);
            toast.success(`Đã thêm: ${match.displayName}`);
        } else {
            // Multiple matches - show selection modal
            setShowScanner(false);
            setBarcodeMatches(matches);
        }
    };

    // Handle selection from BarcodeSelectionModal
    const handleBarcodeSelect = (match: BarcodeMatch) => {
        addItem(match.product);
        POSAudio.playAddItem();
        setBarcodeMatches([]);
        toast.success(`Đã thêm: ${match.displayName}`);
    };

    // Calculate total quantity
    const totalQty = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    const handleSelectProduct = (product: any) => {
        addItem(product);
    };

    const handleSelectCustomer = (c: any) => {
        setCustomer(c);
        setIsCustomerSearchOpen(false);
        toast.success(`Đã chọn khách hàng: ${c.name}`);
    };

    const handleParkOrder = () => {
        if (cartItems.length === 0) {
            toast.error("Giỏ hàng trống");
            return;
        }
        parkOrder(); // Saves to draftOrders in store
        clearCart(); // Clears current cart to start new
        toast.success("Đã lưu đơn hàng tạm");
    };

    const handleCheckout = async () => {
        if (cartItems.length === 0) {
            toast.error("Giỏ hàng trống");
            return;
        }
        try {
            // TODO: Open Payment Modal for partial payment / method selection?
            // User requirement: "ấn thanh toán phải thành công" (Press pay must succeed)
            // We'll simulate a full cash payment for now or simple submit
            // Ideally we should check inventory, etc.

            await submitOrder({
                payment_method: 'cash',
                amount_paid: total
            });
            toast.success("Thanh toán thành công!");
            clearCart();
        } catch (error) {
            console.error(error);
            toast.error("Lỗi khi thanh toán");
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            {/* Top Bar - With Cart Counter Badge */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-3 flex items-center gap-3 shadow-lg sticky top-0 z-50">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white active:bg-white/30 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-white font-semibold text-lg">Bán hàng</h1>
                <div className="flex-1" />
                <div className="flex items-center gap-2">
                    <button className="relative w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white active:bg-white/30 transition-colors">
                        <ClipboardList className="w-5 h-5" />
                        {totalQty > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full font-bold shadow-sm">
                                {totalQty > 9 ? '9+' : totalQty}
                            </span>
                        )}
                    </button>
                    <button className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white active:bg-white/30 transition-colors">
                        <MoreVertical className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Product Search Bar - Sticky */}
            <div className="bg-white p-3 shadow-sm sticky top-[64px] z-40">
                <MobileProductSearch onSelect={handleSelectProduct} />
            </div>

            {/* Content: List */}
            <div className="flex-1 overflow-y-auto pb-40">
                {/* Product List */}
                <div className="bg-white border-b border-gray-100 mb-2">
                    {cartItems.length === 0 ? (
                        <div className="py-16 text-center flex flex-col items-center">
                            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                <ClipboardList className="w-10 h-10 text-gray-300" />
                            </div>
                            <p className="text-gray-500 font-medium">Chưa có sản phẩm</p>
                            <p className="text-gray-400 text-sm mt-1">Quét mã hoặc tìm kiếm để thêm</p>
                        </div>
                    ) : cartItems.map((item, index) => (
                        <div
                            key={item.id}
                            className="p-4 border-b border-gray-100 last:border-none flex gap-3 active:bg-gray-50 transition-colors"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            {/* Thumbnail Image */}
                            <div className="w-16 h-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden shrink-0 border border-gray-200 shadow-sm">
                                {item.product.image_url ? (
                                    <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="text-gray-800 text-sm font-semibold line-clamp-2 leading-snug pr-2">{item.product.name}</h4>
                                    <button
                                        onClick={() => removeItem(item.id)}
                                        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 active:bg-red-100 active:text-red-500 transition-colors shrink-0 -mr-1 -mt-1"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="text-xs text-gray-400 mb-2">{item.product.sku}</div>
                                <div className="flex justify-between items-center">
                                    <div className="font-bold text-emerald-600 text-base">{formatVND(item.unit_price)}</div>

                                    {/* Qty Control - Larger touch targets */}
                                    <div className="flex items-center bg-gray-100 rounded-full p-0.5">
                                        <button
                                            onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                                            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-emerald-600 active:scale-95 transition-transform"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <div className="w-10 h-9 flex items-center justify-center text-sm font-bold text-gray-800">
                                            {item.quantity}
                                        </div>
                                        <button
                                            onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                                            className="w-9 h-9 rounded-full bg-emerald-500 shadow-sm flex items-center justify-center text-white active:scale-95 transition-transform"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Info Sections */}
                <div className="bg-white mb-2">
                    <div className="p-4 flex items-center gap-3 text-emerald-600 border-b border-gray-50">
                        <Gift className="w-5 h-5" />
                        <span className="text-sm font-medium">Áp dụng khuyến mại</span>
                    </div>
                    <div className="p-4 space-y-3">
                        <div className="flex justify-between text-base">
                            <span className="text-gray-600">Tổng tiền hàng</span>
                            <span className="font-medium">{formatVND(total)}</span>
                        </div>
                        <div className="flex justify-between text-base text-emerald-600">
                            <span>Chiết khấu</span>
                            <span>0</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white mb-2">
                    <div className="p-4 border-b border-gray-50">
                        <h3 className="text-gray-800 font-medium">Khách hàng</h3>
                    </div>
                    <button
                        onClick={() => setIsCustomerSearchOpen(true)}
                        className="w-full p-4 flex items-center justify-between active:bg-gray-50"
                    >
                        <div className="flex items-center gap-3 text-emerald-600">
                            <User className="w-5 h-5 text-gray-400" />
                            {customer ? (
                                <div>
                                    <span className="text-sm font-medium block text-gray-900">{customer.name}</span>
                                    {customer.points_balance > 0 && <span className="text-xs text-orange-500">Điểm: {customer.points_balance}</span>}
                                </div>
                            ) : (
                                <span className="text-sm">Thêm khách hàng</span>
                            )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                    {customer && (
                        <button
                            onClick={() => setCustomer(null)}
                            className="w-full py-2 text-center text-xs text-red-500 border-t border-gray-50"
                        >
                            Bỏ chọn khách hàng
                        </button>
                    )}
                </div>

                <div className="bg-white mb-2">
                    <button
                        onClick={toggleWholesaleMode}
                        className="w-full p-4 flex items-center justify-between active:bg-gray-50"
                    >
                        <div className="flex items-center gap-3">
                            <Tag className={cn("w-5 h-5", wholesaleMode ? "text-orange-500" : "text-gray-400")} />
                            <div className="text-left">
                                <span className={cn("text-sm block font-medium", wholesaleMode ? "text-orange-600" : "text-emerald-600")}>
                                    {wholesaleMode ? "Giá bán buôn" : "Giá bán lẻ"}
                                </span>
                                <span className="text-xs text-gray-400">
                                    {wholesaleMode ? "Đang áp dụng giá buôn" : "Chạm để chuyển giá buôn"}
                                </span>
                            </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                </div>

                <div className="bg-white mb-4">
                    <button className="w-full p-4 flex items-center justify-between active:bg-gray-50">
                        <div className="flex items-center gap-3">
                            <ClipboardList className="w-5 h-5 text-gray-500" />
                            <span className="text-gray-700 text-sm">Hóa đơn điện tử</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Bottom Bar - POS Style */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-safe z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-600 font-medium">Tổng cộng</span>
                        <span className="bg-emerald-100 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-bold">{totalQty} sản phẩm</span>
                    </div>
                    <span className="text-emerald-600 font-bold text-2xl">{formatVND(total)}</span>
                </div>
                <div className="flex gap-3 h-14">
                    <button className="w-14 bg-gray-100 text-gray-600 rounded-xl flex flex-col items-center justify-center gap-1 active:bg-gray-200 transition-colors">
                        <Printer className="w-5 h-5" />
                        <span className="text-[10px] font-medium leading-none">In</span>
                    </button>
                    <button
                        onClick={handleParkOrder}
                        className="w-14 bg-gray-100 text-gray-600 rounded-xl flex flex-col items-center justify-center gap-1 active:bg-gray-200 transition-colors"
                    >
                        <Save className="w-5 h-5" />
                        <span className="text-[10px] font-medium leading-none">Lưu</span>
                    </button>
                    <button
                        onClick={handleCheckout}
                        disabled={cartItems.length === 0}
                        className={cn(
                            "flex-1 rounded-xl font-bold shadow-lg active:scale-[0.98] transition-all text-lg flex items-center justify-center gap-2",
                            cartItems.length > 0
                                ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                                : "bg-gray-200 text-gray-400"
                        )}
                    >
                        💳 Thanh toán
                    </button>
                </div>
            </div>

            {/* Modals */}
            {/* Modals */}
            <MobileCustomerSearch
                isOpen={isCustomerSearchOpen}
                onClose={() => setIsCustomerSearchOpen(false)}
                onSelect={handleSelectCustomer}
            />

            {showScanner && (
                <BarcodeScannerModal
                    onScan={handleBarcodeScan}
                    onClose={() => setShowScanner(false)}
                    title="Quét sản phẩm (POS)"
                />
            )}

            {/* Product Selection Modal for duplicate barcodes */}
            {barcodeMatches.length > 0 && (
                <BarcodeSelectionModal
                    matches={barcodeMatches}
                    onSelect={handleBarcodeSelect}
                    onClose={() => setBarcodeMatches([])}
                />
            )}
        </div>
    );
}

// Helper icons
function ChevronRight({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
}
