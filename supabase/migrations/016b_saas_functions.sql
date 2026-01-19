-- =============================================================================
-- SAAS STANDARDIZATION - PART 2: POLICIES & FUNCTIONS
-- Run this AFTER Part 1 completes successfully
-- =============================================================================

-- 1. RLS POLICIES FOR AUDIT_LOGS
-- =============================================================================
DROP POLICY IF EXISTS "Brand admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Brand admins can view audit logs" ON public.audit_logs
    FOR SELECT
    USING (
        brand_id IN (
            SELECT brand_id FROM public.user_profiles 
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "System can insert audit logs" ON public.audit_logs
    FOR INSERT
    WITH CHECK (true);

-- 2. RLS POLICIES FOR DOMAINS
-- =============================================================================
DROP POLICY IF EXISTS "Users can view brand domains" ON public.domains;
CREATE POLICY "Users can view brand domains" ON public.domains
    FOR SELECT
    USING (
        brand_id IN (
            SELECT brand_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can manage domains" ON public.domains;
CREATE POLICY "Admins can manage domains" ON public.domains
    FOR ALL
    USING (
        brand_id IN (
            SELECT brand_id FROM public.user_profiles 
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- 3. LOG ACTIVITY FUNCTION
-- =============================================================================
CREATE OR REPLACE FUNCTION public.log_activity(
    p_action TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_brand_id UUID;
    v_log_id UUID;
BEGIN
    SELECT brand_id INTO v_brand_id 
    FROM public.user_profiles 
    WHERE id = auth.uid();

    INSERT INTO public.audit_logs (
        brand_id, user_id, action, entity_type, entity_id, 
        old_values, new_values, metadata
    )
    VALUES (
        v_brand_id, auth.uid(), p_action, p_entity_type, p_entity_id,
        p_old_values, p_new_values, p_metadata
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

-- 4. SOFT DELETE BRAND FUNCTION
-- =============================================================================
CREATE OR REPLACE FUNCTION public.soft_delete_brand(p_brand_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_brand_name TEXT;
    v_affected_users INT;
BEGIN
    SELECT name INTO v_brand_name FROM public.brands WHERE id = p_brand_id;
    
    IF v_brand_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Brand not found');
    END IF;

    -- Check permission
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (
            (brand_id = p_brand_id AND role = 'owner')
            OR role = 'super_admin'
        )
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
    END IF;

    -- Mark brand as deleted
    UPDATE public.brands
    SET text_status = 'deleted',
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_brand_id;

    -- Disable all users
    UPDATE public.user_profiles
    SET is_active = false
    WHERE brand_id = p_brand_id;
    
    GET DIAGNOSTICS v_affected_users = ROW_COUNT;

    -- Cancel subscription (if table exists)
    UPDATE public.subscriptions
    SET status = 'cancelled'
    WHERE brand_id = p_brand_id;

    -- Log the action
    INSERT INTO public.audit_logs (brand_id, user_id, action, entity_type, entity_id, new_values)
    VALUES (
        p_brand_id,
        auth.uid(),
        'SOFT_DELETE_BRAND',
        'brand',
        p_brand_id,
        jsonb_build_object(
            'brand_name', v_brand_name,
            'users_disabled', v_affected_users,
            'deleted_at', NOW()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'brand_name', v_brand_name,
        'users_disabled', v_affected_users
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 5. AUTO-CREATE SUBDOMAIN TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_brand_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.slug IS NOT NULL THEN
        INSERT INTO public.domains (brand_id, domain, type, verified)
        VALUES (NEW.id, NEW.slug, 'subdomain', true)
        ON CONFLICT (domain) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_brand_created_domain ON public.brands;
CREATE TRIGGER on_brand_created_domain
AFTER INSERT ON public.brands
FOR EACH ROW
WHEN (NEW.slug IS NOT NULL)
EXECUTE FUNCTION public.handle_new_brand_domain();

-- 6. UPDATE RLS ON BRANDS (Exclude soft-deleted)
-- =============================================================================
DROP POLICY IF EXISTS "Users can view own brand" ON public.brands;
CREATE POLICY "Users can view own brand" ON public.brands
FOR SELECT USING (
    (
        owner_id = auth.uid() OR
        id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid())
    )
    AND (deleted_at IS NULL)
);

-- =============================================================================
NOTIFY pgrst, 'reload config';
-- DONE!
-- =============================================================================
