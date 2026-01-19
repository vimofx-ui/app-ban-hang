-- =============================================================================
-- CLEANUP: Drop any partially created objects from previous runs
-- Run this FIRST to clean up, then run the main migration
-- =============================================================================

-- Drop functions that might reference audit_logs
DROP FUNCTION IF EXISTS public.soft_delete_brand(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.log_activity(TEXT, TEXT, UUID, JSONB, JSONB, JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_brand_domain() CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS on_brand_created_domain ON public.brands;

-- Drop policies (if tables exist)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Brand admins can view audit logs" ON public.audit_logs;
    DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view brand domains" ON public.domains;
    DROP POLICY IF EXISTS "Admins can manage domains" ON public.domains;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- Drop tables (clean slate)
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.domains CASCADE;

-- Remove columns from brands if they exist (to recreate cleanly)
-- We keep them if they exist to preserve data
-- ALTER TABLE public.brands DROP COLUMN IF EXISTS text_status;
-- ALTER TABLE public.brands DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE public.brands DROP COLUMN IF EXISTS slug;

-- =============================================================================
-- CLEANUP COMPLETE - Now run the main migration file
-- =============================================================================
SELECT 'Cleanup complete! Now run 016_saas_main.sql' AS status;
