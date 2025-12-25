// =============================================================================
// CATEGORY STORE - Categories, Brands, Product Types Management
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Category {
    id: string;
    name: string;
    type: 'category' | 'brand' | 'product_type';
    created_at: string;
    exclude_from_loyalty_points?: boolean;
}

interface CategoryState {
    categories: Category[];
    brands: Category[];
    productTypes: Category[];

    addCategory: (name: string) => Category;
    addBrand: (name: string) => Category;
    addProductType: (name: string) => Category;
    deleteItem: (id: string, type: 'category' | 'brand' | 'product_type') => void;
    updateItem: (id: string, type: 'category' | 'brand' | 'product_type', updates: Partial<Category>) => void;

    getCategories: () => Category[];
    getBrands: () => Category[];
    getProductTypes: () => Category[];

    // Get or create "Không mã" category for products without barcode
    getOrCreateNoBarcodeCategory: () => Category;
}

// Static ID for "Không mã" category
export const NO_BARCODE_CATEGORY_ID = 'no-barcode-category';

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useCategoryStore = create<CategoryState>()(
    persist(
        (set, get) => ({
            categories: [
                { id: '1', name: 'Thực phẩm', type: 'category', created_at: new Date().toISOString() },
                { id: '2', name: 'Đồ uống', type: 'category', created_at: new Date().toISOString() },
                { id: '3', name: 'Bánh kẹo', type: 'category', created_at: new Date().toISOString() },
                { id: '4', name: 'Chăm sóc cá nhân', type: 'category', created_at: new Date().toISOString() },
                { id: '5', name: 'Đồ gia dụng', type: 'category', created_at: new Date().toISOString() },
                { id: NO_BARCODE_CATEGORY_ID, name: 'Không mã', type: 'category', created_at: new Date().toISOString() },
            ],
            brands: [],
            productTypes: [],

            addCategory: (name: string) => {
                const newItem: Category = {
                    id: generateId(),
                    name,
                    type: 'category',
                    created_at: new Date().toISOString()
                };
                set((state) => ({ categories: [...state.categories, newItem] }));
                return newItem;
            },

            addBrand: (name: string) => {
                const newItem: Category = {
                    id: generateId(),
                    name,
                    type: 'brand',
                    created_at: new Date().toISOString()
                };
                set((state) => ({ brands: [...state.brands, newItem] }));
                return newItem;
            },

            addProductType: (name: string) => {
                const newItem: Category = {
                    id: generateId(),
                    name,
                    type: 'product_type',
                    created_at: new Date().toISOString()
                };
                set((state) => ({ productTypes: [...state.productTypes, newItem] }));
                return newItem;
            },

            deleteItem: (id: string, type: 'category' | 'brand' | 'product_type') => {
                set((state) => {
                    if (type === 'category') {
                        return { categories: state.categories.filter(c => c.id !== id) };
                    } else if (type === 'brand') {
                        return { brands: state.brands.filter(b => b.id !== id) };
                    } else {
                        return { productTypes: state.productTypes.filter(p => p.id !== id) };
                    }
                });
            },

            updateItem: (id: string, type: 'category' | 'brand' | 'product_type', updates: Partial<Category>) => {
                set((state) => {
                    if (type === 'category') {
                        return { categories: state.categories.map(c => c.id === id ? { ...c, ...updates } : c) };
                    } else if (type === 'brand') {
                        return { brands: state.brands.map(b => b.id === id ? { ...b, ...updates } : b) };
                    } else {
                        return { productTypes: state.productTypes.map(p => p.id === id ? { ...p, ...updates } : p) };
                    }
                });
            },

            getCategories: () => get().categories,
            getBrands: () => get().brands,
            getProductTypes: () => get().productTypes,

            // Get or create "Không mã" category
            getOrCreateNoBarcodeCategory: () => {
                const existing = get().categories.find(c => c.id === NO_BARCODE_CATEGORY_ID);
                if (existing) return existing;

                // Create the category with static ID
                const newCategory: Category = {
                    id: NO_BARCODE_CATEGORY_ID,
                    name: 'Không mã',
                    type: 'category',
                    created_at: new Date().toISOString()
                };
                set((state) => ({ categories: [...state.categories, newCategory] }));
                return newCategory;
            },
        }),
        {
            name: 'category-store',
        }
    )
);
