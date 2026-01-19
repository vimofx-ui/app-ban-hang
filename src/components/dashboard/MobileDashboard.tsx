import { useNavigate } from 'react-router-dom';
import { useReportStore } from '@/stores/reportStore';
import { useOrderStore } from '@/stores/orderStore';
import { formatVND } from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useMemo, useState } from 'react';
import {
    ShoppingBag, Package, Boxes, Truck, ClipboardList, ClipboardCheck,
    Factory, Users, Star, DollarSign, UserCog, Store, Barcode,
    Clock, BarChart, Shield, Bell, Settings, Layers, Plus, Import,
    LayoutGrid, ChevronUp
} from 'lucide-react';

const QUICK_ACTIONS = [
    { label: 'Đơn hàng', icon: ShoppingBag, path: '/don-hang', color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Sản phẩm', icon: Package, path: '/san-pham', color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { label: 'Tồn kho', icon: Boxes, path: '/ton-kho', color: 'text-orange-600', bg: 'bg-orange-100' },
    { label: 'Nhập hàng', icon: Import, path: '/nhap-hang', color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Đặt hàng NCC', icon: ClipboardList, path: '/nhap-hang/tao-moi', color: 'text-teal-600', bg: 'bg-teal-100' },
    { label: 'Kiểm kho', icon: ClipboardCheck, path: '/kiem-kho', color: 'text-cyan-600', bg: 'bg-cyan-100' },
    { label: 'Nhà cung cấp', icon: Factory, path: '/nha-cung-cap', color: 'text-purple-600', bg: 'bg-purple-100' },
    { label: 'Khách hàng', icon: Users, path: '/khach-hang', color: 'text-pink-600', bg: 'bg-pink-100' },
    { label: 'Loyalty', icon: Star, path: '/tich-diem', color: 'text-yellow-600', bg: 'bg-yellow-100' },
    { label: 'Công nợ', icon: DollarSign, path: '/cong-no', color: 'text-lime-600', bg: 'bg-lime-100' },
    { label: 'Nhân viên', icon: UserCog, path: '/nhan-vien', color: 'text-rose-600', bg: 'bg-rose-100' },
    { label: 'Chi nhánh', icon: Store, path: '/chi-nhanh', color: 'text-sky-600', bg: 'bg-sky-100' },
    { label: 'In mã vạch', icon: Barcode, path: '/in-ma-vach', color: 'text-slate-600', bg: 'bg-slate-100' },
    { label: 'Ca làm việc', icon: Clock, path: '/ca-lam-viec', color: 'text-fuchsia-600', bg: 'bg-fuchsia-100' },
    { label: 'Báo cáo', icon: BarChart, path: '/bao-cao', color: 'text-red-600', bg: 'bg-red-100' },
    { label: 'Bảo mật', icon: Shield, path: '/bao-mat', color: 'text-gray-600', bg: 'bg-gray-100' },
    { label: 'Nhắc nhở', icon: Bell, path: '/nhac-nho', color: 'text-amber-600', bg: 'bg-amber-100' },
    { label: 'Cài đặt', icon: Settings, path: '/cai-dat', color: 'text-zinc-600', bg: 'bg-zinc-100' },
];

export function MobileDashboard() {
    const navigate = useNavigate();
    const [isExpanded, setIsExpanded] = useState(false);
    // ... existing hooks ...
    const { user } = useAuthStore();
    const { totalRevenue, totalOrders, loading } = useReportStore();
    const { orders } = useOrderStore();

    // ... stats memos ...
    const stats = useMemo(() => {
        const newOrders = orders.filter(o => o.created_at.startsWith(new Date().toISOString().split('T')[0])).length;
        const cancelled = orders.filter(o => o.status === 'cancelled').length;
        const returns = orders.filter(o => o.status === 'returned').length;
        return { newOrders, cancelled, returns };
    }, [orders]);

    const pendingCounts = useMemo(() => {
        return {
            approval: orders.filter(o => o.status === 'pending_approval').length,
            packing: orders.filter(o => ['packing', 'packed'].includes(o.status)).length,
            shipping: orders.filter(o => o.status === 'shipping').length,
            debt: orders.filter(o => o.payment_status === 'unpaid').length,
        };
    }, [orders]);

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* ... Header and Sales Card (Unchanged) ... */}
            {/* 1. Header Section - System Primary Color */}
            <div className="bg-emerald-600 pt-8 pb-24 px-4 text-white relative shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-90" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-bold text-lg tracking-wide">Chi nhánh mặc định</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                    <div className="relative p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-emerald-600">9+</span>
                    </div>
                </div>
            </div>

            {/* 2. Sales Card - Floating overlap */}
            <div className="mx-4 -mt-20 bg-white rounded-2xl shadow-xl p-5 relative z-10 border border-gray-100">
                <div className="flex justify-between items-start mb-1">
                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">DOANH THU NGÀY</h3>
                    <button className="text-emerald-600 text-xs font-semibold flex items-center gap-1 hover:text-emerald-700 transition-colors">
                        Xem chi tiết
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
                <div className="text-3xl font-extrabold text-gray-800 mb-6 tracking-tight">
                    {loading ? '...' : formatVND(totalRevenue)}
                </div>
                <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-4">
                    <div className="text-center">
                        <div className="text-xs text-gray-400 mb-1 font-medium">Đơn mới</div>
                        <div className="font-bold text-gray-800 text-lg">{stats.newOrders}</div>
                    </div>
                    <div className="text-center border-l border-gray-100">
                        <div className="text-xs text-gray-400 mb-1 font-medium">Đơn hủy</div>
                        <div className="font-bold text-gray-800 text-lg">{stats.cancelled}</div>
                    </div>
                    <div className="text-center border-l border-gray-100">
                        <div className="text-xs text-gray-400 mb-1 font-medium">Trả hàng</div>
                        <div className="font-bold text-gray-800 text-lg">{stats.returns}</div>
                    </div>
                </div>
            </div>

            {/* 3. Main Action Buttons - Horizontal Layout */}
            <div className="grid grid-cols-2 gap-3 mx-4 mt-6">
                <button
                    onClick={() => navigate('/mobile-orders/create')}
                    className="bg-white border border-blue-100 p-4 rounded-xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                    </div>
                    <span className="font-bold text-gray-700 text-sm">Bán giao hàng</span>
                </button>

                <button
                    onClick={() => navigate('/mobile-pos')}
                    className="bg-emerald-600 p-4 rounded-xl shadow-lg shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    <div className="w-10 h-10 bg-white/20 text-white rounded-lg flex items-center justify-center shrink-0 backdrop-blur-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <span className="font-bold text-white text-sm">Bán tại quầy</span>
                </button>
            </div>

            {/* 4. Quick Actions - Expandable Grid */}
            <div className="mx-4 mt-8">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider">THAO TÁC NHANH</h3>
                </div>
                <div className="grid grid-cols-4 gap-y-6 gap-x-2">
                    {/* Render first 7 items, then "See More" button, or all items if expanded */}
                    {(isExpanded ? QUICK_ACTIONS : QUICK_ACTIONS.slice(0, 7)).map((action, index) => (
                        <QuickActionItem
                            key={index}
                            icon={<action.icon className="h-6 w-6 text-current" />}
                            color={`${action.bg} ${action.color}`}
                            label={action.label}
                            onClick={() => navigate(action.path)}
                        />
                    ))}

                    {/* The Toggle Button (Always the last item in the grid flow) */}
                    <QuickActionItem
                        icon={isExpanded ? <ChevronUp className="h-6 w-6 text-current" /> : <LayoutGrid className="h-6 w-6 text-current" />}
                        color="bg-gray-100 text-gray-600"
                        label={isExpanded ? "Thu gọn" : "Xem thêm"}
                        onClick={() => setIsExpanded(!isExpanded)}
                    />
                </div>
            </div>

            {/* 5. Banner */}
            <div className="mx-4 mt-6 rounded-lg overflow-hidden relative">
                <div className="bg-blue-900 text-white p-4 flex justify-between items-center">
                    <div>
                        <div className="text-xs font-bold bg-yellow-400 text-blue-900 inline-block px-1 rounded mb-1">MIỄN PHÍ</div>
                        <div className="font-bold">3 THÁNG<br />Chữ ký số</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-yellow-400">MIỄN PHÍ</div>
                        <div className="text-2xl font-bold">2000</div>
                        <div className="text-xs">Hóa đơn điện tử</div>
                    </div>
                </div>
            </div>

            {/* 6. Pending Orders */}
            <div className="mx-4 mt-6 pb-6">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-gray-700 uppercase text-sm">ĐƠN HÀNG CHỜ XỬ LÝ</h3>
                    <button className="text-blue-500 text-sm flex items-center gap-1">
                        90 ngày gần nhất
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-3">
                    <StatusItem
                        icon={<ClockIcon className="text-blue-500" />}
                        bg="bg-blue-50"
                        label="Chờ duyệt"
                        count={pendingCounts.approval}
                        onClick={() => navigate('/don-hang?status=pending_approval')}
                    />
                    {/* Add more as needed */}
                </div>
            </div>

            {/* Floating Action Button (More) */}
            <div className="fixed bottom-24 right-4 z-50">
                <button className="bg-emerald-600 w-12 h-12 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200 text-white hover:bg-emerald-700 transition-all active:scale-90">
                    <DotsIcon className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
}

// Icons
function TruckIcon({ className = "h-6 w-6 text-current" }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a3 3 0 11-6 0" /></svg>;
}
function PlusIcon({ className = "h-6 w-6 text-current" }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
}
function CartIcon({ className = "h-6 w-6 text-current" }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
}
function ChatIcon({ className = "h-6 w-6 text-current" }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>;
}
function QrIcon({ className = "h-6 w-6 text-current" }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4h2v-4zM6 8v4M6 16v4" /></svg>;
}
function GridIcon({ className = "h-6 w-6 text-current" }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
}
function DotsIcon({ className = "h-6 w-6 text-current" }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>;
}
function ClockIcon({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-6 w-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}


function QuickActionItem({ icon, color, label, onClick, itemColor }: any) {
    return (
        <button onClick={onClick} className="flex flex-col items-center gap-2">
            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0", color)}>
                {icon}
            </div>
            <span className={cn("text-xs text-center font-medium leading-tight", itemColor || "text-gray-600")}>{label}</span>
        </button>
    )
}

function StatusItem({ icon, bg, label, count, onClick }: any) {
    return (
        <div onClick={onClick} className="bg-white rounded-xl p-4 flex items-center gap-4 border border-gray-100 shadow-sm active:bg-gray-50">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", bg)}>
                {icon}
            </div>
            <div className="flex-1 font-medium text-gray-700">
                {label}
            </div>
            <div className="text-xl font-bold text-gray-800">
                {count}
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
        </div>
    )
}
