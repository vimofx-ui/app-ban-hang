
import React, { useMemo } from 'react';
import type { GhostScanEntry } from '@/lib/ghostScan';
import { cn } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface SecurityStatsWidgetProps {
    logs: Array<GhostScanEntry & { created_at: string }>;
}

export function SecurityStatsWidget({ logs }: SecurityStatsWidgetProps) {
    // Calculate Stats
    const stats = useMemo(() => {
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));

        const todayLogs = logs.filter(l => new Date(l.created_at) >= startOfDay);
        const highRiskLogs = logs.filter(l => (l.risk_score || 0) >= 60);
        const criticalLogs = logs.filter(l => (l.risk_score || 0) >= 90);

        // Chart Data (Last 7 Days)
        const chartData = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);

            const dayStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

            const dayLogs = logs.filter(l => {
                const logDate = new Date(l.created_at);
                logDate.setHours(0, 0, 0, 0);
                return logDate.getTime() === d.getTime();
            });

            const dayScore = dayLogs.reduce((sum, l) => sum + (l.risk_score || 0), 0);
            chartData.push({ name: dayStr, score: dayScore, count: dayLogs.length });
        }

        return {
            todayCount: todayLogs.length,
            highRiskCount: highRiskLogs.length,
            criticalCount: criticalLogs.length,
            chartData
        };
    }, [logs]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Stat Cards */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase">Hôm nay</p>
                <div className="flex items-end justify-between">
                    <h3 className="text-2xl font-bold text-gray-900">{stats.todayCount}</h3>
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">Sự kiện</span>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase">Rủi ro cao (30 ngày)</p>
                <div className="flex items-end justify-between">
                    <h3 className={cn("text-2xl font-bold", stats.highRiskCount > 0 ? "text-orange-600" : "text-gray-900")}>
                        {stats.highRiskCount}
                    </h3>
                    <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-full">Cảnh báo</span>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase">Nghiêm trọng</p>
                <div className="flex items-end justify-between">
                    <h3 className={cn("text-2xl font-bold", stats.criticalCount > 0 ? "text-red-600" : "text-gray-900")}>
                        {stats.criticalCount}
                    </h3>
                    <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full">Critical</span>
                </div>
            </div>

            {/* Chart (Mini) */}
            <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                <p className="absolute top-2 left-4 text-xs font-semibold text-gray-500 uppercase z-10">Xu hướng rủi ro</p>
                <div className="h-[60px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.chartData}>
                            <defs>
                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="score" stroke="#ef4444" fillOpacity={1} fill="url(#colorScore)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
