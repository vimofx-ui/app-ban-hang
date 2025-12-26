-- ============================================================================
-- STORELY POS - FIX RLS FOR PRODUCTS AND SUPPLIERS
-- ============================================================================

-- 1. ENSURE SUPPLIERS TABLE HAS BRAND_ID
-- ============================================================================
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);

-- 2. FIX PRODUCTS RLS POLICIES
-- ============================================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view brand products" ON public.products;
DROP POLICY IF EXISTS "Admin can manage brand products" ON public.products;
DROP POLICY IF EXISTS "Owner manage products" ON public.products;

-- Create comprehensive policies
CREATE POLICY "View products" ON public.products
FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid()) OR
    brand_id IS NULL -- System products
);

CREATE POLICY "Manage products" ON public.products
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


-- 3. FIX SUPPLIERS RLS POLICIES
-- ============================================================================
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Manage suppliers" ON public.suppliers;

CREATE POLICY "View suppliers" ON public.suppliers
FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid()) OR
    brand_id IS NULL
);

CREATE POLICY "Manage suppliers" ON public.suppliers
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

-- 4. FIX CUSTOMERS RLS POLICIES (Just in case)
-- ============================================================================
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View customers" ON public.customers;
DROP POLICY IF EXISTS "Manage customers" ON public.customers;

CREATE POLICY "View customers" ON public.customers
FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid())
);

CREATE POLICY "Manage customers" ON public.customers
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
