import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Store,
    Users,
    CreditCard,
    Settings,
    Menu,
    X,
    LogOut,
    Shield,
    FileText,
    Receipt
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export function SaaSAdminLayout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, user } = useAuthStore();

    const navigation = [
        { name: 'Tổng quan', href: '/admin', icon: LayoutDashboard },
        { name: 'Thương hiệu', href: '/admin/brands', icon: Store },
        { name: 'Đối tác', href: '/admin/affiliates', icon: Users },
        { name: 'Gói dịch vụ', href: '/admin/pricing', icon: CreditCard },
        { name: 'Hóa đơn', href: '/admin/invoices', icon: Receipt },
        { name: 'Nhật ký', href: '/admin/logs', icon: FileText },
        { name: 'Cài đặt', href: '/admin/settings', icon: Settings },
    ];

    const handleLogout = async () => {
        await logout();
        navigate('/dang-nhap');
    };

    const isActive = (path: string) => {
        if (path === '/admin' && location.pathname === '/admin') return true;
        if (path !== '/admin' && location.pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Mobile Menu Backdrop */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-gray-800/50 z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar Navigation */}
            <aside className={`
                fixed top-0 bottom-0 left-0 bg-white border-r border-gray-200 w-64 z-50 transition-transform duration-300 ease-in-out
                lg:translate-x-0 lg:static lg:h-screen lg:flex lg:flex-col
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Logo Area */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-indigo-600">
                        <Shield className="w-8 h-8" />
                        <span className="text-xl font-bold tracking-tight">SaaS Admin</span>
                    </div>
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="lg:hidden text-gray-500 hover:text-gray-700"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                    <div className="px-3 mb-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Menu</p>
                    </div>
                    {navigation.map((item) => (
                        <Link
                            key={item.name}
                            to={item.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`
                                flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                                ${isActive(item.href)
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                }
                            `}
                        >
                            <item.icon className={`w-5 h-5 mr-3 ${isActive(item.href) ? 'text-indigo-600' : 'text-gray-400'}`} />
                            {item.name}
                        </Link>
                    ))}
                </nav>

                {/* User Profile Bottom */}
                <div className="p-4 border-t border-gray-100">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                            {user?.name?.charAt(0) || 'A'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Đăng xuất
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile Header */}
                <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:hidden">
                    <div className="flex items-center gap-2 font-bold text-gray-900">
                        <Shield className="w-6 h-6 text-indigo-600" />
                        SaaS Admin
                    </div>
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
