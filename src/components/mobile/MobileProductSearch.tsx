import { useState, useRef, useEffect } from 'react';
import { Search, ScanLine, Clock, ArrowLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProductStore } from '@/stores/productStore';
import { MobileScanner } from './MobileScanner';
import { formatVND } from '@/lib/cashReconciliation';

interface MobileProductSearchProps {
    onSelect: (product: any) => void;
    placeholder?: string;
    className?: string;
}

export function MobileProductSearch({ onSelect, placeholder = "Tìm và thêm sản phẩm...", className }: MobileProductSearchProps) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false); // Controls full screen mode
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const { products, searchProducts, getProductByBarcode } = useProductStore();
    const inputRef = useRef<HTMLInputElement>(null);

    // Get recent products (newest first)
    const recentProducts = [...products]
        .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
        .slice(0, 20);

    const searchResults = query ? searchProducts(query).slice(0, 20) : recentProducts;

    const handleSelect = (product: any) => {
        onSelect(product);
        setIsOpen(false);
        setQuery('');
    };

    const handleScan = (code: string) => {
        const product = getProductByBarcode(code);
        if (product) {
            handleSelect(product);
        } else {
            // Optional: Toast
        }
    };

    // Auto-focus input when opening full screen
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    return (
        <>
            {/* 1. Closed State - The Trigger Input */}
            <div
                className={cn("relative", className)}
                onClick={() => setIsOpen(true)}
            >
                <div className="bg-gray-100 rounded-lg flex items-center px-3 py-2 gap-2 cursor-text active:bg-gray-200 transition-colors">
                    <Search className="w-5 h-5 text-gray-400" />
                    <span className={cn("text-sm flex-1 truncate", query ? "text-gray-900" : "text-gray-500")}>
                        {query || placeholder}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsScannerOpen(true);
                        }}
                        className="p-1 rounded-md active:bg-gray-300 text-gray-500 hover:text-gray-700"
                    >
                        <ScanLine className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* 2. Full Screen Overlay State */}
            {isOpen && (
                <div className="fixed inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-bottom-5 duration-200">
                    {/* Header */}
                    <div className="flex items-center gap-2 p-3 border-b border-gray-100 shadow-sm">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 -ml-2 text-gray-600 active:bg-gray-100 rounded-full"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div className="flex-1 bg-gray-100 rounded-lg flex items-center px-3 py-2 gap-2">
                            <Search className="w-5 h-5 text-gray-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder={placeholder}
                                className="bg-transparent border-none outline-none text-sm w-full placeholder-gray-500 text-gray-900"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            {query && (
                                <button onClick={() => setQuery('')} className="text-gray-400">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setIsScannerOpen(true)}
                            className="p-2 -mr-2 text-gray-600 active:bg-gray-100 rounded-full"
                        >
                            <ScanLine className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Results List */}
                    <div className="flex-1 overflow-y-auto bg-gray-50">
                        {!query && (
                            <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0">
                                <Clock className="w-3 h-3" />
                                Sản phẩm mới thêm
                            </div>
                        )}

                        {searchResults.length > 0 ? (
                            <div className="bg-white divide-y divide-gray-50">
                                {searchResults.map((product) => (
                                    <button
                                        key={product.id}
                                        onClick={() => handleSelect(product)}
                                        className="w-full text-left p-3 flex gap-4 hover:bg-gray-50 active:bg-emerald-50 transition-colors"
                                    >
                                        <div className="w-12 h-12 bg-gray-100 rounded-lg shrink-0 overflow-hidden border border-gray-200 relative">
                                            {product.image_url ? (
                                                <img src={product.image_url} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 font-bold">IMG</div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <h4 className="text-sm font-medium text-gray-900 line-clamp-1 mb-1">{product.name}</h4>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                                    {product.sku || 'No SKU'}
                                                </span>
                                                <span className="text-sm font-bold text-emerald-600">
                                                    {formatVND(product.selling_price)}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center pt-20 text-gray-400">
                                <Search className="w-12 h-12 mb-2 opacity-20" />
                                <span className="text-sm">Không tìm thấy sản phẩm</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Scanner Modal */}
            <MobileScanner
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleScan}
            />
        </>
    );
}
