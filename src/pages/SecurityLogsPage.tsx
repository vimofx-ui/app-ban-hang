// =============================================================================
// SECURITY LOGS PAGE - Ghost Scan and Audit Logs
// =============================================================================

import { useState, useEffect } from 'react';
import { getRecentAuditLogs } from '@/lib/ghostScan';
import { cn } from '@/lib/utils';

interface AuditLogEntry {
    id: string;
    action_type: string;
    entity_type: string;
    entity_id?: string;
    old_value?: Record<string, unknown> | null;
    new_value?: Record<string, unknown> | null;
    reason?: string;
    created_at: string;
    user_id?: string;
    shift_id?: string;
}

export function SecurityLogsPage() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        const data = await getRecentAuditLogs(100);
        setLogs(data);
        setLoading(false);
    };

    const filteredLogs = logs.filter((log) => {
        if (filter === 'all') return true;
        return log.action_type === filter;
    });

    const getActionTypeLabel = (type: string): string => {
        const labels: Record<string, string> = {
            ghost_scan: '👻 Xóa sản phẩm',
            cart_cleared: '🗑️ Xóa giỏ hàng',
            price_edit: '💰 Sửa giá',
            void_item: '⚠️ Giảm số lượng',
            order_cancel: '❌ Hủy đơn',
            discount_apply: '🎫 Áp dụng giảm giá',
            refund: '💸 Hoàn tiền',
        };
        return labels[type] || type;
    };

    const getActionTypeColor = (type: string): string => {
        const colors: Record<string, string> = {
            ghost_scan: 'bg-red-100 text-red-700 border-red-200',
            cart_cleared: 'bg-orange-100 text-orange-700 border-orange-200',
            price_edit: 'bg-amber-100 text-amber-700 border-amber-200',
            void_item: 'bg-yellow-100 text-yellow-700 border-yellow-200',
            order_cancel: 'bg-red-100 text-red-700 border-red-200',
            discount_apply: 'bg-blue-100 text-blue-700 border-blue-200',
            refund: 'bg-purple-100 text-purple-700 border-purple-200',
        };
        return colors[type] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200">
                <div className="container-app py-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Nhật ký bảo mật</h1>
                            <p className="text-sm text-gray-500">
                                Theo dõi Ghost Scan và các thay đổi quan trọng
                            </p>
                        </div>
                        <button
                            onClick={loadLogs}
                            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            🔄 Làm mới
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container-app py-6">
                {/* Filters */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {[
                        { value: 'all', label: 'Tất cả' },
                        { value: 'ghost_scan', label: '👻 Ghost Scan' },
                        { value: 'cart_cleared', label: '🗑️ Xóa giỏ' },
                        { value: 'price_edit', label: '💰 Sửa giá' },
                        { value: 'void_item', label: '⚠️ Giảm SL' },
                    ].map((f) => (
                        <button
                            key={f.value}
                            onClick={() => setFilter(f.value)}
                            className={cn(
                                'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                                filter === f.value
                                    ? 'bg-primary text-white'
                                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Logs List */}
                {loading ? (
                    <div className="text-center py-12 text-gray-500">
                        Đang tải...
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ShieldIcon className="w-10 h-10 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Không có cảnh báo</h3>
                        <p className="text-gray-500 mt-1">Hệ thống đang hoạt động bình thường</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredLogs.map((log) => (
                            <LogEntry key={log.id} log={log} getActionTypeLabel={getActionTypeLabel} getActionTypeColor={getActionTypeColor} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

interface LogEntryProps {
    log: AuditLogEntry;
    getActionTypeLabel: (type: string) => string;
    getActionTypeColor: (type: string) => string;
}

function LogEntry({ log, getActionTypeLabel, getActionTypeColor }: LogEntryProps) {
    const [expanded, setExpanded] = useState(false);

    const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-4 flex items-center gap-4 text-left hover:bg-gray-50 transition-colors"
            >
                <div className={cn('px-3 py-1 rounded-lg text-xs font-medium border', getActionTypeColor(log.action_type))}>
                    {getActionTypeLabel(log.action_type)}
                </div>

                <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                        {log.reason || 'Không có lý do'}
                    </p>
                    <p className="text-sm text-gray-500">
                        {formatDate(log.created_at)}
                    </p>
                </div>

                <ChevronIcon className={cn('w-5 h-5 text-gray-400 transition-transform', expanded && 'rotate-180')} />
            </button>

            {expanded && (
                <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="mt-4 space-y-3">
                        {log.old_value && (
                            <div className="p-3 rounded-lg bg-red-50">
                                <p className="text-xs font-medium text-red-700 mb-1">Giá trị cũ</p>
                                <pre className="text-xs text-red-800 overflow-x-auto">
                                    {JSON.stringify(log.old_value, null, 2)}
                                </pre>
                            </div>
                        )}
                        {log.new_value && (
                            <div className="p-3 rounded-lg bg-green-50">
                                <p className="text-xs font-medium text-green-700 mb-1">Giá trị mới</p>
                                <pre className="text-xs text-green-800 overflow-x-auto">
                                    {JSON.stringify(log.new_value, null, 2)}
                                </pre>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">ID:</span>
                                <span className="ml-2 font-mono text-gray-700">{log.id.slice(0, 8)}...</span>
                            </div>
                            {log.shift_id && (
                                <div>
                                    <span className="text-gray-500">Ca:</span>
                                    <span className="ml-2 font-mono text-gray-700">{log.shift_id.slice(0, 8)}...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

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

export default SecurityLogsPage;
