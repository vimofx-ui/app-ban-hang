-- ============================================================================
-- STORELY POS - MULTI-BRAND MULTI-BRANCH MIGRATION
-- Phase 1: Foundation Schema
-- ============================================================================

-- 1. BRANDS TABLE (Tenant/Thương hiệu)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id),
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro')),
    status SMALLINT DEFAULT 1,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own brand
CREATE POLICY "Users can view own brand" ON public.brands
FOR SELECT USING (
    owner_id = auth.uid() OR
    id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid())
);

-- Policy: Only owner can update brand
CREATE POLICY "Owner can update brand" ON public.brands
FOR UPDATE USING (owner_id = auth.uid());


-- 2. BRANCHES TABLE (Chi nhánh)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    status SMALLINT DEFAULT 1, -- 1=active, 0=inactive
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Policy: Users see branches of their brand
CREATE POLICY "Users can view brand branches" ON public.branches
FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid())
);

-- Policy: Admin/Owner can manage branches
CREATE POLICY "Admin can manage branches" ON public.branches
FOR ALL USING (
    brand_id IN (
        SELECT brand_id FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
);


-- 3. UPDATE USER_PROFILES - Add brand_id and branch_id
-- ============================================================================
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id),
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

-- Update role check constraint (if exists, drop and recreate)
-- First, check current allowed roles and add new ones
DO $$
BEGIN
    -- Add new role values if needed
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_profiles_role_check'
    ) THEN
        ALTER TABLE public.user_profiles
        ADD CONSTRAINT user_profiles_role_check 
        CHECK (role IN ('owner', 'admin', 'manager', 'cashier', 'warehouse', 'staff'));
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Constraint might already exist with different values, that's OK
        NULL;
END $$;


-- 4. JWT HELPER FUNCTIONS
-- ============================================================================

-- Get brand_id from current user's profile
CREATE OR REPLACE FUNCTION public.get_user_brand_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT brand_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Get branch_id from current user's profile
CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT branch_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Get user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Check if user is owner of brand
CREATE OR REPLACE FUNCTION public.is_brand_owner()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND role = 'owner'
    );
$$;

-- Check if user is admin or owner
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'admin')
    );
$$;


-- 5. TRIGGER: Auto-create brand when new user registers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_brand()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_brand_id UUID;
BEGIN
    -- Only create brand if user doesn't have one yet
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = NEW.id AND brand_id IS NOT NULL) THEN
        -- Create a new brand for this user
        INSERT INTO public.brands (name, owner_id)
        VALUES ('Cửa hàng mới', NEW.id)
        RETURNING id INTO new_brand_id;
        
        -- Update user profile with brand_id and set as owner
        UPDATE public.user_profiles
        SET brand_id = new_brand_id, role = 'owner'
        WHERE id = NEW.id;
        
        -- Create default branch
        INSERT INTO public.branches (brand_id, name, address)
        VALUES (new_brand_id, 'Chi nhánh chính', 'Địa chỉ chưa cập nhật');
    END IF;
    
    RETURN NEW;
END;
$$;

-- Note: This trigger should be created after user_profiles trigger
-- CREATE TRIGGER on_user_profile_created_brand
-- AFTER INSERT ON public.user_profiles
-- FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_brand();


-- 6. REFRESH SCHEMA CACHE
-- ============================================================================
NOTIFY pgrst, 'reload config';


-- ============================================================================
-- USAGE NOTES:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Existing users will need to be manually assigned to brands
-- 3. The trigger is commented out - uncomment after testing
-- ============================================================================
