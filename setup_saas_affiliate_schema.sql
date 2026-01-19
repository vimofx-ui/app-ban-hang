-- =============================================================================
-- SAAS & AFFILIATE SYSTEM SCHEMA
-- =============================================================================

-- 1. SUBSCRIPTIONS (Quản lý gói dịch vụ của Brand)
-- =============================================================================
CREATE TYPE subscription_plan AS ENUM ('trial', 'basic', 'pro');
CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'calcelled');

CREATE TABLE IF NOT EXISTS subscriptions (
    brand_id UUID PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
    plan subscription_plan DEFAULT 'trial',
    status subscription_status DEFAULT 'active',
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL means never expires (if we want auto-renew logic later)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for Subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Brands can view their own subscription
CREATE POLICY "Brands can view own subscription" ON subscriptions
    FOR SELECT
    USING (brand_id = (current_setting('request.jwt.claim.brand_id', true)::uuid));

-- 2. AFFILIATES (Quản lý Cộng tác viên)
-- =============================================================================
CREATE TABLE IF NOT EXISTS affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id), -- Link to a user account (could be a specialized affiliate account)
    code TEXT UNIQUE NOT NULL, -- Referral code (e.g., 'CTV001', 'MINH123')
    phone TEXT,
    bank_name TEXT,
    bank_account_number TEXT,
    bank_account_name TEXT,
    commission_rate_basic DECIMAL(5,2) DEFAULT 30.00, -- 30% for Basic
    commission_rate_pro DECIMAL(5,2) DEFAULT 40.00,   -- 40% for Pro
    balance DECIMAL(15,2) DEFAULT 0, -- Current wallet balance
    total_earned DECIMAL(15,2) DEFAULT 0, -- Lifetime earnings
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for Affiliates
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

-- Affiliates can view their own profile
CREATE POLICY "Affiliates can view own profile" ON affiliates
    FOR SELECT
    USING (user_id = auth.uid());

-- 3. REFERRALS (Quản lý giới thiệu)
-- =============================================================================
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID REFERENCES affiliates(id),
    referred_brand_id UUID REFERENCES brands(id),
    status TEXT DEFAULT 'trial' CHECK (status IN ('trial', 'converted', 'paid')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for Referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Affiliates can view their referrals
CREATE POLICY "Affiliates can view own referrals" ON referrals
    FOR SELECT
    USING (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));

-- 4. COMMISSIONS (Hoa hồng)
-- =============================================================================
CREATE TABLE IF NOT EXISTS commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID REFERENCES affiliates(id),
    referral_id UUID REFERENCES referrals(id),
    amount DECIMAL(15,2) NOT NULL,
    order_amount DECIMAL(15,2) NOT NULL, -- The value of the subscription payment
    plan_type TEXT, -- 'basic' or 'pro'
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for Commissions
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- Affiliates can view their commissions
CREATE POLICY "Affiliates can view own commissions" ON commissions
    FOR SELECT
    USING (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));

-- 5. PAYOUTS (Rút tiền)
-- =============================================================================
CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID REFERENCES affiliates(id),
    amount DECIMAL(15,2) NOT NULL,
    bank_info JSONB, -- Snapshot of bank info at time of request
    status TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'processing', 'completed', 'rejected')),
    proof_image_url TEXT, -- Url to transaction receipt image
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- RLS for Payouts
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Affiliates can view and create payouts
CREATE POLICY "Affiliates can view own payouts" ON payouts
    FOR SELECT
    USING (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));

CREATE POLICY "Affiliates can request payouts" ON payouts
    FOR INSERT
    WITH CHECK (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));

-- =============================================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================================

-- Function to set default trial subscription when a brand is created
CREATE OR REPLACE FUNCTION handle_new_brand_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO subscriptions (brand_id, plan, trial_ends_at)
    VALUES (NEW.id, 'trial', NOW() + INTERVAL '14 days');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new brands
DROP TRIGGER IF EXISTS on_brand_created_subscription ON brands;
CREATE TRIGGER on_brand_created_subscription
AFTER INSERT ON brands
FOR EACH ROW
EXECUTE FUNCTION handle_new_brand_subscription();

-- Function to track referral if code is present in user metadata (requires flow update)
-- For now, we assume referral link sets a cookie and passed during registration
-- This logic assumes we have a way to match registration -> affiliate code.
