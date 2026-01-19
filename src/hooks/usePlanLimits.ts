import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export interface PlanLimits {
    plan_id: string;
    plan_name: string;
    limits: {
        max_branches: number;
        max_users: number;
        max_products: number;
    };
    usage: {
        branches: number;
        users: number;
        products: number;
    };
    can_add_branch: boolean;
    can_add_user: boolean;
    can_add_product: boolean;
    features: {
        pos: boolean;
        reports: boolean;
        api: boolean;
    };
}

export interface Plan {
    id: string;
    name: string;
    price_monthly: number;
    price_yearly: number;
    max_branches: number;
    max_users: number;
    max_products: number;
    features: Record<string, boolean>;
    is_active: boolean;
}

/**
 * Hook to get and check plan limits for the current brand
 */
export function usePlanLimits() {
    const { brandId } = useAuthStore();
    const [limits, setLimits] = useState<PlanLimits | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLimits = useCallback(async () => {
        if (!supabase || !brandId) {
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            const { data, error: rpcError } = await supabase.rpc('get_brand_plan_limits', {
                p_brand_id: brandId
            });

            if (rpcError) throw rpcError;
            setLimits(data as PlanLimits);
            setError(null);
        } catch (err: any) {
            console.error('[usePlanLimits] Error:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [brandId]);

    useEffect(() => {
        fetchLimits();
    }, [fetchLimits]);

    /**
     * Check if can add a branch before attempting
     */
    const checkCanAddBranch = async (): Promise<{ allowed: boolean; message?: string }> => {
        if (!supabase || !brandId) return { allowed: false, message: 'Not authenticated' };

        try {
            const { data, error } = await supabase.rpc('check_can_add_branch', {
                p_brand_id: brandId
            });

            if (error) throw error;
            return data as { allowed: boolean; message?: string };
        } catch (err: any) {
            return { allowed: false, message: err.message };
        }
    };

    /**
     * Check if can add a user before attempting
     */
    const checkCanAddUser = async (): Promise<{ allowed: boolean; message?: string }> => {
        if (!supabase || !brandId) return { allowed: false, message: 'Not authenticated' };

        try {
            const { data, error } = await supabase.rpc('check_can_add_user', {
                p_brand_id: brandId
            });

            if (error) throw error;
            return data as { allowed: boolean; message?: string };
        } catch (err: any) {
            return { allowed: false, message: err.message };
        }
    };

    /**
     * Get usage percentage for a specific resource
     */
    const getUsagePercentage = (resource: 'branches' | 'users' | 'products'): number => {
        if (!limits) return 0;
        const max = limits.limits[`max_${resource}` as keyof typeof limits.limits];
        const current = limits.usage[resource];
        if (max === -1) return 0; // Unlimited
        return Math.min((current / max) * 100, 100);
    };

    /**
     * Check if a feature is enabled in current plan
     */
    const hasFeature = (feature: string): boolean => {
        if (!limits?.features) return false;
        return !!limits.features[feature as keyof typeof limits.features];
    };

    return {
        limits,
        isLoading,
        error,
        refetch: fetchLimits,
        checkCanAddBranch,
        checkCanAddUser,
        getUsagePercentage,
        hasFeature
    };
}

/**
 * Hook to get all available plans
 */
export function usePlans() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPlans = async () => {
            if (!supabase) return;

            try {
                const { data, error } = await supabase
                    .from('plans')
                    .select('*')
                    .eq('is_active', true)
                    .order('price_monthly', { ascending: true });

                if (error) throw error;
                setPlans(data as Plan[]);
            } catch (err) {
                console.error('[usePlans] Error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlans();
    }, []);

    return { plans, isLoading };
}

export default usePlanLimits;
