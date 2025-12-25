// =============================================================================
// BRANCH STORE - Multi-Branch/Multi-Store Management
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// INTERFACES
// ============================================================================

export interface Branch {
    id: string;
    name: string;
    code: string;              // VD: "CN01", "HN02"
    address: string;
    phone: string;
    email?: string;
    manager?: string;          // User ID of branch manager
    isActive: boolean;
    isHeadquarters: boolean;   // Flag for main branch
    timezone?: string;
    openTime?: string;         // "08:00"
    closeTime?: string;        // "22:00"
    latitude?: number;
    longitude?: number;
    createdAt: string;
    updatedAt: string;
}

export interface StockTransfer {
    id: string;
    fromBranchId: string;
    toBranchId: string;
    status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
    items: StockTransferItem[];
    notes?: string;
    createdBy: string;
    createdAt: string;
    completedAt?: string;
}

export interface StockTransferItem {
    productId: string;
    productName: string;
    quantity: number;
    receivedQuantity?: number;
}

export interface BranchSettings {
    branchId: string;
    // Override settings per branch
    receiptHeader?: string;
    receiptFooter?: string;
    allowNegativeStock?: boolean;
    defaultPaymentMethods?: string[];
}

// ============================================================================
// STATE
// ============================================================================

interface BranchState {
    branches: Branch[];
    currentBranchId: string | null;
    stockTransfers: StockTransfer[];
    branchSettings: BranchSettings[];
    loading: boolean;

    // Branch CRUD
    addBranch: (branch: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>) => Branch;
    updateBranch: (id: string, updates: Partial<Branch>) => void;
    deleteBranch: (id: string) => void;

    // Branch Selection
    setCurrentBranch: (branchId: string) => void;
    getCurrentBranch: () => Branch | null;

    // Stock Transfer
    createStockTransfer: (transfer: Omit<StockTransfer, 'id' | 'createdAt' | 'status'>) => StockTransfer;
    updateStockTransfer: (id: string, updates: Partial<StockTransfer>) => void;
    completeStockTransfer: (id: string, receivedItems: { productId: string; receivedQuantity: number }[]) => void;
    cancelStockTransfer: (id: string) => void;

    // Branch Settings
    getBranchSettings: (branchId: string) => BranchSettings | undefined;
    updateBranchSettings: (branchId: string, settings: Partial<BranchSettings>) => void;

    // Helpers
    getBranchById: (id: string) => Branch | undefined;
    getActiveBranches: () => Branch[];
}

// ============================================================================
// DEFAULT DATA
// ============================================================================

const DEFAULT_BRANCHES: Branch[] = [
    {
        id: 'branch-hq',
        name: 'Chi nhánh Chính',
        code: 'HQ01',
        address: '123 Đường ABC, Quận 1, TP.HCM',
        phone: '0901234567',
        email: 'main@store.vn',
        isActive: true,
        isHeadquarters: true,
        openTime: '08:00',
        closeTime: '22:00',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }
];

// ============================================================================
// STORE
// ============================================================================

export const useBranchStore = create<BranchState>()(
    persist(
        (set, get) => ({
            branches: DEFAULT_BRANCHES,
            currentBranchId: 'branch-hq',
            stockTransfers: [],
            branchSettings: [],
            loading: false,

            // ============== BRANCH CRUD ==============
            addBranch: (branchData) => {
                const newBranch: Branch = {
                    ...branchData,
                    id: `branch-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                set((state) => ({
                    branches: [...state.branches, newBranch]
                }));
                return newBranch;
            },

            updateBranch: (id, updates) => {
                set((state) => ({
                    branches: state.branches.map((b) =>
                        b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b
                    )
                }));
            },

            deleteBranch: (id) => {
                // Soft delete by setting isActive to false
                set((state) => ({
                    branches: state.branches.map((b) =>
                        b.id === id ? { ...b, isActive: false, updatedAt: new Date().toISOString() } : b
                    )
                }));
            },

            // ============== BRANCH SELECTION ==============
            setCurrentBranch: (branchId) => {
                set({ currentBranchId: branchId });
            },

            getCurrentBranch: () => {
                const { branches, currentBranchId } = get();
                return branches.find((b) => b.id === currentBranchId) || null;
            },

            // ============== STOCK TRANSFER ==============
            createStockTransfer: (transferData) => {
                const newTransfer: StockTransfer = {
                    ...transferData,
                    id: `transfer-${Date.now()}`,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                };
                set((state) => ({
                    stockTransfers: [...state.stockTransfers, newTransfer]
                }));
                return newTransfer;
            },

            updateStockTransfer: (id, updates) => {
                set((state) => ({
                    stockTransfers: state.stockTransfers.map((t) =>
                        t.id === id ? { ...t, ...updates } : t
                    )
                }));
            },

            completeStockTransfer: (id, receivedItems) => {
                set((state) => ({
                    stockTransfers: state.stockTransfers.map((t) => {
                        if (t.id === id) {
                            const updatedItems = t.items.map((item) => {
                                const received = receivedItems.find((r) => r.productId === item.productId);
                                return received ? { ...item, receivedQuantity: received.receivedQuantity } : item;
                            });
                            return {
                                ...t,
                                items: updatedItems,
                                status: 'completed' as const,
                                completedAt: new Date().toISOString(),
                            };
                        }
                        return t;
                    })
                }));
            },

            cancelStockTransfer: (id) => {
                set((state) => ({
                    stockTransfers: state.stockTransfers.map((t) =>
                        t.id === id ? { ...t, status: 'cancelled' as const } : t
                    )
                }));
            },

            // ============== BRANCH SETTINGS ==============
            getBranchSettings: (branchId) => {
                return get().branchSettings.find((s) => s.branchId === branchId);
            },

            updateBranchSettings: (branchId, settings) => {
                set((state) => {
                    const existing = state.branchSettings.find((s) => s.branchId === branchId);
                    if (existing) {
                        return {
                            branchSettings: state.branchSettings.map((s) =>
                                s.branchId === branchId ? { ...s, ...settings } : s
                            )
                        };
                    } else {
                        return {
                            branchSettings: [...state.branchSettings, { branchId, ...settings }]
                        };
                    }
                });
            },

            // ============== HELPERS ==============
            getBranchById: (id) => {
                return get().branches.find((b) => b.id === id);
            },

            getActiveBranches: () => {
                return get().branches.filter((b) => b.isActive);
            },
        }),
        {
            name: 'branch-store',
        }
    )
);
