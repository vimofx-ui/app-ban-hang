// =============================================================================
// STOCK AUDITS LIST PAGE
// =============================================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Calendar, FileText, CheckCircle, Clock, XCircle, ChevronRight } from 'lucide-react';
import { useStockAuditStore, type StockAudit } from '@/stores/stockAuditStore';
import { useAuthStore } from '@/stores/authStore';
import { useBrandStore } from '@/stores/brandStore';
import { Loading } from '@/components/common/Loading';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export default function StockAuditListPage() {
    const navigate = useNavigate();
    const { isMobile } = useBreakpoint();
    const { audits, fetchAudits, createAudit, isLoading } = useStockAuditStore();
    const { brandId } = useAuthStore();
    const currentBrand = useBrandStore(state => state.currentBrand);
    const activeBrandId = currentBrand?.id || brandId; // Prefer brand store if available

    // Use branchId from auth store (current logged in branch)
    // In a multi-branch setting, we might want a branch selector, 
    // but typically staff works in one branch.
    const branchId = useAuthStore(state => state.branchId);

    const [isCreating, setIsCreating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (branchId) {
            fetchAudits(branchId);
        }
    }, [branchId]);

    const handleCreateAudit = async () => {
        if (!branchId) return;
        setIsCreating(true);
        try {
            const newAudit = await createAudit(branchId);
            if (newAudit) {
                navigate(`/inventory/audit/${newAudit.id}`);
            }
        } catch (error) {
            console.error('Failed to create audit:', error);
        } finally {
            setIsCreating(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-700 border-green-200';
            case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-amber-100 text-amber-700 border-amber-200'; // Draft
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completed': return 'Hoàn thành';
            case 'cancelled': return 'Đã hủy';
            default: return 'Bản nháp';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle className="w-4 h-4" />;
            case 'cancelled': return <XCircle className="w-4 h-4" />;
            default: return <Clock className="w-4 h-4" />;
        }
    };

    const filteredAudits = audits.filter(audit =>
        audit.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (audit.notes && audit.notes.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (isLoading && !isCreating && audits.length === 0) return <Loading />;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="container-app py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Kiểm Kê Kho</h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Quản lý phiếu kiểm kê tài sản chi nhánh
                            </p>
                        </div>
                        <button
                            onClick={handleCreateAudit}
                            disabled={isCreating}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70"
                        >
                            {isCreating ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Plus className="w-5 h-5" />
                            )}
                            <span>Tạo phiếu kiểm kê</span>
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="mt-4 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo mã phiếu, ghi chú..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-transparent focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all outline-none"
                        />
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="container-app py-6">
                {filteredAudits.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">Chưa có phiếu kiểm kê</h3>
                        <p className="text-gray-500 mt-1 mb-6">Tạo phiếu mới để bắt đầu kiểm kê kho hàng của bạn.</p>
                        <button
                            onClick={handleCreateAudit}
                            className="text-primary font-medium hover:underline"
                        >
                            Tạo phiếu mới ngay
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Mobile View: Card List */}
                        <div className="md:hidden space-y-3">
                            {filteredAudits.map((audit) => (
                                <div
                                    key={audit.id}
                                    onClick={() => navigate(`/inventory/audit/${audit.id}`)}
                                    className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm active:scale-[0.99] transition-transform"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                                {audit.code}
                                            </div>
                                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(audit.created_at).toLocaleDateString('vi-VN', {
                                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                        <span className={cn(
                                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border",
                                            getStatusColor(audit.status)
                                        )}>
                                            {getStatusIcon(audit.status)}
                                            {getStatusLabel(audit.status)}
                                        </span>
                                    </div>

                                    {audit.notes && (
                                        <p className="text-sm text-gray-600 mb-3 bg-gray-50 p-2 rounded-lg line-clamp-2">
                                            {audit.notes}
                                        </p>
                                    )}

                                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                                        <span className="text-sm text-gray-500">
                                            {audit.items?.length || 0} sản phẩm
                                        </span>
                                        <button className="text-primary text-sm font-medium flex items-center gap-1">
                                            Chi tiết <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop View: Table */}
                        <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-medium">
                                        <th className="px-6 py-4">Mã phiếu</th>
                                        <th className="px-6 py-4">Thời gian tạo</th>
                                        <th className="px-6 py-4">Ghi chú</th>
                                        <th className="px-6 py-4 text-center">Trạng thái</th>
                                        <th className="px-6 py-4 text-center">SL Sản phẩm</th>
                                        <th className="px-6 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredAudits.map((audit) => (
                                        <tr
                                            key={audit.id}
                                            onClick={() => navigate(`/inventory/audit/${audit.id}`)}
                                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                                        >
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {audit.code}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {new Date(audit.created_at).toLocaleDateString('vi-VN', {
                                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                                                {audit.notes || '---'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={cn(
                                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border shadow-sm",
                                                    getStatusColor(audit.status)
                                                )}>
                                                    {getStatusIcon(audit.status)}
                                                    {getStatusLabel(audit.status)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-gray-600">
                                                {audit.items && audit.items.length > 0 ? audit.items.length : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right transform transition-transform group-hover:translate-x-1">
                                                <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
