// =============================================================================
// REPORT STORE - Analytics and Reporting functionality
// =============================================================================

import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

import type { Order } from '@/types';

export interface DailyRevenue {
    date: string;
    revenue: number;
    profit: number;
    orders: number;
}

export interface TopProduct {
    id: string;
    name: string;
    quantity: number;
    revenue: number;
}

export interface PaymentBreakdown {
    cash: number;
    transfer: number;
    card: number;
    debt: number;
    points: number;
}

interface ReportState {
    // Data
    dailyRevenue: DailyRevenue[];
    topProducts: TopProduct[];
    recentOrders: Order[];
    totalRevenue: number;
    totalProfit: number; // Keep as generic profit (mapped to netProfit or gross? Let's map to Net for dashboard simplicity)
    grossProfit: number;
    totalExpenses: number;
    netProfit: number;
    totalOrders: number;
    paymentBreakdown: PaymentBreakdown;

    // UI State
    loading: boolean;
    error: string | null;
    dateRange: 'today' | 'week' | 'month' | 'year';

    // Actions
    fetchReports: (range: 'today' | 'week' | 'month' | 'year') => Promise<void>;
    setDateRange: (range: 'today' | 'week' | 'month' | 'year') => void;
}

export const useReportStore = create<ReportState>((set, get) => ({
    dailyRevenue: [],
    topProducts: [],
    recentOrders: [],
    totalRevenue: 0,
    totalProfit: 0,
    grossProfit: 0,
    totalExpenses: 0,
    netProfit: 0,
    totalOrders: 0,
    paymentBreakdown: { cash: 0, transfer: 0, card: 0, debt: 0, points: 0 },
    loading: false,
    error: null,
    dateRange: 'today',

    setDateRange: (range) => {
        set({ dateRange: range });
        get().fetchReports(range);
    },

    fetchReports: async (range) => {
        set({ loading: true, error: null });

        try {
            // Calculate Date Range
            const now = new Date();
            let startDate = new Date();
            const endDate = new Date(); // Today end of day

            // Reset time to start of day for accurate comparison
            endDate.setHours(23, 59, 59, 999);

            if (range === 'today') {
                startDate.setHours(0, 0, 0, 0);
            } else if (range === 'week') {
                startDate.setDate(now.getDate() - 7);
                startDate.setHours(0, 0, 0, 0);
            } else if (range === 'month') {
                startDate.setDate(now.getDate() - 30);
                startDate.setHours(0, 0, 0, 0);
            } else if (range === 'year') {
                startDate.setFullYear(now.getFullYear() - 1);
                startDate.setHours(0, 0, 0, 0);
            }

            let orders: any[] = [];
            let orderItems: any[] = [];

            // Check if Supabase is configured
            if (isSupabaseConfigured() && supabase) {
                // SUPABASE MODE: Fetch from database
                const startDateStr = startDate.toISOString();
                const endDateStr = endDate.toISOString();

                const { data: dbOrders, error: ordersError } = await supabase
                    .from('orders')
                    .select('*, customer:customers(*), order_items(*, product:products(*))')
                    .eq('status', 'completed')
                    .gte('created_at', startDateStr)
                    .lte('created_at', endDateStr)
                    .order('created_at', { ascending: false });

                if (ordersError) throw ordersError;
                orders = dbOrders || [];

                const orderIds = orders.map(o => o.id);
                if (orderIds.length > 0) {
                    const { data: items, error: itemsError } = await supabase
                        .from('order_items')
                        .select('*, products(name, cost_price)')
                        .in('order_id', orderIds);

                    if (itemsError) throw itemsError;
                    orderItems = items || [];
                }
            } else {
                // DEMO MODE: Use local data from localStorage
                const offlineOrders = JSON.parse(localStorage.getItem('offline-orders') || '[]');

                // Filter by date range and completed status
                orders = offlineOrders.filter((o: any) => {
                    const orderDate = new Date(o.created_at);
                    return o.status === 'completed' &&
                        orderDate >= startDate &&
                        orderDate <= endDate;
                });

                // Extract order items from orders
                orders.forEach((order: any) => {
                    if (order.order_items) {
                        order.order_items.forEach((item: any) => {
                            orderItems.push({
                                ...item,
                                order_id: order.id,
                                products: item.product || { name: item.product_name || 'Unknown', cost_price: 0 }
                            });
                        });
                    }
                });
            }
            const recentOrders = orders?.slice(0, 5) || [];


            // 3. Aggregate Daily Revenue
            const dailyMap = new Map<string, DailyRevenue>();

            // Initialize all days in range with 0 (optional, but looks better on chart)
            // For simplicity, we'll just map the unexpected data found. 
            // In a pro version, we'd loop from startDate to endDate filling gaps.

            // Helper to get date key
            const getDateKey = (dateStr: string) => {
                const d = new Date(dateStr);
                if (range === 'year') {
                    return d.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });
                }
                return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            };

            orders?.forEach(order => {
                const dateKey = getDateKey(order.created_at);
                const current = dailyMap.get(dateKey) || { date: dateKey, revenue: 0, profit: 0, orders: 0 };

                current.revenue += (order.total_amount || 0);
                // Profit will be calculated from items below

                current.orders += 1;
                dailyMap.set(dateKey, current);
            });

            // Calculate actual profit from Items
            let totalProfitCalc = 0;
            orderItems.forEach(item => {
                const order = orders?.find(o => o.id === item.order_id);
                if (order) {
                    const dateKey = getDateKey(order.created_at);
                    const current = dailyMap.get(dateKey);
                    if (current) {
                        // Calculate profit = total_price - (quantity * cost_price)
                        // Note: cost_price here is CURRENT cost. If cost changed, this is an estimate.
                        // Ideally order_items should store 'cost_at_purchase'.
                        const costPrice = item.products?.cost_price || 0;
                        const itemProfit = (item.total_price || 0) - ((item.quantity || 0) * costPrice);

                        current.profit += itemProfit;
                        totalProfitCalc += itemProfit;
                    }
                }
            });


            const dailyRevenue = Array.from(dailyMap.values()).sort((a, b) => {
                // naive sort by date string, strictly might differ by locale format
                // but usually works for simple charts. 
                // Better: keep a timestamp in DailyRevenue for sorting
                return a.date.localeCompare(b.date);
            });


            // 4. Aggregate Top Products
            const productMap = new Map<string, TopProduct>();

            orderItems.forEach(item => {
                const productName = item.products?.name || 'Unknown Product';
                const productId = item.product_id;
                const current = productMap.get(productId) || {
                    id: productId,
                    name: productName,
                    quantity: 0,
                    revenue: 0
                };

                current.quantity += (item.quantity || 0);
                current.revenue += (item.total_price || 0);
                productMap.set(productId, current);
            });

            const topProducts = Array.from(productMap.values())
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5);


            // 5. Fetch Operating Expenses (Cash Flow)
            let operatingExpenses = 0;
            if (isSupabaseConfigured() && supabase) {
                const { data: txs, error: txError } = await supabase
                    .from('transactions')
                    .select('amount')
                    .eq('type', 'expense')
                    .eq('is_accounting', true)
                    .gte('transaction_date', startDate.toISOString())
                    .lte('transaction_date', endDate.toISOString());

                if (!txError && txs) {
                    operatingExpenses = txs.reduce((sum, t) => sum + t.amount, 0);
                }
            } else {
                const localTxs = JSON.parse(localStorage.getItem('cash-transactions') || '[]');
                operatingExpenses = localTxs
                    .filter((t: any) =>
                        t.type === 'expense' &&
                        t.is_accounting === true &&
                        new Date(t.transaction_date) >= startDate &&
                        new Date(t.transaction_date) <= endDate
                    )
                    .reduce((sum: any, t: any) => sum + t.amount, 0);
            }

            // 6. Total Summaries
            const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
            const totalOrders = orders?.length || 0;
            const grossProfit = totalProfitCalc; // Lợi nhuận gộp
            const netProfit = grossProfit - operatingExpenses; // Lợi nhuận ròng

            // 7. Payment Breakdown
            const paymentBreakdown = {
                cash: orders?.reduce((sum, o) => sum + (o.cash_received || 0), 0) || 0,
                transfer: orders?.reduce((sum, o) => sum + (o.transfer_amount || 0), 0) || 0,
                card: orders?.reduce((sum, o) => sum + (o.card_amount || 0), 0) || 0,
                debt: orders?.reduce((sum, o) => sum + (o.debt_amount || 0), 0) || 0,
                points: orders?.reduce((sum, o) => sum + (o.points_discount || 0), 0) || 0
            };

            set({
                dailyRevenue,
                topProducts,
                recentOrders,
                totalRevenue,
                totalProfit: netProfit, // We expose Net Profit as the main profit metric? Or stick to Gross and add fields?
                // Let's keep totalProfit as Gross for backwards compat or clarify. 
                // Creating new fields in interface is safer.
                grossProfit,
                totalExpenses: operatingExpenses,
                netProfit,
                totalOrders,
                paymentBreakdown,
                loading: false
            });

        } catch (error) {
            console.error('Error fetching reports:', error);
            set({ error: 'Không thể tải báo cáo', loading: false });
        }
    }
}));
