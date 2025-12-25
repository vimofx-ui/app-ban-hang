// =============================================================================
// LOYALTY STORE - Points Transaction History & Member Management
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// TYPES
// ============================================================================

export interface PointTransaction {
    id: string;
    customer_id: string;
    customer_name?: string;
    type: 'earn' | 'redeem' | 'adjust';
    points: number;                    // Positive for earn, negative for redeem
    balance_after: number;
    order_id?: string;
    order_number?: string;
    reason?: string;
    created_at: string;
    created_by?: string;
}

export interface MembershipTier {
    id: string;
    name: string;
    min_spent: number;               // Minimum total spent to reach this tier (VND)
    color: string;
    icon: string;
}

// Default tiers (display only, no special discounts)
export const DEFAULT_TIERS: MembershipTier[] = [
    { id: 'bronze', name: 'Đồng', min_spent: 0, color: '#CD7F32', icon: '🥉' },
    { id: 'silver', name: 'Bạc', min_spent: 5000000, color: '#C0C0C0', icon: '🥈' },
    { id: 'gold', name: 'Vàng', min_spent: 20000000, color: '#FFD700', icon: '🥇' },
    { id: 'platinum', name: 'Bạch kim', min_spent: 50000000, color: '#E5E4E2', icon: '💎' },
];

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface LoyaltyState {
    // Point transactions history
    transactions: PointTransaction[];

    // Membership tiers config
    tiers: MembershipTier[];

    // Store config (moved from settings)
    config: {
        storeName: string;
        storePhone: string;
        storeEmail: string;
        autoActivate: boolean;         // Auto-activate member when phone registered
        keepDataOnPhoneChange: boolean; // Keep points/tier when phone number changes
        excludedProductIds: string[];   // Products that do NOT earn points
        excludedCategoryIds: string[];  // Categories that do NOT earn points
    };

    // Actions
    addTransaction: (transaction: Omit<PointTransaction, 'id' | 'created_at'>) => PointTransaction;
    getCustomerTransactions: (customerId: string) => PointTransaction[];
    getRecentTransactions: (limit?: number) => PointTransaction[];

    // Points actions
    earnPoints: (customerId: string, customerName: string, points: number, orderId?: string, orderNumber?: string) => void;
    redeemPoints: (customerId: string, customerName: string, points: number, orderId?: string, orderNumber?: string) => void;
    adjustPoints: (customerId: string, customerName: string, points: number, reason: string) => void;

    // Tier helpers
    getTierForSpent: (totalSpent: number) => MembershipTier;
    updateTiers: (tiers: MembershipTier[]) => void;

    // Config
    updateConfig: (config: Partial<LoyaltyState['config']>) => void;

    // Stats
    getStats: (days?: number) => {
        totalMembers: number;
        totalPointsIssued: number;
        totalPointsRedeemed: number;
        redemptionRate: number;
        newMembersToday: number;
    };
    getDailyStats: (days: number) => Array<{
        date: string;
        newMembers: number;
        pointsEarned: number;
        pointsRedeemed: number;
    }>;
}

// ============================================================================
// STORE
// ============================================================================

export const useLoyaltyStore = create<LoyaltyState>()(
    persist(
        (set, get) => ({
            transactions: [],
            tiers: DEFAULT_TIERS,
            config: {
                storeName: 'Cửa hàng',
                storePhone: '',
                storeEmail: '',
                autoActivate: true,
                keepDataOnPhoneChange: true,
                excludedProductIds: [],
                excludedCategoryIds: [],
            },

            // Add a new transaction
            addTransaction: (transaction) => {
                const newTransaction: PointTransaction = {
                    ...transaction,
                    id: `pt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    created_at: new Date().toISOString(),
                };
                set((state) => ({
                    transactions: [newTransaction, ...state.transactions],
                }));
                return newTransaction;
            },

            // Get transactions for a specific customer
            getCustomerTransactions: (customerId) => {
                return get().transactions.filter((t) => t.customer_id === customerId);
            },

            // Get recent transactions
            getRecentTransactions: (limit = 100) => {
                return get().transactions.slice(0, limit);
            },

            // Earn points (from purchase)
            earnPoints: (customerId, customerName, points, orderId, orderNumber) => {
                if (points <= 0) return;

                // Get current balance (need to calculate from transactions)
                const customerTxs = get().transactions.filter(t => t.customer_id === customerId);
                const currentBalance = customerTxs.reduce((sum, t) => sum + t.points, 0);

                get().addTransaction({
                    customer_id: customerId,
                    customer_name: customerName,
                    type: 'earn',
                    points: points,
                    balance_after: currentBalance + points,
                    order_id: orderId,
                    order_number: orderNumber,
                    reason: `Tích điểm từ đơn hàng ${orderNumber || ''}`,
                });
            },

            // Redeem points (for payment)
            redeemPoints: (customerId, customerName, points, orderId, orderNumber) => {
                if (points <= 0) return;

                const customerTxs = get().transactions.filter(t => t.customer_id === customerId);
                const currentBalance = customerTxs.reduce((sum, t) => sum + t.points, 0);

                get().addTransaction({
                    customer_id: customerId,
                    customer_name: customerName,
                    type: 'redeem',
                    points: -points, // Negative for redemption
                    balance_after: currentBalance - points,
                    order_id: orderId,
                    order_number: orderNumber,
                    reason: `Thanh toán bằng điểm - Đơn ${orderNumber || ''}`,
                });
            },

            // Manual point adjustment
            adjustPoints: (customerId, customerName, points, reason) => {
                const customerTxs = get().transactions.filter(t => t.customer_id === customerId);
                const currentBalance = customerTxs.reduce((sum, t) => sum + t.points, 0);

                get().addTransaction({
                    customer_id: customerId,
                    customer_name: customerName,
                    type: 'adjust',
                    points: points,
                    balance_after: currentBalance + points,
                    reason: reason || 'Điều chỉnh điểm',
                });
            },

            // Get tier based on total spent
            getTierForSpent: (totalSpent) => {
                const tiers = [...get().tiers].sort((a, b) => b.min_spent - a.min_spent);
                return tiers.find((t) => totalSpent >= t.min_spent) || tiers[tiers.length - 1];
            },

            // Update tiers configuration
            updateTiers: (tiers) => {
                set({ tiers });
            },

            // Update store config
            updateConfig: (config) => {
                set((state) => ({
                    config: { ...state.config, ...config },
                }));
            },

            // Get overall stats
            getStats: (days = 30) => {
                const transactions = get().transactions;
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - days);

                const recentTxs = transactions.filter(t => new Date(t.created_at) >= cutoff);

                const totalPointsIssued = transactions
                    .filter(t => t.type === 'earn')
                    .reduce((sum, t) => sum + t.points, 0);

                const totalPointsRedeemed = Math.abs(transactions
                    .filter(t => t.type === 'redeem')
                    .reduce((sum, t) => sum + t.points, 0));

                // Count unique customers
                const uniqueCustomers = new Set(transactions.map(t => t.customer_id)).size;

                // New members today (approximation based on first transaction)
                const today = new Date().toISOString().split('T')[0];
                const firstTxByCustomer = new Map<string, string>();
                [...transactions].reverse().forEach(t => {
                    if (!firstTxByCustomer.has(t.customer_id)) {
                        firstTxByCustomer.set(t.customer_id, t.created_at.split('T')[0]);
                    }
                });
                const newMembersToday = Array.from(firstTxByCustomer.values()).filter(d => d === today).length;

                return {
                    totalMembers: uniqueCustomers,
                    totalPointsIssued,
                    totalPointsRedeemed,
                    redemptionRate: totalPointsIssued > 0 ? (totalPointsRedeemed / totalPointsIssued) * 100 : 0,
                    newMembersToday,
                };
            },

            // Get daily stats for charts
            getDailyStats: (days) => {
                const transactions = get().transactions;
                const result: Array<{ date: string; newMembers: number; pointsEarned: number; pointsRedeemed: number }> = [];

                // Build map of first transaction date per customer
                const firstTxByCustomer = new Map<string, string>();
                [...transactions].reverse().forEach(t => {
                    if (!firstTxByCustomer.has(t.customer_id)) {
                        firstTxByCustomer.set(t.customer_id, t.created_at.split('T')[0]);
                    }
                });

                for (let i = days - 1; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    const dateStr = date.toISOString().split('T')[0];

                    const dayTxs = transactions.filter(t => t.created_at.startsWith(dateStr));

                    const newMembers = Array.from(firstTxByCustomer.entries())
                        .filter(([_, d]) => d === dateStr).length;

                    const pointsEarned = dayTxs
                        .filter(t => t.type === 'earn')
                        .reduce((sum, t) => sum + t.points, 0);

                    const pointsRedeemed = Math.abs(dayTxs
                        .filter(t => t.type === 'redeem')
                        .reduce((sum, t) => sum + t.points, 0));

                    result.push({
                        date: `${date.getDate()}/${date.getMonth() + 1}`,
                        newMembers,
                        pointsEarned,
                        pointsRedeemed,
                    });
                }

                return result;
            },
        }),
        {
            name: 'loyalty-store',
        }
    )
);
