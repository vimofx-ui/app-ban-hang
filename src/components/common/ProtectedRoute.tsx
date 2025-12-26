// =============================================================================
// PROTECTED ROUTE COMPONENT
// Wraps routes to ensure user has required permissions
// =============================================================================

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUserStore } from '@/stores/userStore';
import { useAuthStore } from '@/stores/authStore';
import type { Permission } from '@/stores/userStore';

interface ProtectedRouteProps {
    requiredPermission?: Permission;
    requireAdmin?: boolean;
}

export function ProtectedRoute({ requiredPermission, requireAdmin }: ProtectedRouteProps) {
    const { user: authUser, loading } = useAuthStore();
    const { hasPermission, users } = useUserStore();
    const location = useLocation();

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>;
    }

    // 1. Check if authenticated via authStore
    if (!authUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 2. Check admin/owner requirement
    if (requireAdmin && authUser.role !== 'admin' && authUser.role !== 'owner') {
        return <Navigate to="/" replace />;
    }

    // 3. Check specific permission
    if (requiredPermission) {
        // Find full user profile for permission check
        const fullUserProfile = users.find(u => u.id === authUser.id);

        // Admin/Owner always has all permissions
        if (authUser.role === 'admin' || authUser.role === 'owner') {
            return <Outlet />;
        }

        // Check permission for non-admin users
        if (fullUserProfile && !hasPermission(fullUserProfile, requiredPermission)) {
            return <Navigate to="/" replace />;
        }
    }

    return <Outlet />;
}
