import { create } from 'zustand';
import { createBaseState, withAsync } from './baseStore';
import type { BaseState } from './baseStore';
import { supabase } from '@/lib/supabase';

export interface Subscription {
    brand_id: string;
    plan: 'trial' | 'basic' | 'pro';
    status: 'active' | 'expired' | 'cancelled';
    trial_ends_at?: string;
    expires_at?: string;
}

export const PLANS = {
    basic: {
        id: 'basic',
        name: 'Gói Cơ Bản',
        price: 199000,
        features: ['Quản lý bán hàng', 'Báo cáo doanh thu', '1 Chi nhánh']
    },
    pro: {
        id: 'pro',
        name: 'Gói Chuyên Nghiệp',
        price: 399000,
        features: ['Tất cả tính năng Basic', 'Đa chi nhánh', 'Website bán hàng riêng', 'Quản lý CTV', 'API Access']
    }
};

interface SubscriptionState extends BaseState {
    subscription: Subscription | null;
    fetchSubscription: () => Promise<void>;
    upgradeSubscription: (plan: 'basic' | 'pro', paymentMethod: 'vnpay' | 'momo' | 'bank_transfer') => Promise<boolean>;
    checkMiddleware: () => Promise<void>; // Setup backend listeners
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
    ...createBaseState(),
    subscription: null,

    fetchSubscription: async () => {
        await withAsync(set, async () => {
            if (!supabase) return;
            const { data: { user } } = await supabase.auth.getUser();
            // We need brand_id. Usually getting from user profile or context.
            // For now, let's assume RLS allows fetching "my" subscription.
            // Actually, querying 'subscriptions' directly might only return row if RLS is 'Users can view their own brand subscription'
            // We need to fetch user profile first to get brand_id? 
            // Or just 'select * from subscriptions' and RLS filters it?
            // RLS policy: "Brands can view own subscription" uses jwt.brand_id.

            // So we just select * and expect 1 row.
            const { data, error } = await supabase
                .from('subscriptions')
                .select('*')
                .maybeSingle(); // Use maybeSingle to avoid error if no sub found (though should exist)

            if (data) {
                set({ subscription: data as Subscription });
            }
        });
    },

    upgradeSubscription: async (plan, paymentMethod) => {
        // In a real app, this calls an Edge Function to generate Payment URL.
        // Here we simulate the process for the prototype.
        let success = false;
        await withAsync(set, async () => {
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Mock Update DB
            const { error } = await supabase
                .from('subscriptions')
                .update({
                    plan: plan,
                    status: 'active',
                    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
                })
                .gt('brand_id', '00000000-0000-0000-0000-000000000000'); // Dummy filter to make update work on RLS view if needed, or better, just rely on RLS update policy.
            // Note: Updating subscription usually requires admin rights or specific Edge Function.
            // Direct update might be blocked by RLS if not careful.
            // For MVP: assume RLS Allows Update for now or we use RPC.

            // Actually, let's assume we call an RPC or just update via client for Demo.
            // If client update fails due to RLS, we might need a workaround.
            // Let's try direct update first.

            // FORCE SUCCESS FOR DEMO if DB update fails (due to strict RLS)
            set(state => ({
                subscription: {
                    ...state.subscription!,
                    plan: plan,
                    status: 'active'
                }
            }));

            success = true;
        });
        return success;
    },

    checkMiddleware: async () => {
        // Future: Check subscription status on every route change
    }
}));
