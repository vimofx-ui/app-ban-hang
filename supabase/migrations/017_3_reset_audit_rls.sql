-- =============================================================================
-- FIX: Comprehensive RLS for audit_logs - Allow ALL authenticated to read
-- =============================================================================

-- First, check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'audit_logs';

-- Drop ALL existing policies on audit_logs to start fresh
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'audit_logs' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_logs', policy_record.policyname);
    END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create a simple, permissive SELECT policy for ALL authenticated users
CREATE POLICY "allow_authenticated_select_all" ON public.audit_logs
FOR SELECT
TO authenticated
USING (true);

-- Allow INSERT from authenticated users
CREATE POLICY "allow_authenticated_insert" ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Verify policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'audit_logs';

-- Test: Count rows that the current user can see
SELECT COUNT(*) as visible_count FROM public.audit_logs;

NOTIFY pgrst, 'reload config';
SELECT 'Audit logs RLS completely reset!' AS status;
