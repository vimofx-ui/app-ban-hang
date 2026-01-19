-- =============================================================================
-- ADVANCED FEATURES: RLS, REALTIME, AUDIT LOGS
-- =============================================================================

-- 1. ENABLE ROW LEVEL SECURITY (RLS)
-- Protects data so users can only access what they are allowed to.

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'owner')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 1.1 RLS FOR ORDERS
-- Staff: View orders of their branch only
-- Admin: View all
DROP POLICY IF EXISTS "Staff view branch orders" ON public.orders;
CREATE POLICY "Staff view branch orders"
ON public.orders
FOR SELECT
USING (
  branch_id = (
    SELECT branch_id
    FROM public.user_profiles
    WHERE id = auth.uid()
  )
  OR public.is_admin()
);

-- 1.2 RLS FOR INVENTORY
DROP POLICY IF EXISTS "Staff view branch inventory" ON public.inventory;
CREATE POLICY "Staff view branch inventory"
ON public.inventory
FOR SELECT
USING (
  branch_id = (
    SELECT branch_id
    FROM public.user_profiles
    WHERE id = auth.uid()
  )
  OR public.is_admin()
);

-- 1.3 RLS FOR PROFILES
-- Users can see their own profile
DROP POLICY IF EXISTS "View own profile" ON public.user_profiles;
CREATE POLICY "View own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid() = id);

-- Admins can see all profiles
DROP POLICY IF EXISTS "Admin view all profiles" ON public.user_profiles;
CREATE POLICY "Admin view all profiles"
ON public.user_profiles
FOR SELECT
USING (public.is_admin());

-- 2. ENABLE REALTIME
-- Allows instant updates on frontend without refresh.
-- Note: Must be enabled in Supabase Dashboard UI for 'public.orders' table, 
-- but we can try to set publication here (requires superuser, often allowed in self-hosted or some setups).
-- If this fails, user must do it in Dashboard -> Database -> Replication.

-- ALERT: verify if 'orders' are in publication
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.orders; 
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;

-- 3. AUDIT LOGS
-- Track important actions

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only Admins can view logs
CREATE POLICY "Admins view audit logs"
ON public.audit_logs
FOR SELECT
USING (public.is_admin());

-- Function to easily log actions from Postgres triggers or Client
CREATE OR REPLACE FUNCTION public.log_action(
  p_action TEXT,
  p_table TEXT,
  p_record_id UUID,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), p_action, p_table, p_record_id, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
