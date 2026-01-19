
// =============================================================================
// SECURITY EMPLOYEE PAGE - Employee Risk Profiling of Analysis
// =============================================================================

import React, { useState, useEffect } from 'react';
import { getEmployeeRiskStats, getEmployeeDetailLogs, type EmployeeRiskStats, type GhostScanEntry } from '@/lib/ghostScan';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export function SecurityEmployeePage() {
    const [stats, setStats] = useState<EmployeeRiskStats[]>([]);
    const [loading, setLoading] = useState(true);

    // Date Filters
    const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today'); // Default today
    const [customStart, setCustomStart] = useState<string>(new Date().toISOString().split('T')[0]);
    const [customEnd, setCustomEnd] = useState<string>(new Date().toISOString().split('T')[0]);

    // Modal state
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRiskStats | null>(null);
    const [detailLogs, setDetailLogs] = useState<GhostScanEntry[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        loadStats();
    }, [dateFilter, customStart, customEnd]);

    const getDateRange = () => {
        const start = new Date();
        const end = new Date();
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        if (dateFilter === 'yesterday') {
            start.setDate(start.getDate() - 1);
            end.setDate(end.getDate() - 1);
        } else if (dateFilter === 'week') {
            start.setDate(start.getDate() - 7);
        } else if (dateFilter === 'month') {
            start.setDate(start.getDate() - 30);
        } else if (dateFilter === 'custom') {
            return {
                start: new Date(customStart + 'T00:00:00'),
                end: new Date(customEnd + 'T23:59:59')
            };
        }
        return { start, end };
    };

    const loadStats = async () => {
        setLoading(true);
        const { start, end } = getDateRange();
        // Pass to standard function which merges Supabase & Local
        const data = await getEmployeeRiskStats(start, end);
        setStats(data);
        setLoading(false);
    };

    const handleViewDetails = async (employee: EmployeeRiskStats) => {
        setSelectedEmployee(employee);
        setIsModalOpen(true);
        setLoadingDetails(true);
        try {
            const { start, end } = getDateRange();
            const logs = await getEmployeeDetailLogs(employee.userId, start, end);
            setDetailLogs(logs);
        } catch (e) {
            console.error("Failed to load details", e);
        } finally {
            setLoadingDetails(false);
        }
    };

    const getRiskLabel = (level: string) => {
        if (level === 'high') return { label: 'Rủi ro cao', color: 'bg-red-100 text-red-700 border-red-200', icon: '🚨' };
        if (level === 'warning') return { label: 'Cần chú ý', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: '⚠️' };
        return { label: 'An toàn', color: 'bg-green-100 text-green-700 border-green-200', icon: '✅' };
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="container-app py-4">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Giám sát nhân viên</h1>
                                <p className="text-sm text-gray-500">
                                    Đánh giá rủi ro và hiệu suất tài chính theo thời gian thực
                                </p>
                            </div>
                            <button
                                onClick={loadStats}
                                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                🔄 Reload
                            </button>
                        </div>

                        {/* Date Filters */}
                        <div className="flex flex-wrap items-center gap-2">
                            {[
                                { id: 'today', label: 'Hôm nay' },
                                { id: 'yesterday', label: 'Hôm qua' },
                                { id: 'week', label: 'Tuần này' },
                                { id: 'month', label: 'Tháng này' }
                            ].map((f) => (
                                <button
                                    key={f.id}
                                    onClick={() => setDateFilter(f.id as any)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                                        dateFilter === f.id
                                            ? "bg-gray-900 text-white shadow-md"
                                            : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                                    )}
                                >
                                    {f.label}
                                </button>
                            ))}

                            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-gray-200 ml-2">
                                <span className="text-xs text-gray-500 font-medium">Tùy chọn:</span>
                                <input
                                    type="date"
                                    value={customStart}
                                    onChange={(e) => {
                                        setCustomStart(e.target.value);
                                        setDateFilter('custom');
                                    }}
                                    className="text-xs border-none p-0 focus:ring-0 text-gray-700 w-24"
                                />
                                <span className="text-gray-300">-</span>
                                <input
                                    type="date"
                                    value={customEnd}
                                    onChange={(e) => {
                                        setCustomEnd(e.target.value);
                                        setDateFilter('custom');
                                    }}
                                    className="text-xs border-none p-0 focus:ring-0 text-gray-700 w-24"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container-app py-6">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Đang tải dữ liệu Analysis...</div>
                ) : stats.length === 0 ? (
                    <div className="text-center py-12 flex flex-col items-center justify-center p-8 bg-white rounded-xl border border-dashed border-gray-300">
                        <span className="text-4xl mb-3">🛡️</span>
                        <p className="text-lg font-medium text-gray-900">Không có dữ liệu rủi ro</p>
                        <p className="text-sm text-gray-500">Chưa ghi nhận vi phạm nào trong khoảng thời gian này</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {stats.map((stat) => {
                            const badge = getRiskLabel(stat.riskLevel);
                            const voidRate = stat.potentialRevenue > 0
                                ? (stat.totalVoidValue / stat.potentialRevenue) * 100
                                : 0;

                            return (
                                <div key={stat.userId} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all overflow-hidden flex flex-col">
                                    <div className="p-5 flex-1">
                                        <div className="flex items-start justify-between mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 font-bold text-lg border-2 border-white shadow-sm">
                                                    {stat.fullName?.slice(0, 2).toUpperCase() || 'NV'}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 text-lg leading-tight">{stat.fullName}</h3>
                                                    <p className="text-xs text-gray-500 truncate max-w-[150px] mt-0.5">{stat.email}</p>
                                                </div>
                                            </div>
                                            <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-sm", badge.color)}>
                                                {badge.icon} {badge.label}
                                            </span>
                                        </div>

                                        {/* Key Metrics */}
                                        <div className="grid grid-cols-2 gap-4 mb-6">
                                            <div className="p-3 bg-gray-50 rounded-lg">
                                                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Risk Score</p>
                                                <p className={cn("text-2xl font-black mt-1", stat.totalRiskScore > 50 ? 'text-red-600' : 'text-gray-900')}>
                                                    {stat.totalRiskScore}
                                                </p>
                                            </div>
                                            <div className="p-3 bg-gray-50 rounded-lg">
                                                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Tỷ lệ hủy</p>
                                                <p className={cn("text-2xl font-black mt-1", voidRate > 10 ? 'text-red-600' : 'text-gray-900')}>
                                                    {voidRate.toFixed(1)}%
                                                </p>
                                            </div>
                                        </div>

                                        {/* Financial Breakdown */}
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                                                <span className="text-gray-600">Doanh số (Đã bán)</span>
                                                <span className="font-bold text-green-700">
                                                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stat.totalRevenue)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                                                <span className="text-gray-600">Tiềm năng (Đã thêm)</span>
                                                <span className="font-medium text-gray-900">
                                                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stat.potentialRevenue)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm pb-1">
                                                <span className="text-gray-600">Giá trị hủy (Risk)</span>
                                                <span className="font-bold text-red-600">
                                                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stat.totalVoidValue)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Violation Breakdown Badges */}
                                        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                                            {stat.highRiskCount > 0 && (
                                                <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100">
                                                    {stat.highRiskCount} High
                                                </span>
                                            )}
                                            {stat.mediumRiskCount > 0 && (
                                                <span className="text-[10px] font-bold bg-orange-50 text-orange-600 px-2 py-1 rounded border border-orange-100">
                                                    {stat.mediumRiskCount} Med
                                                </span>
                                            )}
                                            {stat.lowRiskCount > 0 && (
                                                <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">
                                                    {stat.lowRiskCount} Low
                                                </span>
                                            )}
                                            {stat.violationCount === 0 && (
                                                <span className="text-[10px] font-bold bg-gray-50 text-gray-500 px-2 py-1 rounded border border-gray-100">
                                                    Không vi phạm
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleViewDetails(stat)}
                                        className="w-full py-3 bg-gray-50 border-t border-gray-200 text-sm font-semibold text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center justify-center gap-1 group"
                                    >
                                        Xem chi tiết hoạt động
                                        <span className="block transition-transform group-hover:translate-x-1">→</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Detail Modal */}
            {isModalOpen && selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50 shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    Chi tiết hoạt động: {selectedEmployee.fullName}
                                    <span className={cn("text-xs px-2 py-0.5 rounded-full border", getRiskLabel(selectedEmployee.riskLevel).color)}>
                                        {getRiskLabel(selectedEmployee.riskLevel).label}
                                    </span>
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    {loadingDetails ? 'Đang tải dữ liệu...' : `${detailLogs.length} hành động được ghi nhận`}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-0 bg-gray-50/50">
                            {loadingDetails ? (
                                <div className="p-12 text-center text-gray-500">Đang tải chi tiết...</div>
                            ) : detailLogs.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">Không có log chi tiết nào.</div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {detailLogs.map((log: any, idx) => {
                                        // Helper to render session details if available
                                        const isSession = log.action_type === 'order_session_summary';
                                        let events = [];
                                        let removedItems = [];

                                        if (isSession) {
                                            const newValue = typeof log.new_value === 'string' ? JSON.parse(log.new_value) : log.new_value;
                                            const oldValue = typeof log.old_value === 'string' ? JSON.parse(log.old_value) : log.old_value;
                                            events = newValue?.session_events || newValue?.events || [];
                                            removedItems = oldValue?.removedItems || [];
                                        }

                                        return (
                                            <div key={idx} className="bg-white p-4 hover:bg-blue-50/30 transition-colors">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-2xl pt-1">
                                                            {log.action_type === 'order_session_summary' ? '📋' :
                                                                log.action_type === 'cart_cleared' ? '🗑️' :
                                                                    log.action_type === 'void_item' ? '⚠️' : 'ℹ️'}
                                                        </span>
                                                        <div>
                                                            <p className="font-semibold text-gray-900">
                                                                {log.reason || log.action_type}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                {format(new Date(log.created_at), 'HH:mm:ss dd/MM/yyyy', { locale: vi })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        {log.risk_score > 0 && (
                                                            <span className={cn(
                                                                "px-2 py-0.5 rounded text-[10px] font-bold uppercase block w-fit ml-auto mb-1",
                                                                log.risk_score >= 60 ? "bg-red-100 text-red-700" :
                                                                    log.risk_score >= 30 ? "bg-orange-100 text-orange-700" :
                                                                        "bg-blue-100 text-blue-700"
                                                            )}>
                                                                Risk: {log.risk_score}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Expanded Details for Session Logs */}
                                                {isSession && events.length > 0 && (
                                                    <div className="mt-3 ml-10 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                                                        <h4 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wider">Timeline Phiên Đơn Hàng</h4>
                                                        <div className="space-y-2 relative border-l-2 border-gray-200 ml-1 pl-4 my-2">
                                                            {events.map((evt: any, i: number) => (
                                                                <div key={i} className="relative">
                                                                    <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-gray-300 border-2 border-white"></div>
                                                                    <p className="text-gray-800">
                                                                        <span className="text-xs text-gray-500 font-mono mr-2">
                                                                            {format(new Date(evt.time), 'HH:mm:ss')}
                                                                        </span>
                                                                        {evt.description}
                                                                        {evt.valueDiff !== 0 && (
                                                                            <span className={cn("ml-2 font-mono text-xs", evt.valueDiff > 0 ? "text-green-600" : "text-red-500")}>
                                                                                {evt.valueDiff > 0 ? '+' : ''}{new Intl.NumberFormat('vi-VN').format(evt.valueDiff)}
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {removedItems.length > 0 && (
                                                            <div className="mt-3 pt-3 border-t border-gray-200">
                                                                <p className="text-xs font-bold text-red-600 mb-1">Đã xóa {removedItems.length} món:</p>
                                                                <ul className="list-disc list-inside text-xs text-gray-600">
                                                                    {removedItems.map((item: any, k: number) => (
                                                                        <li key={k} className="line-through decoration-red-400">{item.productName} (x{item.quantity}) - {item.reason}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-200 bg-white">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SecurityEmployeePage;
