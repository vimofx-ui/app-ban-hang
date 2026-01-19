-- =============================================================================
-- SAAS STANDARDIZATION MIGRATION
-- Aligns the schema with enterprise SaaS best practices
-- =============================================================================

-- 1. UPDATE BRANDS TABLE
-- =============================================================================

-- Add slug column if not exists (for domain resolution)
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Add deleted_at for soft delete
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- We need to handle the status column transition carefully.
-- Current: status SMALLINT (1=active, 0=inactive)
-- Target: status TEXT ('trial', 'active', 'expired', 'suspended', 'deleted')

-- Step 1: Add new text_status column
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS text_status TEXT DEFAULT 'active';

-- Step 2: Migrate existing data
UPDATE public.brands 
SET text_status = CASE 
    WHEN status = 1 THEN 'active'
    WHEN status = 0 THEN 'suspended'
    ELSE 'active'
END
WHERE text_status IS NULL OR text_status = 'active';

-- Note: We keep both columns for backward compatibility during transition.
-- Frontend should start using text_status, then we can drop status later.

-- Add constraint on text_status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'brands_text_status_check'
    ) THEN
        ALTER TABLE public.brands 
        ADD CONSTRAINT brands_text_status_check 
        CHECK (text_status IN ('trial', 'active', 'expired', 'suspended', 'deleted'));
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 2. CREATE AUDIT_LOGS TABLE (System-wide activity logging)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT, -- 'brand', 'product', 'order', 'user', etc.
    entity_id UUID,
    old_values JSONB, -- Previous state
    new_values JSONB, -- New state
    metadata JSONB, -- Extra info like IP, user agent
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_brand_id ON public.audit_logs(brand_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Brand owners/admins can view their brand's logs
CREATE POLICY "Brand admins can view audit logs" ON public.audit_logs
    FOR SELECT
    USING (
        brand_id IN (
            SELECT brand_id FROM public.user_profiles 
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Policy: System can insert logs (using service role or RPC)
CREATE POLICY "System can insert audit logs" ON public.audit_logs
    FOR INSERT
    WITH CHECK (true); -- Will be called via service role or SECURITY DEFINER function

-- 3. CREATE DOMAINS TABLE (Subdomain & Custom Domain Management)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    domain TEXT UNIQUE NOT NULL, -- e.g., 'my-store' for my-store.bangopos.com
    type TEXT NOT NULL DEFAULT 'subdomain' CHECK (type IN ('subdomain', 'custom')),
    verified BOOLEAN DEFAULT false,
    ssl_status TEXT DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'active', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for domain lookup
CREATE INDEX IF NOT EXISTS idx_domains_domain ON public.domains(domain);
CREATE INDEX IF NOT EXISTS idx_domains_brand_id ON public.domains(brand_id);

-- Enable RLS
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their brand's domains
CREATE POLICY "Users can view brand domains" ON public.domains
    FOR SELECT
    USING (
        brand_id IN (
            SELECT brand_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

-- Policy: Admins can manage domains
CREATE POLICY "Admins can manage domains" ON public.domains
    FOR ALL
    USING (
        brand_id IN (
            SELECT brand_id FROM public.user_profiles 
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

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
    -- Get brand name for logging
    SELECT name INTO v_brand_name FROM public.brands WHERE id = p_brand_id;
    
    IF v_brand_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Brand not found');
    END IF;

    -- Check if caller is owner or super_admin
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

    -- Start transaction block
    -- 1. Mark brand as deleted
    UPDATE public.brands
    SET text_status = 'deleted',
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_brand_id;

    -- 2. Disable all users of this brand
    UPDATE public.user_profiles
    SET is_active = false
    WHERE brand_id = p_brand_id;
    
    GET DIAGNOSTICS v_affected_users = ROW_COUNT;

    -- 3. Cancel subscription
    UPDATE public.subscriptions
    SET status = 'cancelled'
    WHERE brand_id = p_brand_id;

    -- 4. Log the action
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
END;
$$;

-- 5. HELPER FUNCTION: Log Activity
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
    -- Get brand_id from current user
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

-- 6. AUTO-CREATE SUBDOMAIN WHEN BRAND CREATED
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_brand_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Create default subdomain from slug or generate one
    IF NEW.slug IS NOT NULL THEN
        INSERT INTO public.domains (brand_id, domain, type, verified)
        VALUES (NEW.id, NEW.slug, 'subdomain', true)
        ON CONFLICT (domain) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_brand_created_domain ON public.brands;
CREATE TRIGGER on_brand_created_domain
AFTER INSERT ON public.brands
FOR EACH ROW
WHEN (NEW.slug IS NOT NULL)
EXECUTE FUNCTION public.handle_new_brand_domain();

-- 7. UPDATE RLS ON BRANDS TO EXCLUDE DELETED
-- =============================================================================
-- Drop existing policy and recreate to exclude deleted brands
DROP POLICY IF EXISTS "Users can view own brand" ON public.brands;
CREATE POLICY "Users can view own brand" ON public.brands
FOR SELECT USING (
    (
        owner_id = auth.uid() OR
        id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid())
    )
    AND (deleted_at IS NULL) -- Exclude soft-deleted brands
);

-- =============================================================================
-- REFRESH SCHEMA CACHE
-- =============================================================================
NOTIFY pgrst, 'reload config';

-- =============================================================================
-- NOTES:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Frontend should transition from brands.status to brands.text_status
-- 3. The old `status` column will be deprecated in a future migration
-- =============================================================================
