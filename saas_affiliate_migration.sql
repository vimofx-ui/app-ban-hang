-- =============================================================================
-- SAAS MULTI-TENANCY & AFFILIATE MIGRATION
-- =============================================================================

-- 0. HELPER FUNCTIONS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'owner')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 1. SAAS CORE TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(20) DEFAULT 'trial' CHECK (plan IN ('trial', 'basic', 'pro')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
    trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
    subscription_expires_at TIMESTAMPTZ,
    
    -- Design & Settings
    logo_url TEXT,
    primary_color VARCHAR(20),
    secondary_color VARCHAR(20),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add brand_id to user_profiles if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'brand_id') THEN
        ALTER TABLE public.user_profiles ADD COLUMN brand_id UUID REFERENCES public.brands(id);
    END IF;
    
    -- Also add branch_id if we want full structure later, but keep simple for now
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'branch_id') THEN
        ALTER TABLE public.user_profiles ADD COLUMN branch_id UUID; -- REFERENCES branches(id) when created
    END IF;
END $$;

-- 2. AFFILIATE MARKETING (CTV) TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.affiliates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE, -- One affiliate account per user
    code VARCHAR(50) UNIQUE NOT NULL, -- Referral code (e.g. NAM123)
    
    balance DECIMAL(15,2) DEFAULT 0,
    total_commission DECIMAL(15,2) DEFAULT 0,
    
    bank_name VARCHAR(100),
    bank_account_no VARCHAR(50),
    bank_account_name VARCHAR(100),
    
    status VARCHAR(20) DEFAULT 'active', -- active, banned
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    affiliate_id UUID REFERENCES public.affiliates(id),
    brand_id UUID REFERENCES public.brands(id), -- The brand that signed up
    
    commission_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS POLICIES FOR NEW TABLES
-- =============================================================================

-- Brands: Public read for subdomain resolution? Or authenticated read?
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read brands" ON public.brands FOR SELECT USING (true);
CREATE POLICY "Admin full access brands" ON public.brands FOR ALL TO authenticated USING (public.is_admin());

-- Affiliates: Users can read/update their own
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own affiliate profile" ON public.affiliates
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Referrals: Affiliates can see their referrals
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates view own referrals" ON public.referrals
    FOR SELECT TO authenticated
    USING (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));

-- 4. FUNCTIONS & TRIGGERS
-- =============================================================================

-- Auto-create Affiliate Profile (optional, or manual registration)
-- Let's leave it manual for now via API.

-- Function to calculate commission (Trigger on subscription payment? Or manual?)
-- Simplification: Admin manually marks referrals as paid or we build a payment flow later.

NOTIFY pgrst, 'reload config';
