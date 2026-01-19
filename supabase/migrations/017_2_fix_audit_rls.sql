-- =============================================================================
-- FIX: RLS Policies for Audit Logs - Allow reading
-- =============================================================================

-- Allow any authenticated user to SELECT audit logs
-- (The table already has RLS enabled but needs a SELECT policy)
DROP POLICY IF EXISTS "Anyone can read audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can read audit logs" ON public.audit_logs
FOR SELECT
TO authenticated
USING (true);

-- Alternative: Only super_admin can read all logs
-- DROP POLICY IF EXISTS "Super admin can read all logs" ON public.audit_logs;
-- CREATE POLICY "Super admin can read all logs" ON public.audit_logs
-- FOR SELECT
-- USING (
--     EXISTS (
--         SELECT 1 FROM public.user_profiles 
--         WHERE id = auth.uid() AND role = 'super_admin'
--     )
-- );

-- Allow any authenticated user to INSERT audit logs (for logging actions)
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Verify RLS is enabled
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
NOTIFY pgrst, 'reload config';
SELECT 'Audit logs RLS fix complete!' AS status;
