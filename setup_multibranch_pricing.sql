-- ============================================================================
-- SAAS MULTI-BRANCH UPGRADE: PRICING & PERMISSIONS
-- ============================================================================

-- 1. Create Branch Prices Table (Multi-Store Pricing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.branch_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL, -- For easier RLS and centralized management
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    price NUMERIC NOT NULL CHECK (price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one price per product per branch
    UNIQUE(branch_id, product_id)
);

-- Enable RLS
ALTER TABLE public.branch_prices ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view branch prices of their brand" ON public.branch_prices
FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins/Owners/Managers can manage branch prices" ON public.branch_prices
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'owner', 'manager')
        AND brand_id = public.branch_prices.brand_id
    )
);

-- 2. Update User Profiles (Lock staff to branch)
-- ============================================================================
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'assigned_branch_id') THEN
        ALTER TABLE public.user_profiles 
        ADD COLUMN assigned_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Notify Schema Cache Reload
-- ============================================================================
NOTIFY pgrst, 'reload config';
