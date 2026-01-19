import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export interface SaaSInvoice {
    id: string;
    brand_id: string;
    plan_id: string;
    amount: number;
    currency: string;
    billing_period: 'monthly' | 'yearly';
    status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired';
    payment_method: 'transfer' | 'vnpay' | 'momo' | 'manual';
    transaction_code: string | null;
    evidence_url: string | null;
    verified_by: string | null;
    verified_at: string | null;
    rejection_reason: string | null;
    due_date: string | null;
    paid_at: string | null;
    created_at: string;
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
}

export function useBilling() {
    const { brandId } = useAuthStore();
    const [invoices, setInvoices] = useState<SaaSInvoice[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
    const [subscription, setSubscription] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch all available plans
    const fetchPlans = useCallback(async () => {
        if (!supabase) return;

        const { data, error } = await supabase
            .from('plans')
            .select('*')
            .eq('is_active', true)
            .order('price_monthly', { ascending: true });

        if (!error && data) {
            setPlans(data as Plan[]);
        }
    }, []);

    // Fetch current subscription
    const fetchSubscription = useCallback(async () => {
        if (!supabase || !brandId) return;

        const { data, error } = await supabase
            .from('subscriptions')
            .select('*, plan:plan_id(*)')
            .eq('brand_id', brandId)
            .single();

        if (!error && data) {
            setSubscription(data);
            setCurrentPlan(data.plan as Plan);
        }
    }, [brandId]);

    // Fetch invoices for current brand
    const fetchInvoices = useCallback(async () => {
        if (!supabase || !brandId) return;

        const { data, error } = await supabase
            .from('saas_invoices')
            .select('*')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setInvoices(data as SaaSInvoice[]);
        }
    }, [brandId]);

    // Create new invoice (upgrade request)
    const createInvoice = async (planId: string, billingPeriod: 'monthly' | 'yearly', paymentMethod: string) => {
        if (!supabase || !brandId) return { success: false, error: 'Not authenticated' };

        // Get plan price
        const plan = plans.find(p => p.id === planId);
        if (!plan) return { success: false, error: 'Plan not found' };

        const amount = billingPeriod === 'yearly' ? plan.price_yearly : plan.price_monthly;

        const { data, error } = await supabase.rpc('create_saas_invoice', {
            p_brand_id: brandId,
            p_plan_id: planId,
            p_amount: amount,
            p_billing_period: billingPeriod,
            p_payment_method: paymentMethod
        });

        if (error) {
            console.error('[useBilling] Create invoice error:', error);
            return { success: false, error: error.message };
        }

        await fetchInvoices();
        return { success: true, invoiceId: data };
    };

    // Upload payment evidence
    const uploadEvidence = async (invoiceId: string, file: File) => {
        if (!supabase || !brandId) return { success: false, error: 'Not authenticated' };

        const fileExt = file.name.split('.').pop();
        const fileName = `${brandId}/${invoiceId}.${fileExt}`;

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('payment-evidence')
            .upload(fileName, file, { upsert: true });

        if (uploadError) {
            return { success: false, error: uploadError.message };
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('payment-evidence')
            .getPublicUrl(fileName);

        // Update invoice
        const { error: updateError } = await supabase
            .from('saas_invoices')
            .update({ evidence_url: urlData.publicUrl })
            .eq('id', invoiceId);

        if (updateError) {
            return { success: false, error: updateError.message };
        }

        await fetchInvoices();
        return { success: true, url: urlData.publicUrl };
    };

    // Update transaction code
    const updateTransactionCode = async (invoiceId: string, code: string) => {
        if (!supabase) return { success: false, error: 'Not connected' };

        const { error } = await supabase
            .from('saas_invoices')
            .update({ transaction_code: code })
            .eq('id', invoiceId);

        if (error) {
            return { success: false, error: error.message };
        }

        await fetchInvoices();
        return { success: true };
    };

    // Initial fetch
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await Promise.all([fetchPlans(), fetchSubscription(), fetchInvoices()]);
            setIsLoading(false);
        };
        loadData();
    }, [fetchPlans, fetchSubscription, fetchInvoices]);

    return {
        plans,
        currentPlan,
        subscription,
        invoices,
        isLoading,
        createInvoice,
        uploadEvidence,
        updateTransactionCode,
        refetch: () => Promise.all([fetchPlans(), fetchSubscription(), fetchInvoices()])
    };
}

// Admin hook for managing all invoices
export function useAdminBilling() {
    const [allInvoices, setAllInvoices] = useState<SaaSInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchAllInvoices = useCallback(async () => {
        if (!supabase) return;
        setIsLoading(true);

        const { data, error } = await supabase
            .from('saas_invoices')
            .select('*, brands(name)')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setAllInvoices(data as any[]);
        }
        setIsLoading(false);
    }, []);

    const verifyInvoice = async (invoiceId: string, approved: boolean, rejectionReason?: string) => {
        if (!supabase) return { success: false, error: 'Not connected' };

        const { data, error } = await supabase.rpc('verify_saas_invoice', {
            p_invoice_id: invoiceId,
            p_approved: approved,
            p_rejection_reason: rejectionReason || null
        });

        if (error) {
            return { success: false, error: error.message };
        }

        await fetchAllInvoices();
        return { success: true };
    };

    useEffect(() => {
        fetchAllInvoices();
    }, [fetchAllInvoices]);

    return {
        allInvoices,
        isLoading,
        verifyInvoice,
        refetch: fetchAllInvoices
    };
}
