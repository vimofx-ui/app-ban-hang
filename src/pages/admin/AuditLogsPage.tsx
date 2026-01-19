import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import {
    Search,
    Filter,
    RefreshCw,
    AlertCircle,
    FileText,
    User,
    Building2,
    Package,
    ShoppingCart,
    Settings,
    Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

interface AuditLog {
    id: string;
    brand_id: string;
    user_id: string;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    // Joined
    user_name?: string;
    brand_name?: string;
}

const ACTION_COLORS: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-800',
    UPDATE: 'bg-blue-100 text-blue-800',
    DELETE: 'bg-red-100 text-red-800',
    SOFT_DELETE_BRAND: 'bg-red-100 text-red-800',
    LOGIN: 'bg-gray-100 text-gray-800',
    default: 'bg-gray-100 text-gray-800'
};

const ENTITY_ICONS: Record<string, React.ReactNode> = {
    brand: <Building2 size={16} />,
    product: <Package size={16} />,
    order: <ShoppingCart size={16} />,
    user: <User size={16} />,
    settings: <Settings size={16} />,
    default: <FileText size={16} />
};

export function AuditLogsPage() {
    const { user } = useAuthStore();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterAction, setFilterAction] = useState<string>('');
    const [filterEntity, setFilterEntity] = useState<string>('');

    const fetchLogs = async () => {
        if (!supabase) return;
        setIsLoading(true);

        try {
            // Simple query without joins
            let query = supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (filterAction) {
                query = query.eq('action', filterAction);
            }
            if (filterEntity) {
                query = query.eq('entity_type', filterEntity);
            }

            const { data, error } = await query;

            console.log('[AuditLogs] Fetched data:', data, 'Error:', error);

            if (error) throw error;

            if (!data || data.length === 0) {
                console.log('[AuditLogs] No data returned from query');
                setLogs([]);
                return;
            }

            // Map directly without fetching related names (simpler approach)
            const logsWithNames = data.map((log: any) => ({
                ...log,
                user_name: log.user_id ? 'User' : 'System',
                brand_name: 'Brand'
            }));

            console.log('[AuditLogs] Mapped logs:', logsWithNames);
            setLogs(logsWithNames);
        } catch (err) {
            console.error('[AuditLogs] Failed to fetch:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [filterAction, filterEntity]);

    const filteredLogs = logs.filter(log => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            log.action.toLowerCase().includes(q) ||
            log.user_name?.toLowerCase().includes(q) ||
            log.brand_name?.toLowerCase().includes(q) ||
            log.entity_type?.toLowerCase().includes(q)
        );
    });

    const uniqueActions = [...new Set(logs.map(l => l.action))];
    const uniqueEntities = [...new Set(logs.map(l => l.entity_type).filter(Boolean))];

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Nhật ký hệ thống</h1>
                    <p className="text-gray-500 text-sm mt-1">Theo dõi mọi hoạt động trên hệ thống</p>
                </div>
                <button
                    onClick={fetchLogs}
                    disabled={isLoading}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
                >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    Làm mới
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Tìm kiếm</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Tìm theo hành động, người dùng..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="w-40">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Hành động</label>
                        <select
                            value={filterAction}
                            onChange={(e) => setFilterAction(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Tất cả</option>
                            {uniqueActions.map(action => (
                                <option key={action} value={action}>{action}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-40">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Đối tượng</label>
                        <select
                            value={filterEntity}
                            onChange={(e) => setFilterEntity(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Tất cả</option>
                            {uniqueEntities.map(entity => (
                                <option key={entity} value={entity!}>{entity}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                        Đang tải...
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <AlertCircle size={24} className="mx-auto mb-2 text-gray-400" />
                        Chưa có nhật ký nào
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="py-3 px-4 text-left font-medium text-gray-600">Thời gian</th>
                                    <th className="py-3 px-4 text-left font-medium text-gray-600">Người dùng</th>
                                    <th className="py-3 px-4 text-left font-medium text-gray-600">Hành động</th>
                                    <th className="py-3 px-4 text-left font-medium text-gray-600">Đối tượng</th>
                                    <th className="py-3 px-4 text-left font-medium text-gray-600">Thương hiệu</th>
                                    <th className="py-3 px-4 text-left font-medium text-gray-600">Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <Clock size={14} />
                                                <span title={new Date(log.created_at).toLocaleString('vi-VN')}>
                                                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: vi })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium text-xs">
                                                    {log.user_name?.charAt(0).toUpperCase() || 'S'}
                                                </div>
                                                <span className="font-medium text-gray-800">{log.user_name}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || ACTION_COLORS.default}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            {log.entity_type && (
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    {ENTITY_ICONS[log.entity_type] || ENTITY_ICONS.default}
                                                    <span className="capitalize">{log.entity_type}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-gray-600">
                                            {log.brand_name}
                                        </td>
                                        <td className="py-3 px-4">
                                            {(log.new_values || log.old_values) && (
                                                <button
                                                    onClick={() => {
                                                        alert(JSON.stringify({ old: log.old_values, new: log.new_values }, null, 2));
                                                    }}
                                                    className="text-blue-600 hover:text-blue-800 text-xs underline"
                                                >
                                                    Xem chi tiết
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
