-- Ensure authenticated users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;

CREATE POLICY "Users can view own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid() = id);

-- Ensure users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

CREATE POLICY "Users can update own profile"
ON public.user_profiles
FOR UPDATE
USING (auth.uid() = id);

-- Ensure insert is allowed (often needed for triggers or initial creation if client-side)
-- But usually auth triggers handle this. If we do client-side insert in registerTenant, we need this.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

CREATE POLICY "Users can insert own profile"
ON public.user_profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Also ensure brands insert is allowed for authenticated users (since we use it in registerTenant)
-- Actually, registerTenant does: 1. SignUp (returns user) 2. Insert Brand.
-- At step 2, user is authenticated as the new user (if we use the session). 
-- But wait, Supabase JS client doesn't automatically use the session from signUp result for subsequent calls unless we set it.
-- However, we are likely using the anon key. 
-- In `registerTenant` implementation:
-- const { data: authData } = await supabase.auth.signUp(...)
-- const userId = authData.user.id
-- await supabase.from('brands').insert(...)
-- THIS IS THE PROBLEM.
-- `supabase.auth.signUp` signs the user in on the client side, updating the session.
-- So subsequent requests use the user's JWT.
-- Does `brands` table have an INSERT policy?
-- `001_multibrand_schema.sql` shows:
-- CREATE POLICY "Owner can update brand" ...
-- CREATE POLICY "Users can view own brand" ...
-- MISSING: INSERT policy for brands!
-- If there is no INSERT policy, no one can insert (default deny for RLS).

-- FIX: Add INSERT policy for brands.
DROP POLICY IF EXISTS "Users can create brands" ON public.brands;

CREATE POLICY "Users can create brands"
ON public.brands
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

-- Also check `branches` INSERT policy
DROP POLICY IF EXISTS "Users can create branches" ON public.branches;

CREATE POLICY "Users can create branches"
ON public.branches
FOR INSERT
WITH CHECK (
    brand_id IN (
        SELECT id FROM public.brands WHERE owner_id = auth.uid()
    )
);

-- And `user_profiles` insert (already added above)
