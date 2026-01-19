-- =============================================================================
-- FIX: RLS Policies for Brand Management
-- This adds UPDATE and other policies needed for SaaS Admin functionality
-- =============================================================================

-- 1. Allow brand owners and admins to UPDATE their own brand
DROP POLICY IF EXISTS "Owner can update brand" ON public.brands;
CREATE POLICY "Owner can update brand" ON public.brands
FOR UPDATE USING (
    owner_id = auth.uid() 
    OR id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
);

-- 2. Allow super_admin to manage ALL brands (including UPDATE)
DROP POLICY IF EXISTS "Super admin can manage all brands" ON public.brands;
CREATE POLICY "Super admin can manage all brands" ON public.brands
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- 3. Grant execute permission on RPC functions
GRANT EXECUTE ON FUNCTION public.soft_delete_brand(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(TEXT, TEXT, UUID, JSONB, JSONB, JSONB) TO authenticated;

-- 4. Fix the soft_delete_brand function to bypass RLS
CREATE OR REPLACE FUNCTION public.soft_delete_brand(p_brand_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- This runs with owner privileges, bypassing RLS
SET search_path = public
AS $$
DECLARE
    v_brand_name TEXT;
    v_affected_users INT;
BEGIN
    -- Get brand name
    SELECT name INTO v_brand_name FROM brands WHERE id = p_brand_id;
    
    IF v_brand_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Brand not found');
    END IF;

    -- Mark brand as deleted
    UPDATE brands
    SET text_status = 'deleted',
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_brand_id;

    -- Disable all users of this brand
    UPDATE user_profiles
    SET is_active = false
    WHERE brand_id = p_brand_id;
    
    GET DIAGNOSTICS v_affected_users = ROW_COUNT;

    -- Cancel subscription if exists
    BEGIN
        UPDATE subscriptions SET status = 'cancelled' WHERE brand_id = p_brand_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    -- Log the action
    INSERT INTO audit_logs (brand_id, user_id, action, entity_type, entity_id, new_values)
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

-- 5. Create a helper function to toggle brand status (lock/unlock)
CREATE OR REPLACE FUNCTION public.toggle_brand_status(p_brand_id UUID, p_new_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_brand_name TEXT;
BEGIN
    -- Validate new status
    IF p_new_status NOT IN ('active', 'suspended', 'expired') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
    END IF;

    -- Get brand name
    SELECT name INTO v_brand_name FROM brands WHERE id = p_brand_id;
    
    IF v_brand_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Brand not found');
    END IF;

    -- Update brand status
    UPDATE brands
    SET text_status = p_new_status,
        updated_at = NOW()
    WHERE id = p_brand_id;

    -- Log the action
    INSERT INTO audit_logs (brand_id, user_id, action, entity_type, entity_id, new_values)
    VALUES (
        p_brand_id,
        auth.uid(),
        'TOGGLE_BRAND_STATUS',
        'brand',
        p_brand_id,
        jsonb_build_object('brand_name', v_brand_name, 'new_status', p_new_status)
    );

    RETURN jsonb_build_object(
        'success', true,
        'brand_name', v_brand_name,
        'new_status', p_new_status
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.toggle_brand_status(UUID, TEXT) TO authenticated;

-- =============================================================================
NOTIFY pgrst, 'reload config';
SELECT 'RLS fix complete!' AS status;
