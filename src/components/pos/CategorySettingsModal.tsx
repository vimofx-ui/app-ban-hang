// =============================================================================
// CATEGORY SETTINGS MODAL - Configure POS category tabs
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useSettingsStore, type CustomProductList } from '../../stores/settingsStore';
import { useCategoryStore, type Category } from '../../stores/categoryStore';
import { useProductStore } from '../../stores/productStore';
import { cn } from '../../lib/utils';

interface CategorySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CategorySettingsModal({ isOpen, onClose }: CategorySettingsModalProps) {
    const { categories } = useCategoryStore();
    const { products } = useProductStore();
    const {
        posCategories: rawPosCategories,
        updatePosCategories,
        addCustomList,
        updateCustomList,
        deleteCustomList
    } = useSettingsStore();

    // Safe defaults for migration
    const posCategories = rawPosCategories || {
        visibleCategoryIds: [],
        customLists: [],
        categoryOrder: [],
        defaultCategoryId: 'all',
        showAllTab: true,
    };

    const [activeTab, setActiveTab] = useState<'categories' | 'custom' | 'defaults'>('categories');
    const [tempVisible, setTempVisible] = useState<string[]>(posCategories.visibleCategoryIds);
    const [tempShowAll, setTempShowAll] = useState(posCategories.showAllTab);
    const [tempDefault, setTempDefault] = useState(posCategories.defaultCategoryId);
    const [tempOrder, setTempOrder] = useState<string[]>([]);
    const [tempColumns, setTempColumns] = useState(posCategories.productGridColumns || 6);

    // Custom list editing
    const [editingList, setEditingList] = useState<CustomProductList | null>(null);
    const [newListName, setNewListName] = useState('');
    const [productSearch, setProductSearch] = useState('');

    // Sync with store on open
    useEffect(() => {
        if (isOpen) {
            setTempVisible([...posCategories.visibleCategoryIds]);
            setTempShowAll(posCategories.showAllTab);
            setTempDefault(posCategories.defaultCategoryId);
            setTempColumns(posCategories.productGridColumns || 6);
            // Initialize order from store or default order
            const storedOrder = posCategories.categoryOrder;
            if (storedOrder && storedOrder.length > 0) {
                setTempOrder([...storedOrder]);
            } else {
                // Default: use categories order
                setTempOrder(categories.map(c => c.id));
            }
        }
    }, [isOpen, posCategories, categories]);

    const handleSave = () => {
        updatePosCategories({
            visibleCategoryIds: tempVisible,
            showAllTab: tempShowAll,
            defaultCategoryId: tempDefault,
            categoryOrder: tempOrder,
            productGridColumns: tempColumns,
        });
        onClose();
    };

    const toggleCategory = (id: string) => {
        if (tempVisible.includes(id)) {
            setTempVisible(tempVisible.filter(v => v !== id));
        } else {
            setTempVisible([...tempVisible, id]);
        }
    };

    const moveCategory = (id: string, direction: 'up' | 'down') => {
        const idx = tempOrder.indexOf(id);
        if (idx === -1) return;
        const newOrder = [...tempOrder];
        if (direction === 'up' && idx > 0) {
            [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
        } else if (direction === 'down' && idx < newOrder.length - 1) {
            [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
        }
        setTempOrder(newOrder);
    };

    const handleCreateList = () => {
        if (!newListName.trim()) return;
        const list = addCustomList(newListName.trim());
        setEditingList(list);
        setNewListName('');
    };

    const handleAddProductToList = (productId: string) => {
        if (!editingList) return;
        if (editingList.productIds.includes(productId)) return;
        const updated = { productIds: [...editingList.productIds, productId] };
        updateCustomList(editingList.id, updated);
        setEditingList({ ...editingList, ...updated });
    };

    const handleRemoveProductFromList = (productId: string) => {
        if (!editingList) return;
        const updated = { productIds: editingList.productIds.filter(id => id !== productId) };
        updateCustomList(editingList.id, updated);
        setEditingList({ ...editingList, ...updated });
    };

    // Get ordered categories
    const orderedCategories = React.useMemo(() => {
        if (tempOrder.length === 0) return categories;
        return [...categories].sort((a, b) => {
            const aIdx = tempOrder.indexOf(a.id);
            const bIdx = tempOrder.indexOf(b.id);
            if (aIdx === -1) return 1;
            if (bIdx === -1) return -1;
            return aIdx - bIdx;
        });
    }, [categories, tempOrder]);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.barcode?.includes(productSearch) ||
        p.sku?.includes(productSearch)
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">⚙️</span>
                        <h2 className="text-lg font-bold">Cài đặt danh mục POS</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    {[
                        { key: 'categories', label: '📂 Danh mục', icon: '📂' },
                        { key: 'custom', label: '📋 Danh sách tùy chỉnh', icon: '📋' },
                        { key: 'defaults', label: '⭐ Mặc định', icon: '⭐' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as typeof activeTab)}
                            className={cn(
                                "flex-1 py-3 px-4 text-sm font-medium transition-colors",
                                activeTab === tab.key
                                    ? "border-b-2 border-green-500 text-green-600 bg-green-50"
                                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* Categories Tab */}
                    {activeTab === 'categories' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500">
                                Chọn danh mục hiển thị và kéo để sắp xếp thứ tự.
                            </p>

                            {/* Show All Tab Toggle */}
                            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                                <input
                                    type="checkbox"
                                    checked={tempShowAll}
                                    onChange={(e) => setTempShowAll(e.target.checked)}
                                    className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <div>
                                    <span className="font-medium">Hiện tab "Tất cả"</span>
                                    <p className="text-xs text-gray-400">Tab hiển thị tất cả sản phẩm</p>
                                </div>
                            </label>

                            <div className="border rounded-lg divide-y">
                                {orderedCategories.map((cat: Category, index: number) => (
                                    <div
                                        key={cat.id}
                                        className="flex items-center gap-3 p-3 hover:bg-gray-50"
                                    >
                                        {/* Checkbox */}
                                        <input
                                            type="checkbox"
                                            checked={tempVisible.length === 0 || tempVisible.includes(cat.id)}
                                            onChange={() => toggleCategory(cat.id)}
                                            className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                        />
                                        {/* Name */}
                                        <span className="font-medium flex-1">{cat.name}</span>
                                        {/* Move Buttons */}
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => moveCategory(cat.id, 'up')}
                                                disabled={index === 0}
                                                className={cn(
                                                    "p-1 rounded hover:bg-gray-200 transition-colors",
                                                    index === 0 ? "opacity-30 cursor-not-allowed" : ""
                                                )}
                                                title="Di chuyển lên"
                                            >
                                                ⬆️
                                            </button>
                                            <button
                                                onClick={() => moveCategory(cat.id, 'down')}
                                                disabled={index === orderedCategories.length - 1}
                                                className={cn(
                                                    "p-1 rounded hover:bg-gray-200 transition-colors",
                                                    index === orderedCategories.length - 1 ? "opacity-30 cursor-not-allowed" : ""
                                                )}
                                                title="Di chuyển xuống"
                                            >
                                                ⬇️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => setTempVisible([])}
                                className="text-sm text-blue-600 hover:underline"
                            >
                                Hiển thị tất cả danh mục
                            </button>
                        </div>
                    )}

                    {/* Custom Lists Tab */}
                    {activeTab === 'custom' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500">
                                Tạo danh sách sản phẩm tùy chỉnh hiển thị như tab riêng.
                            </p>

                            {/* Create New List */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newListName}
                                    onChange={(e) => setNewListName(e.target.value)}
                                    placeholder="Tên danh sách mới..."
                                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                                />
                                <button
                                    onClick={handleCreateList}
                                    disabled={!newListName.trim()}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                                >
                                    + Tạo mới
                                </button>
                            </div>

                            {/* Existing Lists */}
                            <div className="grid grid-cols-1 gap-2">
                                {posCategories.customLists.map(list => (
                                    <div
                                        key={list.id}
                                        className={cn(
                                            "p-3 border rounded-lg flex items-center justify-between cursor-pointer transition-colors",
                                            editingList?.id === list.id ? "border-green-500 bg-green-50" : "hover:bg-gray-50"
                                        )}
                                        onClick={() => setEditingList(list)}
                                    >
                                        <div>
                                            <span className="font-medium">{list.name}</span>
                                            <span className="ml-2 text-sm text-gray-400">
                                                ({list.productIds.length} sản phẩm)
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteCustomList(list.id);
                                                if (editingList?.id === list.id) setEditingList(null);
                                            }}
                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Edit List Products */}
                            {editingList && (
                                <div className="border-t pt-4 mt-4">
                                    <h3 className="font-bold mb-2">
                                        Sản phẩm trong "{editingList.name}"
                                    </h3>

                                    {/* Search Products */}
                                    <input
                                        type="text"
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        placeholder="Tìm sản phẩm để thêm..."
                                        className="w-full px-3 py-2 border rounded-lg mb-2 focus:ring-2 focus:ring-green-500"
                                    />

                                    {/* Search Results */}
                                    {productSearch && (
                                        <div className="max-h-40 overflow-y-auto border rounded-lg mb-3">
                                            {filteredProducts.slice(0, 10).map(p => (
                                                <div
                                                    key={p.id}
                                                    onClick={() => handleAddProductToList(p.id)}
                                                    className={cn(
                                                        "p-2 hover:bg-green-50 cursor-pointer flex items-center justify-between",
                                                        editingList.productIds.includes(p.id) && "bg-green-100"
                                                    )}
                                                >
                                                    <span>{p.name}</span>
                                                    {editingList.productIds.includes(p.id) ? (
                                                        <span className="text-green-600">✓</span>
                                                    ) : (
                                                        <span className="text-gray-400">+ Thêm</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Selected Products */}
                                    <div className="flex flex-wrap gap-2">
                                        {editingList.productIds.map(pid => {
                                            const p = products.find(pr => pr.id === pid);
                                            return p ? (
                                                <span
                                                    key={pid}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                                                >
                                                    {p.name}
                                                    <button
                                                        onClick={() => handleRemoveProductFromList(pid)}
                                                        className="ml-1 hover:text-red-600"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Defaults Tab */}
                    {activeTab === 'defaults' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500">
                                Chọn danh mục hiển thị mặc định khi mở POS.
                            </p>

                            <div className="border rounded-lg divide-y">
                                {tempShowAll && (
                                    <label className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="radio"
                                            name="defaultCategory"
                                            checked={tempDefault === 'all'}
                                            onChange={() => setTempDefault('all')}
                                            className="w-5 h-5 border-gray-300 text-green-600 focus:ring-green-500"
                                        />
                                        <span className="font-medium">Tất cả</span>
                                    </label>
                                )}

                                {categories.map((cat: Category) => {
                                    const isVisible = tempVisible.length === 0 || tempVisible.includes(cat.id);
                                    if (!isVisible) return null;
                                    return (
                                        <label
                                            key={cat.id}
                                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                                        >
                                            <input
                                                type="radio"
                                                name="defaultCategory"
                                                checked={tempDefault === cat.id}
                                                onChange={() => setTempDefault(cat.id)}
                                                className="w-5 h-5 border-gray-300 text-green-600 focus:ring-green-500"
                                            />
                                            <span className="font-medium">{cat.name}</span>
                                        </label>
                                    );
                                })}

                                {posCategories.customLists.map(list => (
                                    <label
                                        key={list.id}
                                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                                    >
                                        <input
                                            type="radio"
                                            name="defaultCategory"
                                            checked={tempDefault === list.id}
                                            onChange={() => setTempDefault(list.id)}
                                            className="w-5 h-5 border-gray-300 text-green-600 focus:ring-green-500"
                                        />
                                        <span className="font-medium">📋 {list.name}</span>
                                    </label>
                                ))}
                            </div>

                            {/* Product Grid Columns */}
                            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                <label className="block text-sm font-medium text-blue-800 mb-3">
                                    📊 Số cột hiển thị sản phẩm (3-9)
                                </label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min={3}
                                        max={9}
                                        value={tempColumns}
                                        onChange={(e) => setTempColumns(Number(e.target.value))}
                                        className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <span className="text-2xl font-bold text-blue-600 min-w-[40px] text-center">
                                        {tempColumns}
                                    </span>
                                </div>
                                <p className="text-xs text-blue-600 mt-2">Tự động co giãn cho phù hợp với số cột đã chọn</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 shadow-sm"
                    >
                        💾 Lưu cài đặt
                    </button>
                </div>
            </div>
        </div>
    );
}
