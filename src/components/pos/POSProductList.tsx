import type { Category } from '@/stores/categoryStore';
import type { ProductSearchItem } from '@/types';
import { getProductEmoji } from '@/lib/posUtils';
import { cn } from '@/lib/utils';
import { formatVND } from '@/lib/cashReconciliation';

interface CustomList {
    id: string;
    name: string;
}

interface POSProductListProps {
    products: ProductSearchItem[];
    // Categories
    orderedCategories: Category[];
    selectedCategory: string;
    onSelectCategory: (id: string) => void;
    visibleCategoryIds: string[];
    showAllTab: boolean;
    customLists: CustomList[];

    // Quick Actions
    onShowOrderLookup: () => void;
    onShowCustomerLookup: () => void;
    onShowShiftModal: () => void;
    onShowReminderManager: () => void;
    onShowCategorySettings: () => void;

    // Grid Config
    gridColumns?: number;
    panelHeight: number; // For styling height (if vertical layout)
    onProductClick: (item: ProductSearchItem) => void;
}

export const POSProductList = ({
    products,
    orderedCategories,
    selectedCategory,
    onSelectCategory,
    visibleCategoryIds,
    showAllTab,
    customLists,
    onShowOrderLookup,
    onShowCustomerLookup,
    onShowShiftModal,
    onShowReminderManager,
    onShowCategorySettings,
    gridColumns = 6,
    panelHeight,
    onProductClick
}: POSProductListProps) => {
    return (
        <div
            style={{ height: panelHeight }}
            className="bg-white border-t border-gray-100 flex flex-col shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 transition-[height] duration-75 relative"
        >
            {/* Header & Categories */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
                {/* Quick Actions Dropdown */}
                <div className="relative group">
                    <button className="w-9 h-9 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                    </button>
                    {/* Quick Menu Popup */}
                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-1 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 origin-bottom-left z-[100]">
                        <button onClick={onShowOrderLookup} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                            📄 Tra đơn hàng
                        </button>
                        <button onClick={onShowCustomerLookup} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                            👥 Tra khách hàng
                        </button>
                        <div className="h-px bg-gray-100 my-1"></div>
                        <button onClick={onShowShiftModal} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                            ⏱️ Quản lý ca
                        </button>
                        <button onClick={onShowReminderManager} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                            ⏰ Lời nhắc
                        </button>
                    </div>
                </div>

                {/* Ca làm việc Button - Visible */}
                <button
                    onClick={onShowShiftModal}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-medium flex items-center gap-1 transition-colors flex-shrink-0"
                    title="Quản lý ca làm việc"
                >
                    <span>⏱️</span> <span className="hidden sm:inline">Ca làm việc</span>
                </button>

                {/* Tra đơn Button - Visible */}
                <button
                    onClick={onShowOrderLookup}
                    className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 text-xs font-medium flex items-center gap-1 transition-colors flex-shrink-0"
                    title="Tra cứu đơn hàng"
                >
                    <span>📄</span> <span className="hidden sm:inline">Tra đơn</span>
                </button>

                <div className="h-6 w-px bg-gray-200 mx-1"></div>

                {/* All Tab */}
                {showAllTab && (
                    <button
                        onClick={() => onSelectCategory('all')}
                        className={cn("px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex-shrink-0",
                            selectedCategory === 'all' ? "bg-green-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                        )}
                    >
                        Tất cả
                    </button>
                )}

                {/* Dynamic Categories from Store */}
                <div className="flex-1 overflow-x-auto flex gap-2 no-scrollbar">
                    {orderedCategories
                        .filter(cat =>
                            visibleCategoryIds.length === 0 ||
                            visibleCategoryIds.includes(cat.id)
                        )
                        .map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => onSelectCategory(cat.id)}
                                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                                    selectedCategory === cat.id ? "bg-green-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900"
                                )}
                            >
                                {cat.name}
                            </button>
                        ))
                    }
                    {/* Custom Lists */}
                    {customLists.map((list) => (
                        <button
                            key={list.id}
                            onClick={() => onSelectCategory(list.id)}
                            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                                selectedCategory === list.id ? "bg-green-600 text-white" : "bg-purple-100 hover:bg-purple-200 text-purple-700"
                            )}
                        >
                            📋 {list.name}
                        </button>
                    ))}
                </div>

                {/* Settings Gear Icon - RIGHT SIDE */}
                <button
                    onClick={onShowCategorySettings}
                    className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0 ml-2"
                    title="Cài đặt danh mục"
                >
                    ⚙️
                </button>
            </div>

            {/* Product Grid - By Category */}
            <div className="flex-1 p-2 overflow-y-auto bg-slate-50">
                <div
                    className="grid gap-2"
                    style={{
                        gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`
                    }}
                >
                    {products.slice(0, 50).map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onProductClick(item)}
                            className="bg-white rounded-xl border border-gray-200 hover:border-green-400 hover:shadow-lg transition-all duration-200 text-left group flex h-16 overflow-hidden shadow-sm"
                        >
                            {/* Left: Square Image Block */}
                            <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-r border-gray-100 rounded-l-xl relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent" />
                                <span className="text-3xl relative z-10 drop-shadow-sm group-hover:scale-110 transition-transform duration-200">
                                    {getProductEmoji(item.name)}
                                </span>
                            </div>
                            {/* Right: Name, Price, Stock */}
                            <div className="flex-1 min-w-0 p-2 flex flex-col justify-between">
                                <p className="text-[11px] font-semibold text-gray-800 line-clamp-2 leading-tight">{item.name}</p>
                                <div className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] font-bold bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 px-1.5 py-0.5 rounded-md border border-green-100">
                                        {formatVND(item.price)}
                                    </span>
                                    <span className={cn(
                                        "text-[9px] font-medium px-1 py-0.5 rounded",
                                        item.stock > 10 ? "bg-blue-50 text-blue-600" :
                                            item.stock > 0 ? "bg-amber-50 text-amber-600" :
                                                "bg-red-50 text-red-600"
                                    )}>
                                        Sl: {item.stock}
                                    </span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
                {products.length === 0 && (
                    <div className="text-center py-20 text-gray-400">
                        <p>Không tìm thấy sản phẩm</p>
                    </div>
                )}
            </div>
        </div>
    );
};
