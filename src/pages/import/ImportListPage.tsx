// =============================================================================
// IMPORT LIST PAGE - Danh sách các phiếu nhập hàng
// =============================================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, FileText, Check, Clock, Trash2, Search } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useBrandStore } from '@/stores/brandStore';
import { Loading } from '@/components/common/Loading';

interface GoodsReceipt {
    id: string;
    receipt_number: string;
    status: 'draft' | 'completed' | 'cancelled';
    total_items: number;
    total_amount: number;
    notes?: string;
    created_at: string;
    supplier_name?: string;
    purchase_order_id?: string;
    po_number?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    draft: { label: 'Nháp', color: 'bg-gray-100 text-gray-700', icon: FileText },
    completed: { label: 'Đã nhập', color: 'bg-green-100 text-green-700', icon: Check },
    cancelled: { label: 'Đã huỷ', color: 'bg-red-100 text-red-700', icon: Trash2 },
};

export function ImportListPage() {
    const navigate = useNavigate();
    const brandId = useBrandStore(state => state.currentBrand?.id);

    const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (brandId) {
            loadReceipts();
        } else {
            // If brandId is not ready but Supabase is configured, we wait.
            // If not configured, we might want to stop loading.
            if (!isSupabaseConfigured()) setIsLoading(false);
        }
    }, [brandId]);

    const loadReceipts = async () => {
        if (!isSupabaseConfigured() || !brandId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('goods_receipts')
                .select(`
                    *,
                    suppliers(name),
                    purchase_orders(po_number)
                `)
                .eq('brand_id', brandId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mapped = (data || []).map((gr: any) => ({
                ...gr,
                supplier_name: gr.suppliers?.name,
                po_number: gr.purchase_orders?.po_number,
            }));

            setReceipts(mapped);
        } catch (err: any) {
            console.error('Error loading receipts:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xoá phiếu nhập này?')) return;

        try {
            await supabase.from('goods_receipts').delete().eq('id', id);
            loadReceipts();
        } catch (err: any) {
            alert(`Lỗi: ${err.message}`);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const filteredReceipts = receipts.filter(r => {
        const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
        const matchesSearch =
            r.receipt_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    // Stats
    const stats = {
        total: receipts.length,
        draft: receipts.filter(r => r.status === 'draft').length,
        completed: receipts.filter(r => r.status === 'completed').length,
        totalValue: receipts.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.total_amount, 0)
    };

    if (isLoading) return <Loading />;

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">📦 Nhập Hàng</h1>
                        <p className="text-gray-500 text-sm mt-1">Nhập hàng từ nhà cung cấp vào kho</p>
                    </div>
                    <button
                        onClick={() => navigate('/dat-hang-ncc/tao-moi')}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                        <Plus size={20} />
                        Nhập hàng mới
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                        <div className="text-sm text-gray-500">Tổng phiếu</div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-xl shadow-sm border border-yellow-200">
                        <div className="text-2xl font-bold text-yellow-700">{stats.draft}</div>
                        <div className="text-sm text-yellow-600">Phiếu nháp</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl shadow-sm border border-green-200">
                        <div className="text-2xl font-bold text-green-700">{stats.completed}</div>
                        <div className="text-sm text-green-600">Đã nhập</div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-200">
                        <div className="text-xl font-bold text-blue-700">{formatCurrency(stats.totalValue)}</div>
                        <div className="text-sm text-blue-600">Tổng giá trị</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-200">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[200px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Tìm theo mã phiếu, nhà cung cấp..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                            <option value="all">Tất cả</option>
                            <option value="draft">Nháp</option>
                            <option value="completed">Đã nhập</option>
                        </select>
                    </div>
                </div>

                {/* Receipts - Mobile Cards */}
                <div className="md:hidden bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
                    {filteredReceipts.map(receipt => {
                        const statusConfig = STATUS_CONFIG[receipt.status] || STATUS_CONFIG.draft;
                        const StatusIcon = statusConfig.icon;

                        return (
                            <div
                                key={receipt.id}
                                onClick={() => navigate(`/dat-hang-ncc/${receipt.id}`)}
                                className="p-4 hover:bg-gray-50 cursor-pointer"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="font-semibold text-gray-900">{receipt.receipt_number}</div>
                                        {receipt.po_number && (
                                            <div className="text-xs text-blue-600">Từ PO: {receipt.po_number}</div>
                                        )}
                                    </div>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                                        <StatusIcon size={12} />
                                        {statusConfig.label}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">{receipt.supplier_name || 'Chưa có NCC'}</span>
                                    <span className="font-medium text-gray-900">{formatCurrency(receipt.total_amount)}</span>
                                </div>
                                <div className="text-xs text-gray-400 mt-1">{formatDate(receipt.created_at)}</div>
                            </div>
                        );
                    })}
                    {filteredReceipts.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            {searchQuery ? 'Không tìm thấy phiếu nhập phù hợp' : 'Chưa có phiếu nhập nào'}
                        </div>
                    )}
                </div>

                {/* Receipts Table - Desktop */}
                <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Mã phiếu</th>
                                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Nhà cung cấp</th>
                                    <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Trạng thái</th>
                                    <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Số SP</th>
                                    <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Tổng tiền</th>
                                    <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Ngày tạo</th>
                                    <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredReceipts.map(receipt => {
                                    const statusConfig = STATUS_CONFIG[receipt.status] || STATUS_CONFIG.draft;
                                    const StatusIcon = statusConfig.icon;

                                    return (
                                        <tr key={receipt.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-gray-900">{receipt.receipt_number}</div>
                                                {receipt.po_number && (
                                                    <div className="text-xs text-blue-600">Từ PO: {receipt.po_number}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-gray-900">{receipt.supplier_name || '---'}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                                                    <StatusIcon size={14} />
                                                    {statusConfig.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-gray-600">
                                                {receipt.total_items}
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-gray-900">
                                                {formatCurrency(receipt.total_amount)}
                                            </td>
                                            <td className="px-6 py-4 text-center text-gray-600 text-sm">
                                                {formatDate(receipt.created_at)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => navigate(`/dat-hang-ncc/${receipt.id}`)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                        title="Xem chi tiết"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    {receipt.status === 'draft' && (
                                                        <button
                                                            onClick={() => handleDelete(receipt.id)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                                            title="Xoá"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {filteredReceipts.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            {searchQuery ? 'Không tìm thấy phiếu nhập phù hợp' : 'Chưa có phiếu nhập nào'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
