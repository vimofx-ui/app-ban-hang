-- =============================================================================
-- SAAS STANDARDIZATION - MAIN (Run after cleanup)
-- =============================================================================

-- 1. UPDATE BRANDS TABLE
-- =============================================================================
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS text_status TEXT DEFAULT 'active';

-- Create unique index on slug if not exists
CREATE UNIQUE INDEX IF NOT EXISTS brands_slug_unique ON public.brands(slug) WHERE slug IS NOT NULL;

-- Migrate existing status data
UPDATE public.brands 
SET text_status = CASE 
    WHEN status = 1 THEN 'active'
    WHEN status = 0 THEN 'suspended'
    ELSE 'active'
END
WHERE text_status IS NULL;

-- 2. CREATE AUDIT_LOGS TABLE
-- =============================================================================
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_brand_id ON public.audit_logs(brand_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (
        brand_id IN (
            SELECT brand_id FROM public.user_profiles 
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "System can insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (true);

-- 3. CREATE DOMAINS TABLE
-- =============================================================================
CREATE TABLE public.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    domain TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL DEFAULT 'subdomain',
    verified BOOLEAN DEFAULT false,
    ssl_status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_domains_domain ON public.domains(domain);
CREATE INDEX idx_domains_brand_id ON public.domains(brand_id);

ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view brand domains" ON public.domains
    FOR SELECT USING (
        brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins can manage domains" ON public.domains
    FOR ALL USING (
        brand_id IN (
            SELECT brand_id FROM public.user_profiles 
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- 4. CREATE FUNCTIONS
-- =============================================================================

-- Log Activity Function
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

-- Soft Delete Brand Function
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

    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND ((brand_id = p_brand_id AND role = 'owner') OR role = 'super_admin')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
    END IF;

    UPDATE public.brands
    SET text_status = 'deleted', deleted_at = NOW(), updated_at = NOW()
    WHERE id = p_brand_id;

    UPDATE public.user_profiles
    SET is_active = false
    WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_affected_users = ROW_COUNT;

    BEGIN
        UPDATE public.subscriptions SET status = 'cancelled' WHERE brand_id = p_brand_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    INSERT INTO public.audit_logs (brand_id, user_id, action, entity_type, entity_id, new_values)
    VALUES (p_brand_id, auth.uid(), 'SOFT_DELETE_BRAND', 'brand', p_brand_id,
        jsonb_build_object('brand_name', v_brand_name, 'users_disabled', v_affected_users));

    RETURN jsonb_build_object('success', true, 'brand_name', v_brand_name, 'users_disabled', v_affected_users);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Auto-create subdomain trigger
CREATE OR REPLACE FUNCTION public.handle_new_brand_domain()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.slug IS NOT NULL THEN
        INSERT INTO public.domains (brand_id, domain, type, verified)
        VALUES (NEW.id, NEW.slug, 'subdomain', true)
        ON CONFLICT (domain) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_brand_created_domain
AFTER INSERT ON public.brands
FOR EACH ROW WHEN (NEW.slug IS NOT NULL)
EXECUTE FUNCTION public.handle_new_brand_domain();

-- 5. UPDATE RLS ON BRANDS
-- =============================================================================
DROP POLICY IF EXISTS "Users can view own brand" ON public.brands;
CREATE POLICY "Users can view own brand" ON public.brands
FOR SELECT USING (
    (owner_id = auth.uid() OR id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid()))
    AND (deleted_at IS NULL)
);

-- =============================================================================
NOTIFY pgrst, 'reload config';
SELECT 'Migration complete!' AS status;
