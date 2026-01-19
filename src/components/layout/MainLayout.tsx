// =============================================================================
// MAIN LAYOUT - Responsive sidebar/bottom navigation with tablet support
// =============================================================================

import { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/stores/userStore';
import { useShiftStore } from '@/stores/shiftStore';
import { useAuthStore } from '@/stores/authStore';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useBrandTheme } from '@/hooks/useBrandTheme';
import { BranchSwitcher } from './BranchSwitcher';

// Navigation items structure
type NavItem = {
    path?: string;
    label: string;
    icon: any;
    children?: NavItem[];
};

const NAV_ITEMS: NavItem[] = [
    { path: '/', label: 'Tổng quan', icon: DashboardIcon },
    { path: '/ban-hang', label: 'Bán hàng', icon: POSIcon },
    { path: '/don-hang', label: 'Đơn hàng', icon: OrderIcon },

    // Group: Sản phẩm
    {
        label: 'Sản phẩm',
        icon: ProductsIcon,
        children: [
            { path: '/san-pham', label: 'Danh sách sản phẩm', icon: ListIcon },
        ]
    },

    // Group: Kho hàng
    {
        label: 'Kho hàng',
        icon: InventoryIcon,
        children: [
            { path: '/ton-kho', label: 'Tồn kho', icon: InventoryIcon },
            { path: '/de-xuat-dat-hang', label: 'Đề xuất đặt hàng', icon: LightbulbIcon },
            { path: '/dat-hang-ncc', label: 'Đặt hàng NCC', icon: PurchaseIcon },
            { path: '/nhap-hang', label: 'Nhập hàng', icon: ClipboardIcon },
            { path: '/inventory/audits', label: 'Kiểm kho', icon: StockTakeIcon },
        ]
    },

    { path: '/nha-cung-cap', label: 'Nhà cung cấp', icon: SupplierIcon },

    // Group: Khách hàng
    {
        label: 'Khách hàng',
        icon: CustomersIcon,
        children: [
            { path: '/khach-hang', label: 'Khách hàng', icon: ListIcon },
            { path: '/tich-diem', label: 'Loyalty', icon: LoyaltyIcon },
            { path: '/cong-no', label: 'Công nợ', icon: DebtIcon },
        ]
    },

    { path: '/nhan-vien', label: 'Nhân viên', icon: UsersIcon },
    { path: '/chi-nhanh', label: 'Chi nhánh', icon: BranchIcon },
    { path: '/in-ma-vach', label: 'In mã vạch', icon: BarcodeIcon },
    { path: '/ca-lam-viec', label: 'Ca làm việc', icon: ClockIcon },
    { path: '/bao-cao', label: 'Báo cáo', icon: ReportsIcon },
    { path: '/bao-mat', label: 'Bảo mật', icon: ShieldIcon },
    { path: '/nhac-nho', label: 'Nhắc nhở', icon: BellIcon },
    { path: '/cai-dat', label: 'Cài đặt', icon: SettingsIcon },
    { path: '/thanh-toan', label: 'Gói & Thanh toán', icon: SparklesIcon },
];

function ListIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0NM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
    );
}

// Mobile bottom nav - main items (first 4) + "More" button
// Note: Flatten items for mobile nav logic if needed, or just pick top level
const MOBILE_MAIN_ITEMS = [
    NAV_ITEMS[0], // Dashboard
    NAV_ITEMS[1], // POS
    NAV_ITEMS[2], // Orders
    // Products group parent as shortcut, or simple products link? 
    // Let's stick to simple flat list for bottom nav for now, maybe just "Sản phẩm" as a shortcut to products page if we want, 
    // but the array has changed. Let's manually pick typical mobile items.
    { path: '/products', label: 'Sản phẩm', icon: ProductsIcon }
];

function ChevronDownIcon({ className }: { className?: string }) {
    return <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>;
}

export function MainLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser } = useShiftStore();
    const { user: authUser } = useAuthStore();
    const { users, hasPermission } = useUserStore();
    const { isMobile, isTablet, isDesktop } = useBreakpoint();

    useBrandTheme(); // Apply brand colors

    // Tablet sidebar collapsed state
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    // Mobile "More" menu open state
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);

    // Group expansion state
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
        'Sản phẩm': false,
        'Kho hàng': true,
        'Khách hàng': false
    });

    const toggleGroup = (label: string) => {
        setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
    };

    // Filter Navigation based on permissions
    const filterItem = (item: NavItem, fullUser: any): boolean => {
        // Global inactive check logic (simplified from previous)
        if (fullUser && fullUser.is_active === false && item.path !== '/nhan-vien' && !item.children) return false;

        // Admin/Owner bypass
        // if (fullUser?.role === 'admin' || fullUser?.role === 'owner') return true;

        // Specific checks
        if (item.path === '/nhan-vien' && !hasPermission(fullUser, 'employee_view')) return false;
        if (item.path === '/bao-cao' && !hasPermission(fullUser, 'report_sales')) return false;
        if (item.path === '/cai-dat' && !hasPermission(fullUser, 'settings_general')) return false;
        if (item.path === '/san-pham' && !hasPermission(fullUser, 'product_view')) return false;
        if (item.path === '/kiem-kho' && !hasPermission(fullUser, 'inventory_view')) return false;
        if (item.path === '/nhap-hang' && !hasPermission(fullUser, 'inventory_import')) return false;
        if (item.path === '/dat-hang-ncc' && !hasPermission(fullUser, 'inventory_import')) return false;
        if (item.path === '/nha-cung-cap' && !hasPermission(fullUser, 'inventory_import')) return false; // Use existing permission
        if (item.path === '/khach-hang' && !hasPermission(fullUser, 'customer_view')) return false;
        // if (item.path === '/bao-mat') return false; // Enabled

        return true;
    };

    const filteredNavItems = NAV_ITEMS.reduce<NavItem[]>((acc, item) => {
        const fullUser = users.find((u: { id: string }) => u.id === currentUser?.id) || authUser;

        // If it's a group
        if (item.children) {
            const visibleChildren = item.children.filter(child => filterItem(child, fullUser));
            if (visibleChildren.length > 0) {
                acc.push({ ...item, children: visibleChildren });
            }
        } else {
            if (filterItem(item, fullUser)) {
                acc.push(item);
            }
        }
        return acc;
    }, []);


    const sidebarWidth = sidebarCollapsed ? 'w-20' : 'w-64';

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Desktop & Tablet Sidebar */}
            <aside className={cn(
                "hidden md:flex md:flex-col md:fixed md:inset-y-0 transition-all duration-300 z-30",
                isTablet ? sidebarWidth : 'lg:w-64'
            )}>
                <div className="flex flex-col flex-1 bg-white border-r border-gray-200 h-full">
                    {/* Header */}
                    <div className="h-16 flex items-center px-4 border-b border-gray-200 justify-between shrink-0">
                        <div className={cn("flex items-center gap-3", sidebarCollapsed && isTablet && "justify-center w-full")}>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shrink-0">
                                <StoreIcon className="w-6 h-6 text-white" />
                            </div>
                            {(!sidebarCollapsed || !isTablet) && (
                                <div>
                                    <h1 className="font-bold text-gray-900">Bango Pos</h1>
                                    <p className="text-xs text-gray-500">Quản lý cửa hàng</p>
                                </div>
                            )}
                        </div>
                        {/* Tablet collapse toggle */}
                        {isTablet && (
                            <button
                                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                            >
                                <MenuIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {/* Navigation - Scrollable Area */}
                    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300">
                        {filteredNavItems.map((item, index) => {
                            // GROUP ITEM
                            if (item.children) {
                                const isExpanded = expandedGroups[item.label];
                                const isActiveGroup = item.children.some(child => location.pathname === child.path);

                                return (
                                    <div key={item.label} className="mb-1">
                                        <button
                                            onClick={() => !sidebarCollapsed && toggleGroup(item.label)}
                                            className={cn(
                                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all',
                                                sidebarCollapsed && isTablet && 'justify-center px-2',
                                                isActiveGroup ? 'text-gray-900 bg-gray-50' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                            )}
                                            title={sidebarCollapsed && isTablet ? item.label : undefined}
                                        >
                                            <item.icon className={cn("w-5 h-5 shrink-0 transition-colors", isActiveGroup ? 'text-primary' : 'text-gray-400')} />
                                            {(!sidebarCollapsed || !isTablet) && (
                                                <>
                                                    <span className="flex-1 text-left">{item.label}</span>
                                                    <ChevronDownIcon className={cn("w-4 h-4 transition-transform duration-200", isExpanded ? "rotate-0" : "-rotate-90")} />
                                                </>
                                            )}
                                        </button>

                                        {/* Children */}
                                        <div className={cn(
                                            "overflow-hidden transition-all duration-300 ease-in-out",
                                            isExpanded && (!sidebarCollapsed || !isTablet) ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                                        )}>
                                            <div className="mt-1 ml-4 border-l-2 border-gray-100 pl-2 space-y-1">
                                                {item.children.map(child => {
                                                    const isActive = location.pathname === child.path;
                                                    return (
                                                        <NavLink
                                                            key={child.path}
                                                            to={child.path!}
                                                            className={cn(
                                                                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                                                                isActive
                                                                    ? 'bg-primary/10 text-primary'
                                                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                                            )}
                                                        >
                                                            {child.icon && <child.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-gray-400 group-hover:text-gray-500")} />}
                                                            <span>{child.label}</span>
                                                        </NavLink>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            // STANDARD ITEM
                            if (!item.path) return null;
                            const isPos = item.path === '/pos';
                            const isShift = item.path === '/shift';

                            const isActive = item.path === '/'
                                ? location.pathname === '/'
                                : (location.pathname === item.path || location.pathname.startsWith(item.path + '/'));

                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
                                        // Base sizes & Text
                                        isPos ? 'text-sm font-bold uppercase py-3 my-1 justify-center tracking-wide' : 'text-sm font-medium',

                                        // Tablet collapse
                                        sidebarCollapsed && isTablet && 'justify-center px-2',

                                        // Colors - POS (Gradient + Glow)
                                        isPos && 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:-translate-y-0.5 border border-emerald-400/20',

                                        // Colors - Shift (Light Emerald)
                                        isShift && !isPos && (isActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold' : 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100'),

                                        // Colors - Standard
                                        !isPos && !isShift && (isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')
                                    )}
                                >
                                    <item.icon className={cn(
                                        "shrink-0 transition-colors",
                                        isPos ? "w-5 h-5 text-white" : "w-5 h-5",
                                        !isPos && !isShift && (isActive ? 'text-primary' : 'text-gray-400')
                                    )} />
                                    {(!sidebarCollapsed || !isTablet) && <span>{item.label}</span>}
                                </NavLink>
                            );
                        })}
                    </nav>


                    {/* User section - Sticky Bottom */}
                    <div className="p-3 border-t border-gray-200 bg-white shrink-0 mt-auto">
                        <BranchSwitcher collapsed={sidebarCollapsed && isTablet} />
                        <UserSection
                            collapsed={sidebarCollapsed && isTablet}
                            currentUser={currentUser}
                        />
                    </div>
                </div>
            </aside>

            {/* Main content area */}
            <div className={cn(
                "flex-1 transition-all duration-300",
                isTablet ? (sidebarCollapsed ? 'md:pl-20' : 'md:pl-64') : 'md:pl-64'
            )}>
                <main className="pb-20 md:pb-0 min-h-screen">
                    <Outlet />
                </main>
            </div>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
                <div className="flex items-center justify-around h-16 px-2">
                    {MOBILE_MAIN_ITEMS.map((item) => {
                        if (!item.path) return null;
                        const isActive = location.pathname === item.path;
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    'flex flex-col items-center justify-center flex-1 h-full text-xs transition-colors',
                                    isActive ? 'text-primary' : 'text-gray-500'
                                )}
                            >
                                <item.icon className={cn('w-6 h-6 mb-1', isActive && 'scale-110')} />
                                <span className="truncate">{item.label}</span>
                            </NavLink>
                        );
                    })}
                    {/* More button */}
                    <button
                        onClick={() => setMoreMenuOpen(true)}
                        className={cn(
                            'flex flex-col items-center justify-center flex-1 h-full text-xs transition-colors',
                            moreMenuOpen ? 'text-primary' : 'text-gray-500'
                        )}
                    >
                        <MoreIcon className="w-6 h-6 mb-1" />
                        <span>Thêm</span>
                    </button>
                </div>
            </nav>

            {/* Mobile "More" Menu Drawer */}
            {moreMenuOpen && (
                <div className="md:hidden fixed inset-0 z-50">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setMoreMenuOpen(false)}
                    />
                    {/* Drawer */}
                    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[70vh] overflow-y-auto animate-slide-up">
                        <div className="p-4">
                            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Menu</h3>
                            <div className="grid grid-cols-4 gap-4">
                                {filteredNavItems.flatMap((item: NavItem) => {
                                    if (item.children) return item.children;
                                    return [item];
                                }).map((item) => {
                                    if (!item.path) return null;
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <NavLink
                                            key={item.path}
                                            to={item.path}
                                            onClick={() => setMoreMenuOpen(false)}
                                            className={cn(
                                                'flex flex-col items-center justify-center p-3 rounded-xl transition-colors',
                                                isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100'
                                            )}
                                        >
                                            <item.icon className="w-6 h-6 mb-2" />
                                            <span className="text-xs text-center line-clamp-2 leading-tight">{item.label}</span>
                                        </NavLink>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="h-safe" />
                    </div>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// Icons
// =============================================================================

function StoreIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    );
}

function MenuIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
    );
}

function MoreIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
        </svg>
    );
}

function DashboardIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
    );
}

function POSIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
        </svg>
    );
}

function ProductsIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
    );
}

function CashIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <circle cx="12" cy="12" r="4" />
            <path d="M6 12h.01M18 12h.01" />
        </svg>
    );
}

function ClockIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}

function ShieldIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    );
}

function SupplierIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="2" />
            <path d="M16 8h4l3 3v5a2 2 0 0 1-2 2h-1" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
    );
}

function CustomersIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    );
}

function DebtIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
    );
}

function LoyaltyIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
    );
}

function PurchaseIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
        </svg>
    );
}

function InventoryIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l3.58-3.58c.94-.94.94-2.48 0-3.42L9 5Z" />
            <path d="M6 9.01V9M22 9v6a2 2 0 0 1-2 2h-4.09" />
            <path d="M15 5h5v5" />
        </svg>
    );
}

function ClipboardIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" />
        </svg>
    );
}

function StockTakeIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l3.58-3.58c.94-.94.94-2.48 0-3.42L9 5Z" />
            <path d="M6 9.01V9" />
            <path d="m15 5 6 6" />
            <path d="m21 5-6 6" />
        </svg>
    );
}

function LightbulbIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
            <path d="M9 18h6" />
            <path d="M10 22h4" />
        </svg>
    );
}


function BarcodeIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14" />
        </svg>
    );
}

function ReportsIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
        </svg>
    );
}

function SettingsIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function BellIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
    );
}

function OrderIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
    );
}

function UsersIcon({ className }: { className?: string }) {
    return <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>;
}

function BranchIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
        </svg>
    );
}

// User Section Component with Logout
function UserSection({ collapsed, currentUser }: { collapsed: boolean; currentUser: any }) {
    const navigate = useNavigate();
    const { user: authUser, logout } = useAuthStore();

    const displayName = authUser?.name || currentUser?.name || 'Nhân viên';
    const displayRole = (authUser?.role === 'admin' || authUser?.role === 'owner') ? 'Quản trị viên' : 'Nhân viên';
    const initials = displayName.charAt(0).toUpperCase();

    return (
        <div className="flex flex-col gap-2">
            {/* User Info */}
            <div className={cn(
                "flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100",
                collapsed && "justify-center"
            )}>
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0 shadow-sm">
                    {initials}
                </div>
                {!collapsed && (
                    <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
                        <p className="text-xs text-gray-500">{displayRole}</p>
                    </div>
                )}
                {/* Notification Bell */}
                <NotificationBell />
            </div>

            {/* Logout Button - Direct, no dropdown */}
            <button
                type="button"
                onClick={() => {
                    console.log('Sidebar logout clicked - redirecting...');
                    window.location.href = '/dang-nhap';
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                    "flex items-center gap-3 p-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 font-bold text-sm transition-colors",
                    collapsed && "justify-center"
                )}
            >
                <LogoutIcon className="w-5 h-5" />
                {!collapsed && <span>Đăng xuất</span>}
            </button>
        </div>
    );
}

function LogoutIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" />
        </svg>
    );
}

// ... existing icons ...

function SparklesIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
        </svg>
    );
}



export default MainLayout;

