import { create } from 'zustand';
import { createBaseState, withAsync } from './baseStore';
import type { BaseState } from './baseStore';
import { supabase } from '@/lib/supabase';

export interface AffiliateProfile {
    id: string;
    user_id: string;
    code: string;
    balance: number;
    total_earned: number; // Fixed from total_commission
    bank_name?: string;
    bank_account_number?: string; // Fixed from bank_account_no
    bank_account_name?: string;
    status: 'active' | 'suspended';
}

export interface Commission {
    id: string;
    amount: number;
    status: 'pending' | 'approved' | 'paid' | 'rejected';
    created_at: string;
    referral: {
        brand_name: string;
        status: string;
    };
}

interface AffiliateState extends BaseState {
    profile: AffiliateProfile | null;
    commissions: Commission[]; // Changed from referrals

    fetchProfile: () => Promise<void>;
    registerAffiliate: (bankInfo?: { bankName: string; accNo: string; accName: string }) => Promise<boolean>;
    fetchCommissions: () => Promise<void>; // Changed from fetchReferrals
}

export const useAffiliateStore = create<AffiliateState>((set, get) => ({
    ...createBaseState(),
    profile: null,
    commissions: [],

    fetchProfile: async () => {
        await withAsync(set, async () => {
            if (!supabase) return;
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('affiliates')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (data) {
                set({ profile: data as AffiliateProfile });
            } else {
                set({ profile: null });
            }
        });
    },

    registerAffiliate: async (bankInfo) => {
        let success = false;
        await withAsync(set, async () => {
            if (!supabase) throw new Error('No connection');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Generate random code or use name
            const code = 'CTV' + Math.floor(Math.random() * 100000).toString();

            const { data, error } = await supabase
                .from('affiliates')
                .insert({
                    user_id: user.id,
                    code: code,
                    bank_name: bankInfo?.bankName,
                    bank_account_number: bankInfo?.accNo,
                    bank_account_name: bankInfo?.accName
                })
                .select()
                .single();

            if (error) throw error;
            set({ profile: data as AffiliateProfile });
            success = true;
        });
        return success;
    },

    fetchCommissions: async () => {
        await withAsync(set, async () => {
            const profile = get().profile;
            if (!profile || !supabase) return;

            // Fetch commissions and join referrals and brands
            // Note: Referrals -> Brands
            const { data, error } = await supabase
                .from('commissions')
                .select(`
                    id,
                    amount,
                    status,
                    created_at,
                    referral_id,
                    referral:referrals (
                        status,
                        brand:brands (name)
                    )
                `)
                .eq('affiliate_id', profile.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Map data to simpler structure
            const mapped = data.map((c: any) => ({
                id: c.id,
                amount: c.amount,
                status: c.status,
                created_at: c.created_at,
                referral: {
                    brand_name: c.referral?.brand?.name || 'Unknown Brand',
                    status: c.referral?.status
                }
            }));

            set({ commissions: mapped });
        });
    }
}));
