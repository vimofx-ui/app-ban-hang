import { usePlanLimits } from '@/hooks/usePlanLimits';
import { AlertTriangle, ArrowUpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PlanLimitWarningProps {
    resource: 'branches' | 'users' | 'products';
    showUpgradeLink?: boolean;
}

/**
 * Display a warning when approaching or at plan limit
 */
export function PlanLimitWarning({ resource, showUpgradeLink = true }: PlanLimitWarningProps) {
    const { limits, isLoading } = usePlanLimits();

    if (isLoading || !limits) return null;

    const resourceLabels = {
        branches: 'chi nhánh',
        users: 'nhân viên',
        products: 'sản phẩm'
    };

    const max = limits.limits[`max_${resource}` as keyof typeof limits.limits];
    const current = limits.usage[resource];

    // Don't show for unlimited plans
    if (max === -1) return null;

    // Calculate percentage
    const percentage = (current / max) * 100;

    // Only show if at 80% or more
    if (percentage < 80) return null;

    const isAtLimit = current >= max;

    return (
        <div className={`rounded-lg p-3 mb-4 flex items-start gap-3 ${isAtLimit ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
            }`}>
            <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${isAtLimit ? 'text-red-500' : 'text-yellow-500'
                }`} />
            <div className="flex-1">
                <p className={`text-sm font-medium ${isAtLimit ? 'text-red-800' : 'text-yellow-800'
                    }`}>
                    {isAtLimit
                        ? `Bạn đã đạt giới hạn ${resourceLabels[resource]} (${current}/${max})`
                        : `Sắp đạt giới hạn ${resourceLabels[resource]} (${current}/${max})`
                    }
                </p>
                <p className={`text-xs mt-0.5 ${isAtLimit ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                    Gói hiện tại: <strong>{limits.plan_name}</strong>
                </p>
            </div>
            {showUpgradeLink && (
                <Link
                    to="/goi-dich-vu"
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isAtLimit
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-yellow-600 text-white hover:bg-yellow-700'
                        }`}
                >
                    <ArrowUpCircle size={14} />
                    Nâng cấp
                </Link>
            )}
        </div>
    );
}

/**
 * Display current usage for dashboard
 */
export function PlanUsageCard() {
    const { limits, isLoading, getUsagePercentage } = usePlanLimits();

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl p-4 border border-gray-200 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-2 bg-gray-200 rounded"></div>
                    <div className="h-2 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (!limits) return null;

    const resources = [
        { key: 'branches' as const, label: 'Chi nhánh', max: limits.limits.max_branches, current: limits.usage.branches },
        { key: 'users' as const, label: 'Nhân viên', max: limits.limits.max_users, current: limits.usage.users },
        { key: 'products' as const, label: 'Sản phẩm', max: limits.limits.max_products, current: limits.usage.products },
    ];

    return (
        <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Sử dụng tài nguyên</h3>
                <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                    {limits.plan_name}
                </span>
            </div>
            <div className="space-y-3">
                {resources.map(({ key, label, max, current }) => {
                    const percentage = getUsagePercentage(key);
                    const isUnlimited = max === -1;

                    return (
                        <div key={key}>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-600">{label}</span>
                                <span className="font-medium text-gray-800">
                                    {current}{!isUnlimited && ` / ${max}`}
                                    {isUnlimited && ' (Không giới hạn)'}
                                </span>
                            </div>
                            {!isUnlimited && (
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${percentage >= 100 ? 'bg-red-500' :
                                                percentage >= 80 ? 'bg-yellow-500' :
                                                    'bg-green-500'
                                            }`}
                                        style={{ width: `${Math.min(percentage, 100)}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <Link
                to="/goi-dich-vu"
                className="mt-4 block text-center text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
                Xem chi tiết gói →
            </Link>
        </div>
    );
}
