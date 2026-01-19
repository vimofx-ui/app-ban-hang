-- =============================================================================
-- SAAS STANDARDIZATION - PART 1: TABLES
-- Run this first, then run Part 2
-- =============================================================================

-- 1. UPDATE BRANDS TABLE
-- =============================================================================
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS text_status TEXT DEFAULT 'active';

-- Migrate existing data
UPDATE public.brands 
SET text_status = CASE 
    WHEN status = 1 THEN 'active'
    WHEN status = 0 THEN 'suspended'
    ELSE 'active'
END
WHERE text_status IS NULL OR text_status = 'active';

-- 2. CREATE AUDIT_LOGS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_brand_id ON public.audit_logs(brand_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. CREATE DOMAINS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    domain TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL DEFAULT 'subdomain' CHECK (type IN ('subdomain', 'custom')),
    verified BOOLEAN DEFAULT false,
    ssl_status TEXT DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'active', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domains_domain ON public.domains(domain);
CREATE INDEX IF NOT EXISTS idx_domains_brand_id ON public.domains(brand_id);

ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PART 1 COMPLETE - Now run Part 2
-- =============================================================================
