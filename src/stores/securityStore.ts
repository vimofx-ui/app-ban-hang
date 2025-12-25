import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { AuditActionType } from '@/types';
import { getAuditLogsByDate } from '@/lib/ghostScan';
import { useOrderStore } from '@/stores/orderStore';

export interface SecurityLog {
    id: string;
    created_at: string;
    action_type: AuditActionType;
    entity_type: string;
    entity_id?: string;
    old_value?: any;
    new_value?: any;
    reason?: string;
    shift_id?: string;
    order_id?: string;
    product_id?: string;
    user_id?: string;
    user?: {
        full_name: string;
        email: string;
        avatar_url: string | null;
    };
}

export interface EmployeeSecurityStat {
    userId: string;
    userName: string;
    totalOrders: number;
    suspiciousActs: number;
    deletionRate: number; // percentage
    riskLevel: 'low' | 'medium' | 'high';
    lastIncident?: string;
}

export interface SecurityStats {
    totalSuspicious: number;
    totalOrders: number;
    fraudPercentage: number;
    suspiciousByDay: Record<string, number>;
    employeeStats: EmployeeSecurityStat[];
}

interface SecurityState {
    logs: SecurityLog[];
    stats: SecurityStats;
    loading: boolean;
    error: string | null;

    fetchLogs: (startDate: Date, endDate: Date) => Promise<void>;
}

export const useSecurityStore = create<SecurityState>((set) => ({
    logs: [],
    stats: {
        totalSuspicious: 0,
        totalOrders: 0,
        fraudPercentage: 0,
        suspiciousByDay: {},
        employeeStats: [],
    },
    loading: false,
    error: null,

    fetchLogs: async (startDate: Date, endDate: Date) => {
        set({ loading: true, error: null });
        try {
            // 1. Fetch Audit Logs (Supabase OR Local)
            const logsData = await getAuditLogsByDate(startDate, endDate);

            // 2. Fetch Orders (Supabase OR Local)
            // Use orderStore to handle offline/online sync logic
            const orderStore = useOrderStore.getState();
            if (orderStore.orders.length === 0) {
                await orderStore.loadOrders();
            }

            // Filter orders by date range in memory
            const startISO = startDate.toISOString();
            const endISO = endDate.toISOString();

            const ordersData = orderStore.orders.filter(o =>
                o.status === 'completed' &&
                o.created_at >= startISO &&
                o.created_at <= endISO
            ).map(o => ({ user_id: o.created_by, status: o.status })); // Minify data

            // 3. Process Stats
            const suspiciousActions = ['ghost_scan', 'cart_cleared', 'price_edit'];
            const suspiciousLogs = (logsData || []).filter(log =>
                suspiciousActions.includes(log.action_type)
            );

            const totalSuspicious = suspiciousLogs.length;
            const totalOrders = ordersData.length;
            const fraudPercentage = totalOrders > 0
                ? (totalSuspicious / totalOrders) * 100
                : 0;

            // Group by Day
            const suspiciousByDay: Record<string, number> = {};
            suspiciousLogs.forEach(log => {
                const day = new Date(log.created_at).toLocaleDateString('vi-VN');
                suspiciousByDay[day] = (suspiciousByDay[day] || 0) + 1;
            });

            // Group by Employee
            const employeeMap = new Map<string, {
                userId: string;
                userName: string;
                orders: number;
                suspicious: number;
                lastIncident?: string;
            }>();

            // Init from orders
            ordersData.forEach(order => {
                if (!order.user_id) return;
                if (!employeeMap.has(order.user_id)) {
                    employeeMap.set(order.user_id, {
                        userId: order.user_id,
                        userName: 'Unknown Staff',
                        orders: 0,
                        suspicious: 0
                    });
                }
                const stat = employeeMap.get(order.user_id)!;
                stat.orders++;
            });

            // Aggregate suspicious acts
            logsData.forEach(log => {
                const userId = log.user_id || 'unknown'; // Handle missing user_id
                if (!suspiciousActions.includes(log.action_type)) return;

                if (!employeeMap.has(userId)) {
                    employeeMap.set(userId, {
                        userId: userId,
                        userName: log.user?.full_name || 'Unknown',
                        orders: 0,
                        suspicious: 0
                    });
                }
                const stat = employeeMap.get(userId)!;
                stat.suspicious++;
                if (log.user?.full_name) stat.userName = log.user.full_name;

                if (!stat.lastIncident || new Date(log.created_at) > new Date(stat.lastIncident)) {
                    stat.lastIncident = log.created_at;
                }
            });

            // Calculate Metrics
            const employeeStats: EmployeeSecurityStat[] = Array.from(employeeMap.values()).map(stat => {
                const deletionRate = stat.orders > 0 ? (stat.suspicious / stat.orders) * 100 : 0;

                let riskLevel: 'low' | 'medium' | 'high' = 'low';
                if (deletionRate > 10 || stat.suspicious > 20) riskLevel = 'high';
                else if (deletionRate > 5 || stat.suspicious > 5) riskLevel = 'medium';

                return {
                    userId: stat.userId,
                    userName: stat.userName,
                    totalOrders: stat.orders,
                    suspiciousActs: stat.suspicious,
                    deletionRate,
                    riskLevel,
                    lastIncident: stat.lastIncident
                };
            }).sort((a, b) => {
                const riskScore = { high: 3, medium: 2, low: 1 };
                if (riskScore[b.riskLevel] !== riskScore[a.riskLevel]) {
                    return riskScore[b.riskLevel] - riskScore[a.riskLevel];
                }
                return b.deletionRate - a.deletionRate;
            });

            set({
                logs: logsData as SecurityLog[],
                stats: {
                    totalSuspicious,
                    totalOrders,
                    fraudPercentage,
                    suspiciousByDay,
                    employeeStats
                },
                loading: false
            });

        } catch (err: any) {
            console.error('Failed to fetch security logs:', err);
            set({ error: err.message, loading: false });
        }
    }
}));
