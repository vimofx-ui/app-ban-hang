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
    const { user: authUser } = useAuthStore();
    const { hasPermission, users } = useUserStore();
    const location = useLocation();

    // 1. Check if authenticated via authStore
    if (!authUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 2. Check admin requirement
    if (requireAdmin && authUser.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    // 3. Check specific permission
    if (requiredPermission) {
        // Find full user profile for permission check
        const fullUserProfile = users.find(u => u.id === authUser.id);

        // Admin always has all permissions
        if (authUser.role === 'admin') {
            return <Outlet />;
        }

        // Check permission for non-admin users
        if (fullUserProfile && !hasPermission(fullUserProfile, requiredPermission)) {
            return <Navigate to="/" replace />;
        }
    }

    return <Outlet />;
}
