-- FIX RLS POLICIES FOR BRANCHES
-- Ensure "Owner" has full access to create/update/delete branches

-- 1. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admin can manage branches" ON public.branches;
DROP POLICY IF EXISTS "Owner can manage branches" ON public.branches; -- Just in case
DROP POLICY IF EXISTS "Users can view brand branches" ON public.branches;

-- 2. Re-create View Policy (All staff in the brand can view)
CREATE POLICY "Users can view brand branches" ON public.branches
FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid()) OR
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'admin') AND brand_id = branches.brand_id
    )
);

-- 3. Re-create Manage Policy (Only Owner and Admin)
-- Note: For INSERT, the CHECK is performed on the new row.
CREATE POLICY "Admin and Owner can manage branches" ON public.branches
FOR ALL USING (
    brand_id IN (
        SELECT brand_id FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
)
WITH CHECK (
    brand_id IN (
        SELECT brand_id FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
);

-- 4. Verify User Role Constraints (Just to be safe)
DO $$
BEGIN
    ALTER TABLE public.user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_role_check;
    
    ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_role_check 
    CHECK (role IN ('owner', 'admin', 'manager', 'cashier', 'warehouse', 'staff'));
END $$;
