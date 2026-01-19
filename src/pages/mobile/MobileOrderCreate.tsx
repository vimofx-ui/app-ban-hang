import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MoreVertical, ChevronRight, Gift, User, Tag, ShoppingBag, Plus, Minus, ScanBarcode } from 'lucide-react';
import { usePOSStore } from '@/stores/posStore';
import { cn } from '@/lib/utils';
import { formatVND } from '@/lib/cashReconciliation';
import { MobileProductSearch } from '@/components/mobile/MobileProductSearch';
import { BarcodeScannerModal } from '@/components/common/BarcodeScannerModal';
import { BarcodeSelectionModal, findProductsByBarcode, type BarcodeMatch } from '@/components/common/BarcodeSelectionModal';
import { useState } from 'react';
import { useProductStore } from '@/stores/productStore';
import { POSAudio } from '@/lib/posAudio';
import { MOCK_PRODUCTS } from '@/data/mockProducts';
import { toast } from 'sonner';

export function MobileOrderCreate() {
    const navigate = useNavigate();
    const { cartItems, addItem, updateItemQuantity, removeItem, total } = usePOSStore();
    // Use products from store, fallback to mock if empty (for safety)
    const storeProducts = useProductStore((state) => state.products);
    const products = storeProducts.length > 0 ? storeProducts : MOCK_PRODUCTS;

    const [showScanner, setShowScanner] = useState(false);

    const handleSelectProduct = (product: any) => {
        addItem(product);
    };

    // State for multiple barcode matches modal
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

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            {/* Top Bar */}
            <div className="bg-white p-3 flex items-center gap-3 shadow-sm sticky top-0 z-50">
                <button onClick={() => navigate(-1)} className="text-gray-600">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex-1">
                    <MobileProductSearch onSelect={handleSelectProduct} />
                </div>
                <button className="text-gray-600">
                    <MoreVertical className="w-6 h-6" />
                </button>
            </div>

            {/* Empty State / Content */}
            <div className="flex-1 overflow-y-auto pb-32">
                {cartItems.length === 0 ? (
                    /* Empty Cart Illustration */
                    <div className="bg-white py-12 flex flex-col items-center justify-center border-b border-gray-100 mb-2">
                        <div className="w-32 h-32 bg-emerald-50 rounded-full flex items-center justify-center mb-4 relative">
                            <ShoppingBagIllustration />
                        </div>
                        <p className="text-gray-500 text-sm mb-2">Đơn hàng của bạn chưa có sản phẩm nào!</p>
                        <button className="text-emerald-600 font-medium text-sm">Chọn sản phẩm</button>
                    </div>
                ) : (
                    /* Brief List for Order Create (Simplified vs POS) */
                    <div className="bg-white border-b border-gray-100 mb-2">
                        {cartItems.map((item) => (
                            <div key={item.id} className="p-4 border-b border-gray-50 last:border-none flex gap-3">
                                <div className="w-12 h-12 bg-gray-100 rounded-md overflow-hidden shrink-0">
                                    {item.product.image_url && <img src={item.product.image_url} alt="" className="w-full h-full object-cover" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between">
                                        <h4 className="text-sm font-medium line-clamp-1">{item.product.name}</h4>
                                        <span className="font-bold text-sm">{formatVND(item.total_price)}</span>
                                    </div>
                                    SL: <span className="text-emerald-600 font-bold">{item.quantity}</span> x {formatVND(item.unit_price)}
                                </div>
                                {/* Qty Control */}
                                <div className="flex items-center border border-gray-200 rounded mt-2 w-fit">
                                    <button
                                        onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                                        className="w-8 h-8 flex items-center justify-center text-emerald-600 active:bg-emerald-50"
                                    >
                                        <Minus className="w-3 h-3" />
                                    </button>
                                    <div className="w-10 h-8 flex items-center justify-center border-l border-r border-gray-200 text-sm font-medium">
                                        {item.quantity}
                                    </div>
                                    <button
                                        onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                                        className="w-8 h-8 flex items-center justify-center text-emerald-600 active:bg-emerald-50"
                                    >
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Info Sections */}
                <div className="bg-white mb-2">
                    <div className="p-4 flex items-center gap-3 text-emerald-600 border-b border-gray-50">
                        <Gift className="w-5 h-5" />
                        <span className="text-sm font-medium">Áp dụng khuyến mại</span>
                    </div>
                    <div className="p-4 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Tổng số lượng</span>
                            <span className="font-medium">{cartItems.reduce((acc, i) => acc + i.quantity, 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Tổng tiền hàng</span>
                            <span className="font-medium">{formatVND(total)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-emerald-600">
                            <span>Chiết khấu</span>
                            <span>0</span>
                        </div>
                        <div className="flex justify-between text-sm text-emerald-600">
                            <span>Phí giao hàng</span>
                            <span>0</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white mb-2">
                    <div className="p-4 border-b border-gray-50">
                        <h3 className="text-gray-800 font-medium">Khách hàng</h3>
                    </div>
                    <button className="w-full p-4 flex items-center justify-between active:bg-gray-50">
                        <div className="flex items-center gap-3 text-emerald-600">
                            <User className="w-5 h-5 text-gray-400" />
                            <span className="text-sm">Thêm khách hàng</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                </div>

                <div className="bg-white mb-2">
                    <button className="w-full p-4 flex items-center justify-between active:bg-gray-50">
                        <div className="flex items-center gap-3">
                            <Tag className="w-5 h-5 text-gray-400" />
                            <span className="text-emerald-600 text-sm">Giá bán lẻ</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                </div>
                <div className="h-10"></div>
            </div>

            {/* Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-3 shadow-[-0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between items-center mb-3 px-1">
                    <span className="text-gray-700 font-medium">Tạm tính</span>
                    <span className="text-gray-900 font-bold text-lg">{formatVND(total)}</span>
                </div>
                <div className="flex gap-2">
                    <button className="bg-emerald-600 text-white font-bold py-3 px-4 rounded-lg flex-1 shadow-md active:bg-emerald-700 transition-colors">
                        Tạo đơn và giao hàng
                    </button>
                    <button className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
                        <MoreVertical className="w-5 h-5" />
                    </button>
                </div>
            </div>
            {/* Modals */}
            {showScanner && (
                <BarcodeScannerModal
                    onScan={handleBarcodeScan}
                    onClose={() => setShowScanner(false)}
                    title="Quét sản phẩm"
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

function ShoppingBagIllustration() {
    return (
        <svg viewBox="0 0 200 200" className="w-full h-full p-4 opacity-80" xmlns="http://www.w3.org/2000/svg">
            <path fill="#E0E7FF" d="M60 160 C 60 180, 140 180, 140 160 L 130 90 L 70 90 Z" />
            <rect x="65" y="80" width="70" height="10" rx="2" fill="#93C5FD" />
            <path fill="none" stroke="#60A5FA" strokeWidth="4" d="M80 80 L 80 50 A 20 20 0 0 1 120 50 L 120 80" />
            <circle cx="130" cy="70" r="15" fill="#fff" stroke="#60A5FA" strokeWidth="2" />
            <path stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" d="M130 63 v14 M123 70 h14" />
        </svg>
    )
}
