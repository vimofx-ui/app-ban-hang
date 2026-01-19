// =============================================================================
// SUBSCRIPTION HOOK - Manage plan limits and trial expiry
// =============================================================================

import { useMemo } from 'react';
import { useBrandStore } from '@/stores/brandStore';

export interface SubscriptionInfo {
    plan: 'trial' | 'basic' | 'pro';
    isTrialExpired: boolean;
    daysLeft: number;
    canAccessFeature: (feature: FeatureName) => boolean;
    shouldShowUpgrade: boolean;
    limits: PlanLimits;
}

export type FeatureName =
    | 'offline'
    | 'reports'
    | 'multi_branch'
    | 'export_excel'
    | 'import_excel'
    | 'white_label'
    | 'custom_domain';

export interface PlanLimits {
    maxBranches: number;
    maxUsers: number;
    maxProducts: number;
    offlineMode: boolean;
    advancedReports: boolean;
    exportExcel: boolean;
}

// Plan configuration
const PLAN_CONFIG: Record<string, PlanLimits> = {
    trial: {
        maxBranches: 1,
        maxUsers: 5,
        maxProducts: Infinity,
        offlineMode: false,
        advancedReports: false,
        exportExcel: false,
    },
    basic: {
        maxBranches: 1,
        maxUsers: 5,
        maxProducts: Infinity,
        offlineMode: false,
        advancedReports: false,
        exportExcel: true,
    },
    pro: {
        maxBranches: Infinity,
        maxUsers: Infinity,
        maxProducts: Infinity,
        offlineMode: true,
        advancedReports: true,
        exportExcel: true,
    },
};

// Feature to plan mapping
const FEATURE_REQUIREMENTS: Record<FeatureName, ('trial' | 'basic' | 'pro')[]> = {
    offline: ['pro'],
    reports: ['pro'],
    multi_branch: ['pro'],
    export_excel: ['basic', 'pro'],
    import_excel: ['trial', 'basic', 'pro'],
    white_label: ['pro'],
    custom_domain: ['pro'],
};

export function useSubscription(): SubscriptionInfo {
    const { currentBrand } = useBrandStore();

    return useMemo(() => {
        if (!currentBrand) {
            return {
                plan: 'trial',
                isTrialExpired: false,
                daysLeft: 0,
                canAccessFeature: () => false,
                shouldShowUpgrade: false,
                limits: PLAN_CONFIG.trial,
            };
        }

        const plan = (currentBrand.plan || 'trial') as 'trial' | 'basic' | 'pro';
        const limits = PLAN_CONFIG[plan] || PLAN_CONFIG.trial;

        // Calculate trial expiry
        let isTrialExpired = false;
        let daysLeft = 0;

        if (plan === 'trial') {
            const trialEndsAt = (currentBrand as any).trial_ends_at;
            if (trialEndsAt) {
                const endDate = new Date(trialEndsAt).getTime();
                const now = new Date().getTime();
                daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                isTrialExpired = daysLeft <= 0;
            }
        }

        // Check feature access
        const canAccessFeature = (feature: FeatureName): boolean => {
            // If trial expired, block all features
            if (plan === 'trial' && isTrialExpired) {
                return false;
            }

            const allowedPlans = FEATURE_REQUIREMENTS[feature];
            return allowedPlans.includes(plan);
        };

        // Should show upgrade prompt
        const shouldShowUpgrade =
            isTrialExpired ||
            (plan === 'trial' && daysLeft <= 3) ||
            plan === 'basic';

        return {
            plan,
            isTrialExpired,
            daysLeft,
            canAccessFeature,
            shouldShowUpgrade,
            limits,
        };
    }, [currentBrand]);
}

// Helper to check if brand is locked
export function isBrandLocked(brand: any): boolean {
    if (!brand) return true;

    if (brand.status === 'suspended' || brand.status === 'expired') {
        return true;
    }

    if (brand.plan === 'trial' && brand.trial_ends_at) {
        const endDate = new Date(brand.trial_ends_at).getTime();
        return endDate < Date.now();
    }

    return false;
}

// Get plan display name
export function getPlanDisplayName(plan: string): string {
    switch (plan) {
        case 'trial': return 'Dùng thử';
        case 'basic': return 'Basic';
        case 'pro': return 'Pro';
        default: return plan;
    }
}

// Get plan badge color
export function getPlanBadgeColor(plan: string): { bg: string; text: string; border: string } {
    switch (plan) {
        case 'trial':
            return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' };
        case 'basic':
            return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' };
        case 'pro':
            return { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' };
        default:
            return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' };
    }
}
