// =============================================================================
// GROCERY POS - MAIN APP WITH AUTHENTICATION
// =============================================================================

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

// Pages
import { ShiftReconciliation } from '@/pages/ShiftReconciliation';
import { Dashboard } from '@/pages/Dashboard';
import { POSPage } from '@/pages/POSPage';
import { ShiftPage } from '@/pages/ShiftPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { SuppliersPage } from '@/pages/SuppliersPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { PurchaseOrdersPage } from '@/pages/PurchaseOrdersPage';
import { StockTakePage } from '@/pages/StockTakePage';
import { InventoryPage } from '@/pages/InventoryPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { BarcodePrintPage } from '@/pages/BarcodePrintPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { BranchesPage } from '@/pages/BranchesPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import SecurityPage from '@/pages/SecurityPage';
import { DebtManagementPage } from '@/pages/DebtManagementPage';
import LoyaltyPage from '@/pages/LoyaltyPage';
import { RemindersPage } from '@/pages/RemindersPage';
import LabelPrintPage from '@/pages/LabelPrintPage';

// Components & Stores
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { MainLayout } from '@/components/layout/MainLayout';
import { useUserStore } from '@/stores/userStore';
import { useAuthStore } from '@/stores/authStore';

import './index.css';

// =============================================================================
// REQUIRE AUTH WRAPPER
// =============================================================================

function RequireAuth({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuthStore();
    const location = useLocation();

    if (!isAuthenticated) {
        // Redirect to login but save the attempted location
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuthStore();

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>;
    }

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}

function RequireActive({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore();
    const location = useLocation();

    // If active or admin, allow
    if (user?.role === 'admin' || user?.is_active) {
        return <>{children}</>;
    }

    // If inactive, ONLY allow /employees
    if (location.pathname === '/employees') {
        return <>{children}</>;
    }

    // Redirect to employees for inactive users
    return <Navigate to="/employees" replace />;
}

// =============================================================================
// MAIN APP
// =============================================================================

function App() {
    const { fetchUsers } = useUserStore();
    const { checkSession } = useAuthStore();

    useEffect(() => {
        // Check for existing session on app load
        checkSession();
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <BrowserRouter>
            <Routes>
                {/* Public Routes - Auth Pages */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                {/* POS - Fullscreen without sidebar (requires auth) */}
                <Route path="/pos" element={
                    <RequireAuth>
                        <POSPage />
                    </RequireAuth>
                } />

                {/* All other pages with sidebar (requires auth) */}
                <Route path="/" element={
                    <RequireAuth>
                        <MainLayout />
                    </RequireAuth>
                }>
                    <Route index element={<Dashboard />} />
                    <Route path="orders" element={<OrdersPage />} />
                    <Route path="products" element={<ProductsPage />} />
                    <Route path="suppliers" element={<SuppliersPage />} />
                    <Route path="customers" element={<CustomersPage />} />
                    <Route path="loyalty" element={<LoyaltyPage />} />
                    <Route path="debt" element={<DebtManagementPage />} />
                    <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
                    <Route path="inventory" element={<InventoryPage />} />
                    <Route path="stock-take" element={<StockTakePage />} />
                    <Route path="barcode-print" element={<BarcodePrintPage />} />
                    <Route path="labels" element={<LabelPrintPage />} />
                    <Route path="shift" element={<ShiftPage />} />
                    <Route path="reconciliation" element={<ShiftReconciliation />} />

                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="reminders" element={<RemindersPage />} />

                    {/* Admin Rights Required */}
                    <Route path="security" element={
                        <RequireAdmin>
                            <SecurityPage />
                        </RequireAdmin>
                    } />

                    {/* Role-Protected Routes (Alternatives using ProtectedRoute) */}
                    <Route element={<ProtectedRoute requireAdmin />}>
                        <Route path="employees" element={<EmployeesPage />} />
                        <Route path="branches" element={<BranchesPage />} />
                    </Route>

                    {/* Permission Based Routes */}
                    <Route element={<ProtectedRoute requiredPermission="report_sales" />}>
                        <Route path="reports" element={<ReportsPage />} />
                    </Route>

                    {/* Catch all */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
