-- =============================================================================
-- PHASE 2: SaaS Invoices Table for Billing
-- =============================================================================

-- 1. Create saas_invoices table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.saas_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.plans(id),
    
    -- Billing details
    amount DECIMAL(12, 2) NOT NULL,
    currency TEXT DEFAULT 'VND',
    billing_period TEXT CHECK (billing_period IN ('monthly', 'yearly')),
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired')),
    
    -- Payment info
    payment_method TEXT CHECK (payment_method IN ('transfer', 'vnpay', 'momo', 'manual')),
    transaction_code TEXT, -- Mã giao dịch từ cổng TT hoặc người dùng nhập
    evidence_url TEXT, -- URL ảnh chuyển khoản (upload to storage)
    
    -- Admin verification
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Timestamps
    due_date TIMESTAMPTZ, -- Hạn thanh toán
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_saas_invoices_brand ON public.saas_invoices(brand_id);
CREATE INDEX IF NOT EXISTS idx_saas_invoices_status ON public.saas_invoices(status);
CREATE INDEX IF NOT EXISTS idx_saas_invoices_created ON public.saas_invoices(created_at DESC);

-- 3. Enable RLS
-- =============================================================================
ALTER TABLE public.saas_invoices ENABLE ROW LEVEL SECURITY;

-- Brands can view their own invoices
CREATE POLICY "Brands can view own invoices" ON public.saas_invoices
FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid())
);

-- Super admin can view all invoices
CREATE POLICY "Super admin can view all invoices" ON public.saas_invoices
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- Super admin can update invoices (for verification)
CREATE POLICY "Super admin can update invoices" ON public.saas_invoices
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- Brands can insert their own invoices (create payment request)
CREATE POLICY "Brands can create invoices" ON public.saas_invoices
FOR INSERT WITH CHECK (
    brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid())
);

-- 4. Create function to create invoice
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_saas_invoice(
    p_brand_id UUID,
    p_plan_id UUID,
    p_amount DECIMAL,
    p_billing_period TEXT,
    p_payment_method TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invoice_id UUID;
BEGIN
    INSERT INTO saas_invoices (brand_id, plan_id, amount, billing_period, payment_method, due_date)
    VALUES (p_brand_id, p_plan_id, p_amount, p_billing_period, p_payment_method, NOW() + INTERVAL '7 days')
    RETURNING id INTO v_invoice_id;
    
    -- Log activity
    PERFORM log_activity(
        p_brand_id,
        auth.uid(),
        'CREATE_INVOICE',
        'subscription',
        v_invoice_id::TEXT,
        NULL,
        jsonb_build_object('amount', p_amount, 'plan_id', p_plan_id)
    );
    
    RETURN v_invoice_id;
END;
$$;

-- 5. Create function to verify invoice (admin only)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.verify_saas_invoice(
    p_invoice_id UUID,
    p_approved BOOLEAN,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invoice RECORD;
BEGIN
    -- Check if caller is super_admin
    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
        RAISE EXCEPTION 'Only super_admin can verify invoices';
    END IF;
    
    -- Get invoice
    SELECT * INTO v_invoice FROM saas_invoices WHERE id = p_invoice_id;
    
    IF v_invoice IS NULL THEN
        RAISE EXCEPTION 'Invoice not found';
    END IF;
    
    IF p_approved THEN
        -- Update invoice to paid
        UPDATE saas_invoices 
        SET status = 'paid', 
            paid_at = NOW(), 
            verified_by = auth.uid(), 
            verified_at = NOW(),
            updated_at = NOW()
        WHERE id = p_invoice_id;
        
        -- Update subscription
        UPDATE subscriptions 
        SET plan_id = v_invoice.plan_id,
            status = 'active',
            started_at = NOW(),
            expires_at = CASE 
                WHEN v_invoice.billing_period = 'yearly' THEN NOW() + INTERVAL '1 year'
                ELSE NOW() + INTERVAL '1 month'
            END
        WHERE brand_id = v_invoice.brand_id;
        
        -- Log activity
        PERFORM log_activity(
            v_invoice.brand_id,
            auth.uid(),
            'APPROVE_INVOICE',
            'subscription',
            p_invoice_id::TEXT,
            jsonb_build_object('status', 'pending'),
            jsonb_build_object('status', 'paid')
        );
    ELSE
        -- Reject invoice
        UPDATE saas_invoices 
        SET status = 'failed', 
            rejection_reason = p_rejection_reason,
            verified_by = auth.uid(), 
            verified_at = NOW(),
            updated_at = NOW()
        WHERE id = p_invoice_id;
        
        -- Log activity
        PERFORM log_activity(
            v_invoice.brand_id,
            auth.uid(),
            'REJECT_INVOICE',
            'subscription',
            p_invoice_id::TEXT,
            NULL,
            jsonb_build_object('reason', p_rejection_reason)
        );
    END IF;
    
    RETURN TRUE;
END;
$$;

-- 6. Grant permissions
-- =============================================================================
GRANT SELECT, INSERT ON public.saas_invoices TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_saas_invoice(UUID, UUID, DECIMAL, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_saas_invoice(UUID, BOOLEAN, TEXT) TO authenticated;

-- =============================================================================
NOTIFY pgrst, 'reload config';
SELECT 'SaaS Invoices table created!' AS status;
