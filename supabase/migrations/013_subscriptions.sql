-- 1. Create PLANS table
CREATE TABLE IF NOT EXISTS public.plans (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    price numeric(12, 2) NOT NULL DEFAULT 0,
    currency text DEFAULT 'VND',
    max_branches int DEFAULT 1,
    max_users int DEFAULT 5,
    features jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create BRAND_SUBSCRIPTIONS table
CREATE TABLE IF NOT EXISTS public.brand_subscriptions (
    brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE PRIMARY KEY,
    plan_id uuid REFERENCES public.plans(id),
    status text DEFAULT 'active', -- active, trial, past_due, canceled
    start_date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Seed Default Plans
INSERT INTO public.plans (name, price, max_branches, max_users, features)
VALUES 
    ('Free', 0, 1, 3, '["basic_pos", "simple_reports"]'),
    ('Startup', 199000, 3, 10, '["multi_branch", "advanced_reports", "customer_loyalty"]'),
    ('Enterprise', 499000, 100, 1000, '["unlimited_branches", "api_access", "white_label"]')
ON CONFLICT DO NOTHING;

-- 4. Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_subscriptions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Plans: Everyone can read
CREATE POLICY "Public read plans" ON public.plans FOR SELECT USING (true);

-- Subscriptions: Users can read their own brand's subscription
CREATE POLICY "Users view own brand subscription" ON public.brand_subscriptions
FOR SELECT USING (
    brand_id IN (
        SELECT brand_id FROM public.user_profiles WHERE id = auth.uid()
    )
);

-- 6. Helper Function: Check Branch Limit
CREATE OR REPLACE FUNCTION public.check_branch_limit(p_brand_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_count int;
    v_max_branches int;
BEGIN
    -- Get current branch count
    SELECT count(*) INTO v_current_count
    FROM public.branches
    WHERE brand_id = p_brand_id;

    -- Get max branches from subscription
    SELECT p.max_branches INTO v_max_branches
    FROM public.brand_subscriptions bs
    JOIN public.plans p ON p.id = bs.plan_id
    WHERE bs.brand_id = p_brand_id
    AND bs.status IN ('active', 'trial');

    -- Default to Free plan limits if no subscription found (1 branch)
    IF v_max_branches IS NULL THEN
        v_max_branches := 1;
    END IF;

    RETURN v_current_count < v_max_branches;
END;
$$;

-- 7. Trigger to Auto-Subscribe to Free Plan on Brand Creation
CREATE OR REPLACE FUNCTION public.handle_new_brand_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_free_plan_id uuid;
BEGIN
    -- Find Free Plan
    SELECT id INTO v_free_plan_id FROM public.plans WHERE price = 0 LIMIT 1;

    IF v_free_plan_id IS NOT NULL THEN
        INSERT INTO public.brand_subscriptions (brand_id, plan_id, status)
        VALUES (NEW.id, v_free_plan_id, 'active');
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_brand_created_add_subscription
AFTER INSERT ON public.brands
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_brand_subscription();
