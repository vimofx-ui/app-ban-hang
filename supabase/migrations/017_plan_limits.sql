-- =============================================================================
-- PLAN FEATURE LIMITS (Simple version - works with existing plans table)
-- =============================================================================

-- 1. ADD MISSING COLUMNS TO PLANS TABLE
-- =============================================================================
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price_monthly INT DEFAULT 0;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price_yearly INT DEFAULT 0;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_branches INT DEFAULT 1;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_users INT DEFAULT 3;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_products INT DEFAULT 100;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. UPDATE EXISTING PLANS BY NAME (more reliable than ID)
-- =============================================================================
UPDATE public.plans SET 
    price_monthly = 0, price_yearly = 0, 
    max_branches = 1, max_users = 2, max_products = 50,
    features = '{"pos": true, "reports": false, "api": false}'::jsonb,
    is_active = true
WHERE name ILIKE '%trial%' OR name ILIKE '%thử%';

UPDATE public.plans SET 
    price_monthly = 199000, price_yearly = 1990000, 
    max_branches = 2, max_users = 5, max_products = 500,
    features = '{"pos": true, "reports": true, "api": false}'::jsonb,
    is_active = true
WHERE name ILIKE '%basic%' OR name ILIKE '%cơ bản%';

UPDATE public.plans SET 
    price_monthly = 499000, price_yearly = 4990000, 
    max_branches = 10, max_users = 20, max_products = -1,
    features = '{"pos": true, "reports": true, "api": true}'::jsonb,
    is_active = true
WHERE name ILIKE '%pro%' OR name ILIKE '%chuyên%';

-- 3. FUNCTION: Get current plan limits for a brand
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_brand_plan_limits(p_brand_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan_id UUID;
    v_plan_record RECORD;
    v_current_branches INT;
    v_current_users INT;
    v_current_products INT;
BEGIN
    -- Get brand's current plan from subscriptions
    SELECT s.plan_id INTO v_plan_id
    FROM subscriptions s
    WHERE s.brand_id = p_brand_id;

    -- If no subscription, get first plan (trial)
    IF v_plan_id IS NULL THEN
        SELECT id INTO v_plan_id FROM plans ORDER BY price_monthly ASC LIMIT 1;
    END IF;

    -- Get plan limits
    SELECT * INTO v_plan_record FROM plans WHERE id = v_plan_id;

    -- Fallback to first plan if not found
    IF v_plan_record IS NULL THEN
        SELECT * INTO v_plan_record FROM plans ORDER BY price_monthly ASC LIMIT 1;
    END IF;

    -- Count current usage
    SELECT COUNT(*) INTO v_current_branches FROM branches WHERE brand_id = p_brand_id;
    SELECT COUNT(*) INTO v_current_users FROM user_profiles WHERE brand_id = p_brand_id;
    SELECT COUNT(*) INTO v_current_products FROM products WHERE brand_id = p_brand_id;

    RETURN jsonb_build_object(
        'plan_id', v_plan_id,
        'plan_name', COALESCE(v_plan_record.name, 'Trial'),
        'limits', jsonb_build_object(
            'max_branches', COALESCE(v_plan_record.max_branches, 1),
            'max_users', COALESCE(v_plan_record.max_users, 3),
            'max_products', COALESCE(v_plan_record.max_products, 100)
        ),
        'usage', jsonb_build_object(
            'branches', v_current_branches,
            'users', v_current_users,
            'products', v_current_products
        ),
        'can_add_branch', v_current_branches < COALESCE(v_plan_record.max_branches, 1),
        'can_add_user', v_current_users < COALESCE(v_plan_record.max_users, 3),
        'can_add_product', COALESCE(v_plan_record.max_products, 100) = -1 OR v_current_products < COALESCE(v_plan_record.max_products, 100),
        'features', COALESCE(v_plan_record.features, '{}'::jsonb)
    );
END;
$$;

-- 4. FUNCTION: Check if can add branch
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_can_add_branch(p_brand_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limits JSONB;
BEGIN
    v_limits := get_brand_plan_limits(p_brand_id);
    
    IF (v_limits->>'can_add_branch')::BOOLEAN THEN
        RETURN jsonb_build_object('allowed', true, 'current', v_limits->'usage'->'branches', 'max', v_limits->'limits'->'max_branches');
    ELSE
        RETURN jsonb_build_object('allowed', false, 'current', v_limits->'usage'->'branches', 'max', v_limits->'limits'->'max_branches', 'message', 'Bạn đã đạt giới hạn chi nhánh. Vui lòng nâng cấp gói.');
    END IF;
END;
$$;

-- 5. FUNCTION: Check if can add user
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_can_add_user(p_brand_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limits JSONB;
BEGIN
    v_limits := get_brand_plan_limits(p_brand_id);
    
    IF (v_limits->>'can_add_user')::BOOLEAN THEN
        RETURN jsonb_build_object('allowed', true, 'current', v_limits->'usage'->'users', 'max', v_limits->'limits'->'max_users');
    ELSE
        RETURN jsonb_build_object('allowed', false, 'current', v_limits->'usage'->'users', 'max', v_limits->'limits'->'max_users', 'message', 'Bạn đã đạt giới hạn nhân viên. Vui lòng nâng cấp gói.');
    END IF;
END;
$$;

-- 6. Grant permissions
-- =============================================================================
GRANT SELECT ON public.plans TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_brand_plan_limits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_can_add_branch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_can_add_user(UUID) TO authenticated;

-- =============================================================================
NOTIFY pgrst, 'reload config';
SELECT 'Plan limits migration complete!' AS status;
