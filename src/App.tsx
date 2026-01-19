// =============================================================================
// GROCERY POS - MAIN APP WITH AUTHENTICATION
// =============================================================================

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { BrandGuard } from '@/components/auth/BrandGuard';

// Pages
import { ShiftReconciliation } from '@/pages/ShiftReconciliation';
import { Dashboard } from '@/pages/Dashboard';
import { POSPage } from '@/pages/POSPage';
import { ShiftPage } from '@/pages/ShiftPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { SuppliersPage } from '@/pages/suppliers/SuppliersPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { PurchaseOrdersPage } from '@/pages/purchase-orders/PurchaseOrdersPage';
import { CreatePurchaseOrderPage } from '@/pages/purchase-orders/CreatePurchaseOrderPage';
import { PurchaseOrderDetailPage } from '@/pages/purchase-orders/PurchaseOrderDetailPage';
import { GoodsReceiptPage } from '@/pages/purchase-orders/GoodsReceiptPage';
import { SmartOrderPage } from '@/pages/purchase-orders/SmartOrderPage';
import { StockTakePage } from '@/pages/StockTakePage';
import { InventoryPage } from '@/pages/InventoryPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { BarcodePrintPage } from '@/pages/BarcodePrintPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { BranchesPage } from '@/pages/BranchesPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { RegisterTenantPage } from '@/pages/auth/RegisterTenantPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { PricingPage } from '@/pages/PricingPage';
import SecurityPage from '@/pages/SecurityPage';
import { DebtManagementPage } from '@/pages/DebtManagementPage';
import LoyaltyPage from '@/pages/LoyaltyPage';
import { RemindersPage } from '@/pages/RemindersPage';
import LabelPrintPage from '@/pages/LabelPrintPage';
import PlansPage from '@/pages/PlansPage';
import { BillingPage } from '@/pages/billing/BillingPage';
import { AffiliateDashboard } from '@/pages/affiliate/AffiliateDashboard';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { SaaSAdminLayout } from '@/pages/admin/SaaSAdminLayout';
import { AdminPricingPage } from '@/pages/admin/AdminPricingPage';
import { AdminAffiliatesPage } from '@/pages/admin/AdminAffiliatesPage';
import { AdminBrandsPage } from '@/pages/admin/AdminBrandsPage';
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';
import { AuditLogsPage } from '@/pages/admin/AuditLogsPage';
import { AdminInvoicesPage } from '@/pages/admin/AdminInvoicesPage';
import { ImportListPage } from '@/pages/import/ImportListPage';
import { ImportGoodsPage } from '@/pages/import/ImportGoodsPage';
import { MobilePOS } from '@/pages/mobile/MobilePOS';
import { MobileOrderCreate } from '@/pages/mobile/MobileOrderCreate';
import { AffiliateLayout } from '@/pages/affiliate/AffiliateLayout';
import { AffiliateLoginPage } from '@/pages/affiliate/AffiliateLoginPage';
import { AffiliateRegisterPage } from '@/pages/affiliate/AffiliateRegisterPage';
import { PaymentPage } from '@/pages/PaymentPage';
import StockAuditListPage from '@/pages/inventory/StockAuditListPage';
import StockAuditDetailPage from '@/pages/inventory/StockAuditDetailPage';

// Components & Stores
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { MainLayout } from '@/components/layout/MainLayout';
import { useUserStore } from '@/stores/userStore';
import { useAuthStore } from '@/stores/authStore';
import { InstallBanner } from '@/components/pwa/InstallAppButton';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { DomainProvider } from '@/contexts/DomainContext';
import { Toaster } from 'sonner';

import './index.css';

// =============================================================================
// REQUIRE AUTH WRAPPER
// =============================================================================

function RequireAuth({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuthStore();
    const location = useLocation();

    if (!isAuthenticated) {
        // Redirect to login but save the attempted location
        return <Navigate to="/dang-nhap" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuthStore();

    if (isLoading) {
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

    // If inactive, ONLY allow /nhan-vien
    if (location.pathname === '/nhan-vien') {
        return <>{children}</>;
    }

    // Redirect to nhan-vien for inactive users
    return <Navigate to="/nhan-vien" replace />;
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
            <DomainProvider>
                <BrandGuard>
                    <Routes>
                        {/* Public Routes - Auth Pages */}
                        <Route path="/dang-nhap" element={<LoginPage />} />
                        <Route path="/dang-ky" element={<RegisterPage />} />
                        <Route path="/quen-mat-khau" element={<ForgotPasswordPage />} />
                        {/* Public Routes - Auth Pages */}
                        <Route path="/dang-nhap" element={<LoginPage />} />
                        <Route path="/dang-ky" element={<RegisterPage />} />
                        <Route path="/quen-mat-khau" element={<ForgotPasswordPage />} />
                        <Route path="/bang-gia" element={<PricingPage />} />
                        <Route path="/thanh-toan" element={<PaymentPage />} />
                        {/* Legacy redirects for old URLs */}
                        <Route path="/login" element={<Navigate to="/dang-nhap" replace />} />
                        <Route path="/register" element={<Navigate to="/dang-ky" replace />} />

                        {/* POS - Fullscreen without sidebar (requires auth) */}
                        <Route path="/ban-hang" element={
                            <RequireAuth>
                                <POSPage />
                            </RequireAuth>
                        } />

                        {/* Mobile Specific Routes */}
                        <Route path="/mobile-pos" element={
                            <RequireAuth>
                                <MobilePOS />
                            </RequireAuth>
                        } />
                        <Route path="/mobile-orders/create" element={
                            <RequireAuth>
                                <MobileOrderCreate />
                            </RequireAuth>
                        } />

                        {/* Legacy redirect */}
                        <Route path="/pos" element={<Navigate to="/ban-hang" replace />} />

                        {/* All other pages with sidebar (requires auth) */}
                        <Route path="/" element={
                            <RequireAuth>
                                <MainLayout />
                            </RequireAuth>
                        }>
                            <Route index element={<Dashboard />} />
                            <Route path="don-hang" element={<OrdersPage />} />
                            <Route path="san-pham" element={<ProductsPage />} />
                            <Route path="nha-cung-cap" element={<SuppliersPage />} />
                            <Route path="khach-hang" element={<CustomersPage />} />
                            <Route path="tich-diem" element={<LoyaltyPage />} />
                            <Route path="cong-no" element={<DebtManagementPage />} />
                            <Route path="nhap-hang" element={<PurchaseOrdersPage />} />
                            <Route path="nhap-hang/tao-moi" element={<CreatePurchaseOrderPage />} />
                            <Route path="nhap-hang/:id" element={<PurchaseOrderDetailPage />} />
                            <Route path="nhap-hang/:id/chinh-sua" element={<CreatePurchaseOrderPage />} />
                            <Route path="phieu-nhap/:id" element={<GoodsReceiptPage />} />
                            <Route path="ton-kho" element={<InventoryPage />} />
                            <Route path="de-xuat-dat-hang" element={<SmartOrderPage />} />
                            <Route path="dat-hang-ncc" element={<ImportListPage />} />
                            <Route path="dat-hang-ncc/tao-moi" element={<ImportGoodsPage />} />
                            <Route path="dat-hang-ncc/:id" element={<ImportGoodsPage />} />
                            <Route path="kiem-kho" element={<StockTakePage />} /> {/* Legacy */}
                            <Route path="inventory/audits" element={<StockAuditListPage />} />
                            <Route path="inventory/audit/:id" element={<StockAuditDetailPage />} />
                            <Route path="in-ma-vach" element={<BarcodePrintPage />} />
                            <Route path="in-tem" element={<LabelPrintPage />} />
                            <Route path="ca-lam-viec" element={<ShiftPage />} />
                            <Route path="doi-soat" element={<ShiftReconciliation />} />

                            <Route path="cai-dat" element={<SettingsPage />} />
                            <Route path="nhac-nho" element={<RemindersPage />} />

                            <Route path="thanh-toan" element={<BillingPage />} />



                            {/* Affiliate Portal Routes */}
                            <Route path="doi-tac" element={<AffiliateLayout />}>
                                <Route index element={<AffiliateDashboard />} />
                                <Route path="dang-nhap" element={<AffiliateLoginPage />} />
                                <Route path="dang-ky" element={<AffiliateRegisterPage />} />
                            </Route>

                            {/* Legacy redirects for old URLs */}
                            <Route path="orders" element={<Navigate to="/don-hang" replace />} />
                            <Route path="products" element={<Navigate to="/san-pham" replace />} />
                            <Route path="suppliers" element={<Navigate to="/nha-cung-cap" replace />} />
                            <Route path="customers" element={<Navigate to="/khach-hang" replace />} />
                            <Route path="loyalty" element={<Navigate to="/tich-diem" replace />} />
                            <Route path="debt" element={<Navigate to="/cong-no" replace />} />
                            <Route path="inventory" element={<Navigate to="/ton-kho" replace />} />
                            <Route path="import" element={<Navigate to="/dat-hang-ncc" replace />} />
                            <Route path="stock-take" element={<Navigate to="/kiem-kho" replace />} />
                            <Route path="barcode-print" element={<Navigate to="/in-ma-vach" replace />} />
                            <Route path="shift" element={<Navigate to="/ca-lam-viec" replace />} />
                            <Route path="settings" element={<Navigate to="/cai-dat" replace />} />
                            <Route path="reminders" element={<Navigate to="/nhac-nho" replace />} />
                            <Route path="plans" element={<Navigate to="/goi-dich-vu" replace />} />

                            {/* SaaS Admin Routes - Keep English */}
                            <Route path="/admin" element={
                                <RequireAuth>
                                    <SaaSAdminLayout />
                                </RequireAuth>
                            }>
                                <Route index element={<AdminDashboard />} />
                                <Route path="brands" element={<AdminBrandsPage />} />
                                <Route path="affiliates" element={<AdminAffiliatesPage />} />
                                <Route path="pricing" element={<AdminPricingPage />} />
                                <Route path="invoices" element={<AdminInvoicesPage />} />
                                <Route path="logs" element={<AuditLogsPage />} />
                                <Route path="settings" element={<AdminSettingsPage />} />
                            </Route>

                            {/* Admin Rights Required */}
                            <Route path="bao-mat" element={
                                <RequireAdmin>
                                    <SecurityPage />
                                </RequireAdmin>
                            } />

                            {/* Role-Protected Routes (Alternatives using ProtectedRoute) */}
                            <Route element={<ProtectedRoute requireAdmin />}>
                                <Route path="nhan-vien" element={<EmployeesPage />} />
                                <Route path="chi-nhanh" element={<BranchesPage />} />
                                {/* Legacy redirects */}
                                <Route path="employees" element={<Navigate to="/nhan-vien" replace />} />
                                <Route path="branches" element={<Navigate to="/chi-nhanh" replace />} />
                            </Route>

                            {/* Permission Based Routes */}
                            <Route element={<ProtectedRoute requiredPermission="report_sales" />}>
                                <Route path="bao-cao" element={<ReportsPage />} />
                                <Route path="reports" element={<Navigate to="/bao-cao" replace />} />
                            </Route>

                            {/* Catch all */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Route>
                    </Routes>
                    {/* PWA Install Prompt Banner */}
                    <InstallBanner />
                    <OfflineIndicator />
                    {/* Toast Notifications */}
                    <Toaster
                        position="top-center"
                        richColors
                        closeButton
                        expand={false}
                        duration={3000}
                    />
                </BrandGuard>
            </DomainProvider>
        </BrowserRouter>
    );
}

export default App;
