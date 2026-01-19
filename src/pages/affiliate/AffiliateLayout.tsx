import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogOut, User } from 'lucide-react';

export function AffiliateLayout() {
    const location = useLocation();

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            {/* Mobile Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link to="/doi-tac" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold">
                            P
                        </div>
                        <span className="font-bold text-gray-900 text-lg">Partner</span>
                    </Link>

                    <div className="flex items-center gap-4">
                        <div className="text-sm text-right hidden sm:block">
                            <div className="font-medium text-gray-900">Cộng tác viên</div>
                            <div className="text-xs text-gray-500">Đối tác</div>
                        </div>
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                            <User size={18} />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main>
                <Outlet />
            </main>

            {/* Mobile Bottom Nav (Optional, maybe just a footer for simple portal) */}
            <footer className="bg-white border-t border-gray-200 mt-12 py-8">
                <div className="max-w-6xl mx-auto px-4 text-center text-gray-500 text-sm">
                    <p>© 2024 Storely POS Partner Program</p>
                    <p className="mt-2">Hợp tác cùng phát triển</p>
                </div>
            </footer>
        </div>
    );
}
