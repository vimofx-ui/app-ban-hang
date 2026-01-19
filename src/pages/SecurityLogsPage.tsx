
// =============================================================================
// SECURITY LOGS PAGE - Ghost Scan and Audit Logs (v3 - Enhanced Detail)
// =============================================================================

import { useState, useEffect, useMemo } from 'react';
import { getAuditLogsByDate, type GhostScanEntry } from '@/lib/ghostScan';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type AuditLogEntry = GhostScanEntry & {
    id: string;
    created_at: string;
    user?: {
        full_name?: string;
        email?: string;
    };
};

export function SecurityLogsPage() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');
    const [riskFilter, setRiskFilter] = useState<boolean>(false);
    const [employeeFilter, setEmployeeFilter] = useState<string>('all');

    // Date Filters
    const [dateMode, setDateMode] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('week'); // Default: week for more data
    const [customStart, setCustomStart] = useState<string>(new Date().toISOString().split('T')[0]);
    const [customEnd, setCustomEnd] = useState<string>(new Date().toISOString().split('T')[0]);

    const [isHelpOpen, setIsHelpOpen] = useState(false);

    useEffect(() => {
        loadLogs();
    }, [dateMode, customStart, customEnd]);

    const getDateRange = () => {
        const start = new Date();
        const end = new Date();
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        if (dateMode === 'yesterday') {
            start.setDate(start.getDate() - 1);
            end.setDate(end.getDate() - 1);
        } else if (dateMode === 'week') {
            start.setDate(start.getDate() - 7);
        } else if (dateMode === 'month') {
            start.setDate(start.getDate() - 30);
        } else if (dateMode === 'custom') {
            return {
                start: new Date(customStart + 'T00:00:00'),
                end: new Date(customEnd + 'T23:59:59')
            };
        }
        return { start, end };
    };

    const loadLogs = async () => {
        setLoading(true);
        try {
            const { start, end } = getDateRange();
            const data = await getAuditLogsByDate(start, end);
            setLogs(data as AuditLogEntry[]);
        } catch (e) {
            console.error('Failed to load logs', e);
            setLogs([]);
        }
        setLoading(false);
    };

    // Get unique employees for filter dropdown
    const employees = useMemo(() => {
        const map = new Map<string, string>();
        logs.forEach(log => {
            if (log.user_id && log.user) {
                map.set(log.user_id, log.user.full_name || log.user.email || log.user_id);
            } else if (log.user_id) {
                map.set(log.user_id, 'Nhân viên ' + log.user_id.slice(0, 6));
            }
        });
        return Array.from(map.entries());
    }, [logs]);

    // Advanced Filtering & Deduplication
    const processedLogs = useMemo(() => {
        let filtered = logs;

        // 1. Employee Filter
        if (employeeFilter !== 'all') {
            filtered = filtered.filter(l => l.user_id === employeeFilter);
        }

        // 2. Risk Filter
        if (riskFilter) {
            filtered = filtered.filter(l => (l.risk_score || 0) >= 30);
        }

        // 3. Type Filter
        if (filter !== 'all') {
            filtered = filtered.filter(l => l.action_type === filter);
        }

        // 4. Deduplicate/grouping: Hide atomic logs covered by session summary
        const sessionLogs = filtered.filter(l => l.action_type === 'order_session_summary');
        const sessionWindows = sessionLogs.map(l => {
            const oldVal = typeof l.old_value === 'string' ? JSON.parse(l.old_value) : l.old_value;
            const newVal = typeof l.new_value === 'string' ? JSON.parse(l.new_value) : l.new_value;
            const start = oldVal?.sessionStartTime ? new Date(oldVal.sessionStartTime).getTime() : 0;
            const end = newVal?.sessionEndTime ? new Date(newVal.sessionEndTime).getTime() : new Date(l.created_at).getTime();
            return { userId: l.user_id, start, end };
        });

        if (filter === 'all' || ['ghost_scan', 'cart_cleared', 'item_removed', 'void_item'].includes(filter)) {
            filtered = filtered.filter(log => {
                if (log.action_type === 'order_session_summary') return true;
                const logTime = new Date(log.created_at).getTime();
                const isCovered = sessionWindows.some(window =>
                    window.userId === log.user_id &&
                    logTime >= window.start &&
                    logTime <= window.end + 2000
                );
                return !isCovered;
            });
        }

        return filtered;
    }, [logs, employeeFilter, riskFilter, filter]);

    // Stats Calculation
    const summaryStats = useMemo(() => {
        return processedLogs.reduce((acc, log) => {
            if (log.action_type === 'order_session_summary') {
                const oldValue = typeof log.old_value === 'string' ? JSON.parse(log.old_value) : log.old_value;
                const newValue = typeof log.new_value === 'string' ? JSON.parse(log.new_value) : log.new_value;
                acc.voidValue += Number((oldValue as any)?.void_value || 0);
                acc.actualRevenue += Number((newValue as any)?.final_value || 0);
            }
            return acc;
        }, { voidValue: 0, actualRevenue: 0 });
    }, [processedLogs]);

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="container-app py-3 md:py-4">
                    <div className="flex flex-col gap-3 md:gap-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                            <div>
                                <h1 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
                                    📋 Nhật ký rủi ro
                                    <button
                                        onClick={() => setIsHelpOpen(true)}
                                        className="text-gray-400 hover:text-blue-600 transition-colors"
                                        title="Hướng dẫn"
                                    >
                                        <InfoIcon className="w-5 h-5" />
                                    </button>
                                </h1>
                                <p className="text-xs md:text-sm text-gray-500">
                                    Chi tiết từng hành động: Thêm, Giảm, Xóa sản phẩm
                                </p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => setRiskFilter(!riskFilter)}
                                    className={cn(
                                        "px-2 md:px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5",
                                        riskFilter
                                            ? "bg-red-50 border-red-200 text-red-700 shadow-sm"
                                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                                    )}
                                >
                                    {riskFilter ? '🔥 Rủi ro cao' : '🛡️ Lọc Rủi ro'}
                                </button>
                                <button
                                    onClick={loadLogs}
                                    className="px-2 md:px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    🔄 Reload
                                </button>
                            </div>
                        </div>

                        {/* Date & Employee Filters */}
                        <div className="flex flex-col md:flex-row md:items-center gap-2">
                            <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0">
                                {[
                                    { id: 'today', label: 'Hôm nay' },
                                    { id: 'yesterday', label: 'Hôm qua' },
                                    { id: 'week', label: 'Tuần' },
                                    { id: 'month', label: 'Tháng' }
                                ].map((f) => (
                                    <button
                                        key={f.id}
                                        onClick={() => setDateMode(f.id as any)}
                                        className={cn(
                                            "px-2.5 py-1 rounded-full text-[10px] md:text-xs font-medium whitespace-nowrap transition-colors",
                                            dateMode === f.id
                                                ? "bg-gray-900 text-white shadow-md"
                                                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                                        )}
                                    >
                                        {f.label}
                                    </button>
                                ))}

                                <div className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                                    <input
                                        type="date"
                                        value={customStart}
                                        onChange={(e) => { setCustomStart(e.target.value); setDateMode('custom'); }}
                                        className="text-[10px] md:text-xs border-none p-0 focus:ring-0 text-gray-700 w-20 md:w-24 bg-transparent"
                                    />
                                    <span className="text-gray-300 text-xs">-</span>
                                    <input
                                        type="date"
                                        value={customEnd}
                                        onChange={(e) => { setCustomEnd(e.target.value); setDateMode('custom'); }}
                                        className="text-[10px] md:text-xs border-none p-0 focus:ring-0 text-gray-700 w-20 md:w-24 bg-transparent"
                                    />
                                </div>
                            </div>

                            {/* Employee Filter Dropdown */}
                            <div className="flex items-center gap-2 md:ml-auto">
                                <span className="text-xs text-gray-500 font-medium hidden md:inline">👤 NV:</span>
                                <select
                                    value={employeeFilter}
                                    onChange={(e) => setEmployeeFilter(e.target.value)}
                                    className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-w-[120px]"
                                >
                                    <option value="all">Tất cả nhân viên</option>
                                    {employees.map(([id, name]) => (
                                        <option key={id} value={id}>{name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container-app py-4 md:py-6">

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
                    <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                        <div>
                            <p className="text-[10px] md:text-xs text-gray-500 font-semibold uppercase">Doanh Thu Thực Tế</p>
                            <p className="text-lg md:text-2xl font-bold text-green-700 mt-0.5 md:mt-1">
                                {formatCurrency(summaryStats.actualRevenue)}
                            </p>
                        </div>
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-green-50 rounded-full flex items-center justify-center">
                            <span className="text-green-600 text-lg md:text-xl">💰</span>
                        </div>
                    </div>
                    <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                        <div>
                            <p className="text-[10px] md:text-xs text-gray-500 font-semibold uppercase">Giá Trị Hủy/Mất</p>
                            <p className="text-lg md:text-2xl font-bold text-red-600 mt-0.5 md:mt-1">
                                {formatCurrency(summaryStats.voidValue)}
                            </p>
                        </div>
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-red-50 rounded-full flex items-center justify-center">
                            <span className="text-red-600 text-lg md:text-xl">📉</span>
                        </div>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-1.5 md:gap-2 mb-4 md:mb-6 overflow-x-auto pb-1">
                    {[
                        { value: 'all', label: 'Tất cả' },
                        { value: 'order_session_summary', label: '📋 Phiên Đơn' },
                        { value: 'delete_draft_order', label: '🚫 Xóa đơn chờ' },
                        { value: 'ghost_scan', label: '👻 Ghost Scan' },
                        { value: 'price_edit', label: '💰 Sửa giá' },
                        { value: 'void_item', label: '📉 Giảm SL' },
                    ].map((f) => (
                        <button
                            key={f.value}
                            onClick={() => setFilter(f.value)}
                            className={cn(
                                'px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-medium whitespace-nowrap transition-colors border',
                                filter === f.value
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Logs List */}
                {loading ? (
                    <div className="space-y-3 md:space-y-4 animate-pulse">
                        {[1, 2, 3].map(i => <div key={i} className="h-20 md:h-24 bg-gray-200 rounded-xl"></div>)}
                    </div>
                ) : processedLogs.length === 0 ? (
                    <div className="text-center py-8 md:py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                        <ShieldIcon className="w-10 h-10 md:w-12 md:h-12 text-gray-300 mx-auto mb-2 md:mb-3" />
                        <h3 className="text-sm md:text-base font-semibold text-gray-900">Không có dữ liệu</h3>
                        <p className="text-xs md:text-sm text-gray-500">Trong khoảng thời gian này không có ghi nhận nào.</p>
                        <p className="text-xs text-gray-400 mt-2">Hãy thử chọn khoảng thời gian rộng hơn (Tuần, Tháng).</p>
                    </div>
                ) : (
                    <div className="space-y-2 md:space-y-3">
                        {processedLogs.map((log) => (
                            <LogEntry key={log.id} log={log} />
                        ))}
                    </div>
                )}
            </main>

            {/* Help Modal */}
            {isHelpOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 md:p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
                        <div className="p-4 md:p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                            <h2 className="text-lg md:text-xl font-bold text-gray-900">Hướng dẫn đọc Log Bảo Mật</h2>
                            <button onClick={() => setIsHelpOpen(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-full w-8 h-8 flex items-center justify-center transition-colors font-bold">✕</button>
                        </div>
                        <div className="p-4 md:p-6 overflow-y-auto space-y-6 md:space-y-8 text-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-3 md:mb-4 flex items-center gap-2 border-b pb-2">🎯 Mức Độ Rủi Ro</h3>
                                    <div className="space-y-2 md:space-y-3 text-xs md:text-sm">
                                        <div className="flex items-start gap-2 md:gap-3">
                                            <span className="px-2 md:px-3 py-1 rounded text-[10px] md:text-xs font-bold bg-green-100 text-green-700 border border-green-200 w-16 md:w-20 text-center shrink-0">SAFE</span>
                                            <span className="text-gray-600">Hành động bình thường.</span>
                                        </div>
                                        <div className="flex items-start gap-2 md:gap-3">
                                            <span className="px-2 md:px-3 py-1 rounded text-[10px] md:text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200 w-16 md:w-20 text-center shrink-0">MEDIUM</span>
                                            <span className="text-gray-600">Cần chú ý. Giảm số lượng, sửa giá.</span>
                                        </div>
                                        <div className="flex items-start gap-2 md:gap-3">
                                            <span className="px-2 md:px-3 py-1 rounded text-[10px] md:text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200 w-16 md:w-20 text-center shrink-0">HIGH</span>
                                            <span className="text-gray-600">Rủi ro cao. Ghost Scan: In tạm → Xóa món.</span>
                                        </div>
                                        <div className="flex items-start gap-2 md:gap-3">
                                            <span className="px-2 md:px-3 py-1 rounded text-[10px] md:text-xs font-bold bg-red-100 text-red-700 border border-red-200 w-16 md:w-20 text-center shrink-0">CRITICAL</span>
                                            <span className="text-gray-600">Nghiêm trọng. Xóa toàn bộ đơn sau khi in.</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-3 md:mb-4 flex items-center gap-2 border-b pb-2">📝 Thuật ngữ</h3>
                                    <ul className="list-disc list-inside text-xs md:text-sm text-gray-600 space-y-1.5 md:space-y-2">
                                        <li><strong>Phiên Đơn Hàng:</strong> Gom nhóm hành động trong 1 lượt phục vụ.</li>
                                        <li><strong>Ghost Scan:</strong> Thêm món → In tạm → Xóa trước thanh toán.</li>
                                        <li><strong>Xóa đơn nháp:</strong> Hủy đơn chờ (đơn lưu), mất doanh thu.</li>
                                        <li><strong>Giảm SL:</strong> Giảm số lượng nhưng KHÔNG xóa hẳn sản phẩm.</li>
                                        <li><strong>Xóa SP:</strong> Xóa hoàn toàn sản phẩm khỏi đơn.</li>
                                    </ul>
                                </div>
                            </div>
                            <div className="bg-blue-50 p-3 md:p-4 rounded-xl border border-blue-100">
                                <h4 className="font-bold text-blue-800 text-xs md:text-sm mb-1.5 md:mb-2">💡 Mẹo</h4>
                                <p className="text-xs md:text-sm text-blue-700">Tập trung kiểm tra các thẻ <span className="font-bold text-orange-600">HIGH</span> hoặc <span className="font-bold text-red-600">CRITICAL</span>. Bấm vào để xem Timeline chi tiết.</p>
                            </div>
                        </div>
                        <div className="p-3 md:p-4 bg-gray-50 border-t border-gray-100 shrink-0">
                            <button onClick={() => setIsHelpOpen(false)} className="w-full py-2.5 md:py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-200 text-sm md:text-base">Đã hiểu</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function LogEntry({ log }: { log: AuditLogEntry }) {
    const [expanded, setExpanded] = useState(false);

    // Parse Values
    const oldValue: any = typeof log.old_value === 'string' ? JSON.parse(log.old_value) : log.old_value || {};
    const newValue: any = typeof log.new_value === 'string' ? JSON.parse(log.new_value) : log.new_value || {};
    const events: any[] = newValue?.session_events || [];
    const removedItems: any[] = oldValue?.removed_items || [];

    const getRiskInfo = (score?: number) => {
        if (!score || score < 30) return null;
        if (score >= 90) return { label: 'CRITICAL', color: 'bg-red-600 text-white' };
        if (score >= 60) return { label: 'HIGH', color: 'bg-orange-500 text-white' };
        if (score >= 30) return { label: 'MEDIUM', color: 'bg-yellow-500 text-white' };
        return null;
    };

    const riskInfo = getRiskInfo(log.risk_score);
    const userName = log.user?.full_name || log.user?.email || 'Nhân viên';
    const actionLabel = getActionTypeLabel(log.action_type);
    const isSession = log.action_type === 'order_session_summary';
    const isDraftDelete = log.action_type === 'delete_draft_order';

    // Get description based on action type
    const getDescription = () => {
        if (isSession) {
            const voidValue = oldValue?.void_value || 0;
            return `Phiên kết thúc. Đã xóa/giảm ${removedItems.length} sản phẩm (${formatCurrency(voidValue)})`;
        }
        if (isDraftDelete) {
            return `Xóa đơn nháp/chờ. Lý do: ${log.reason || 'Không rõ'}`;
        }
        return log.reason || 'Hành động được ghi nhận';
    };

    return (
        <div className={cn(
            "bg-white rounded-xl border overflow-hidden transition-all duration-200",
            riskInfo ? "border-l-4 border-l-red-500 shadow-sm" : "border-gray-200 hover:border-blue-300",
            expanded ? "shadow-md ring-1 ring-blue-100" : ""
        )}>
            <div
                onClick={() => setExpanded(!expanded)}
                className="w-full p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
            >
                {/* Left: Badge & User */}
                <div className="flex items-center gap-2 md:gap-3 md:min-w-[200px]">
                    <div className={cn('px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold border whitespace-nowrap shadow-sm', getActionTypeColor(log.action_type))}>
                        {actionLabel}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs md:text-sm font-bold text-gray-900 truncate">{userName}</span>
                        <span className="text-[9px] md:text-[10px] text-gray-500">{format(new Date(log.created_at), 'HH:mm dd/MM')}</span>
                    </div>
                </div>

                {/* Middle: Content/Summary */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-0.5 md:gap-1">
                        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                            {riskInfo && (
                                <span className={cn("px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[10px] font-bold uppercase shrink-0", riskInfo.color)}>
                                    {riskInfo.label} ({log.risk_score})
                                </span>
                            )}
                            <span className="font-medium text-gray-800 text-xs md:text-sm truncate">
                                {getDescription()}
                            </span>
                        </div>
                        {log.order_id && log.order_id !== 'ABANDONED' && (
                            <span className="text-[9px] md:text-[10px] text-blue-600 font-mono">Mã ĐH: {log.order_id}</span>
                        )}
                    </div>
                </div>

                {/* Right: Expand Icon */}
                <ChevronIcon className={cn('w-4 h-4 md:w-5 md:h-5 text-gray-400 transition-transform duration-200 shrink-0 ml-auto', expanded && 'rotate-180 text-blue-500')} />
            </div>

            {/* EXPANDED CONTENT */}
            {expanded && (
                <div className="px-3 md:px-5 pb-3 md:pb-5 pt-2 border-t border-gray-100 bg-gray-50/30 animate-in slide-in-from-top-2 duration-200">

                    {isSession ? (
                        <div className="space-y-4 md:space-y-6 mt-2">
                            {/* 1. Financial Stats Row */}
                            <div className="flex gap-2 md:gap-4 overflow-x-auto pb-2">
                                <StatBox label="Tiềm năng" value={oldValue?.max_potential} color="gray" />
                                <StatBox label="Đã Hủy" value={oldValue?.void_value} color="red" />
                                <StatBox label="Thực thu" value={newValue?.final_value} color="green" />
                                <div className="ml-auto flex flex-col justify-center text-[10px] md:text-xs text-right text-gray-500 shrink-0">
                                    <span>Thời lượng: <strong>{newValue?.duration_minutes?.toFixed(1) || 0}m</strong></span>
                                    <span>Tỷ lệ hủy: <strong className={Number(newValue?.void_rate) > 10 ? 'text-red-500' : ''}>{newValue?.void_rate || 0}%</strong></span>
                                </div>
                            </div>

                            {/* 2. Removed/Reduced Items Table */}
                            {removedItems.length > 0 && (
                                <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                                    <div className="bg-gray-100 px-3 md:px-4 py-1.5 md:py-2 text-[10px] md:text-xs font-bold text-gray-700 border-b border-gray-200">
                                        🗑️ Sản phẩm đã xóa/giảm ({removedItems.length} món)
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs md:text-sm">
                                            <thead className="bg-gray-50 text-gray-600 text-[9px] md:text-[10px] uppercase">
                                                <tr>
                                                    <th className="px-2 md:px-3 py-1.5 text-left font-semibold">Sản phẩm</th>
                                                    <th className="px-2 py-1.5 text-center font-semibold">Loại</th>
                                                    <th className="px-2 py-1.5 text-center font-semibold hidden md:table-cell">Time Quét</th>
                                                    <th className="px-2 py-1.5 text-center font-semibold">Time Xóa</th>
                                                    <th className="px-2 py-1.5 text-center font-semibold hidden md:table-cell">SL Gốc</th>
                                                    <th className="px-2 py-1.5 text-center font-semibold">SL Giảm/Xóa</th>
                                                    <th className="px-2 py-1.5 text-right font-semibold">Giá trị</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {removedItems.map((item: any, idx: number) => {
                                                    const isRemoved = item.actionType === 'removed' || !item.actionType;
                                                    return (
                                                        <tr key={idx} className="hover:bg-gray-50">
                                                            <td className={cn("px-2 md:px-3 py-2 font-medium", isRemoved ? "text-red-700 line-through" : "text-orange-700")}>
                                                                {item.productName}
                                                            </td>
                                                            <td className="px-2 py-2 text-center">
                                                                <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", isRemoved ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700")}>
                                                                    {isRemoved ? 'Xóa' : 'Giảm'}
                                                                </span>
                                                            </td>
                                                            <td className="px-2 py-2 text-center text-gray-500 font-mono text-[10px] hidden md:table-cell">
                                                                {item.addedAt ? format(new Date(item.addedAt), 'HH:mm:ss') : '-'}
                                                            </td>
                                                            <td className="px-2 py-2 text-center text-gray-500 font-mono text-[10px]">
                                                                {format(new Date(item.removedAt), 'HH:mm:ss')}
                                                            </td>
                                                            <td className="px-2 py-2 text-center text-gray-700 font-mono hidden md:table-cell">
                                                                {item.originalQuantity || item.quantity}
                                                            </td>
                                                            <td className={cn("px-2 py-2 text-center font-mono font-bold", isRemoved ? "text-red-600" : "text-orange-600")}>
                                                                {isRemoved ? item.quantity : `-${item.quantity}`}
                                                            </td>
                                                            <td className="px-2 py-2 text-right text-red-700 font-bold text-[10px] md:text-xs">
                                                                {formatCurrency(item.totalPrice)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* 3. Detailed Timeline */}
                            {events.length > 0 && (
                                <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                                    <div className="bg-gray-100 px-3 md:px-4 py-1.5 md:py-2 text-[10px] md:text-xs font-bold text-gray-700 border-b border-gray-200 flex justify-between">
                                        <span>📋 Timeline phiên làm việc</span>
                                        <span className="text-gray-500 font-normal">{userName}</span>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute left-4 md:left-6 top-4 bottom-4 w-0.5 bg-gray-200 z-0"></div>
                                        <div className="space-y-0">
                                            {events.map((ev: any, idx: number) => {
                                                const isVoid = ev.type === 'remove_item' || ev.type === 'void_item' || ev.type === 'clear_cart' || ev.type === 'reduce_quantity';
                                                return (
                                                    <div key={idx} className="relative z-10 flex items-start gap-2 md:gap-3 p-2 md:p-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 pl-3 md:pl-4">
                                                        <div className={cn(
                                                            "w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center text-[8px] md:text-[10px] shrink-0 mt-0.5 ring-2 ring-white",
                                                            isVoid ? "bg-red-100 text-red-600" :
                                                                ev.type === 'print_provisional' ? "bg-blue-100 text-blue-600" :
                                                                    ev.type === 'add_item' || ev.type === 'add_item_unit' ? "bg-green-100 text-green-600" :
                                                                        "bg-gray-100 text-gray-600"
                                                        )}>
                                                            {isVoid ? '🗑️' :
                                                                ev.type === 'print_provisional' ? '🖨️' :
                                                                    ev.type === 'add_item' || ev.type === 'add_item_unit' ? '➕' :
                                                                        ev.type === 'clear_cart' ? '🏁' : '•'}
                                                        </div>
                                                        <div className="flex-1 min-w-0 text-[10px] md:text-xs">
                                                            <div className="flex justify-between gap-2">
                                                                <span className={cn("font-medium truncate", isVoid ? "text-red-600" : "text-gray-900")}>
                                                                    {ev.description}
                                                                </span>
                                                                <span className="text-gray-400 font-mono text-[9px] md:text-[10px] shrink-0">
                                                                    {format(new Date(ev.time), 'HH:mm:ss')}
                                                                </span>
                                                            </div>
                                                            {ev.valueDiff && (
                                                                <div className={cn("text-[9px] md:text-[10px]", ev.valueDiff < 0 ? "text-red-500" : "text-green-500")}>
                                                                    {ev.valueDiff > 0 ? '+' : ''}{formatCurrency(ev.valueDiff)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {events.length === 0 && removedItems.length === 0 && (
                                <div className="p-4 text-center text-gray-400 text-xs">Không có sự kiện chi tiết được ghi nhận</div>
                            )}
                        </div>
                    ) : isDraftDelete ? (
                        // Draft Delete Detail
                        <div className="space-y-3 mt-2">
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 md:p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">🚫</span>
                                    <span className="font-bold text-red-700">Đơn nháp đã bị xóa</span>
                                </div>
                                <p className="text-xs md:text-sm text-red-600 mb-2">
                                    Lý do: <strong>{log.reason || 'Không rõ'}</strong>
                                </p>
                                {oldValue?.total_amount && (
                                    <p className="text-xs md:text-sm text-gray-700">
                                        Giá trị đơn: <strong className="text-red-700">{formatCurrency(oldValue.total_amount)}</strong>
                                    </p>
                                )}
                                {oldValue?.items && oldValue.items.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-red-200">
                                        <p className="text-xs font-semibold text-red-700 mb-1">Sản phẩm trong đơn nháp:</p>
                                        <ul className="text-xs text-gray-600 space-y-1">
                                            {oldValue.items.map((item: any, idx: number) => (
                                                <li key={idx} className="flex justify-between">
                                                    <span className="line-through text-red-600">{item.productName || item.product?.name || 'SP không rõ'}</span>
                                                    <span className="text-gray-500">x{item.quantity}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            {newValue?.session_events && newValue.session_events.length > 0 && (
                                <TimelineEvents events={newValue.session_events} userName={userName} />
                            )}
                        </div>
                    ) : (
                        // Standard Log View
                        <div className="space-y-3 mt-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                {log.old_value && Object.keys(oldValue).length > 0 && (
                                    <div className="p-2 md:p-3 rounded bg-red-50 text-[10px] md:text-xs border border-red-100">
                                        <div className="font-bold text-red-700 mb-1">TRƯỚC</div>
                                        <pre className="whitespace-pre-wrap text-red-800 font-mono overflow-x-auto max-h-40 overflow-y-auto">{JSON.stringify(oldValue, null, 2)}</pre>
                                    </div>
                                )}
                                {log.new_value && Object.keys(newValue).length > 0 && (
                                    <div className="p-2 md:p-3 rounded bg-green-50 text-[10px] md:text-xs border border-green-100">
                                        <div className="font-bold text-green-700 mb-1">SAU</div>
                                        <pre className="whitespace-pre-wrap text-green-800 font-mono overflow-x-auto max-h-40 overflow-y-auto">{JSON.stringify(newValue, null, 2)}</pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function TimelineEvents({ events, userName }: { events: any[], userName: string }) {
    return (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className="bg-gray-100 px-3 py-1.5 text-[10px] font-bold text-gray-700 border-b border-gray-200 flex justify-between">
                <span>📋 Timeline</span>
                <span className="text-gray-500 font-normal">{userName}</span>
            </div>
            <div className="p-3 space-y-2">
                {events.map((ev: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400 font-mono text-[10px]">{format(new Date(ev.time), 'HH:mm:ss')}</span>
                        <span className="text-gray-800">{ev.description}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- Helpers ---

const StatBox = ({ label, value, color }: { label: string, value: any, color: 'red' | 'green' | 'gray' }) => (
    <div className={cn("px-2 md:px-4 py-1.5 md:py-2 rounded-lg border min-w-[80px] md:min-w-[120px]",
        color === 'red' ? "bg-red-50 border-red-100" :
            color === 'green' ? "bg-green-50 border-green-100" :
                "bg-white border-gray-200"
    )}>
        <p className={cn("text-[9px] md:text-[10px] uppercase font-bold",
            color === 'red' ? "text-red-500" :
                color === 'green' ? "text-green-500" :
                    "text-gray-400"
        )}>{label}</p>
        <p className={cn("font-bold text-xs md:text-sm",
            color === 'red' ? "text-red-700" :
                color === 'green' ? "text-green-700" :
                    "text-gray-900"
        )}>{formatCurrency(value || 0)}</p>
    </div>
);

const getActionTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
        ghost_scan: 'Xóa món (Ghost)',
        cart_cleared: 'Xóa giỏ hàng',
        price_edit: 'Sửa giá',
        void_item: 'Giảm số lượng',
        order_session_summary: 'Phiên Đơn Hàng',
        delete_draft_order: 'Xóa đơn nháp',
        print_provisional: 'In tạm tính',
    };
    return labels[type] || type;
};

const getActionTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
        ghost_scan: 'bg-red-100 text-red-700 border-red-200',
        cart_cleared: 'bg-orange-100 text-orange-700 border-orange-200',
        price_edit: 'bg-amber-100 text-amber-700 border-amber-200',
        void_item: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        order_session_summary: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        delete_draft_order: 'bg-purple-100 text-purple-700 border-purple-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-700 border-gray-200';
};

const formatCurrency = (amount: any) => {
    const num = Number(amount);
    return isNaN(num) ? '0đ' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
};

function ShieldIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    );
}

function ChevronIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}

function InfoIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
        </svg>
    );
}

export default SecurityLogsPage;
