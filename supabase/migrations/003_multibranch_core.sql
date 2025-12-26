-- ============================================================================
-- STORELY POS - PHASE 2: CORE MULTI-BRANCH MIGRATION
-- ============================================================================

-- 1. MIGRATE PRODUCTS TABLE
-- ============================================================================
-- Add brand_id and is_shared to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id),
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT TRUE;

-- Temporary: update existing products to belong to the first created brand (if any)
DO $$
DECLARE
    first_brand_id UUID;
BEGIN
    SELECT id INTO first_brand_id FROM public.brands ORDER BY created_at ASC LIMIT 1;
    
    IF first_brand_id IS NOT NULL THEN
        UPDATE public.products 
        SET brand_id = first_brand_id 
        WHERE brand_id IS NULL;
    END IF;
END $$;

-- Enable RLS on products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Policy: View products belonging to own brand
DROP POLICY IF EXISTS "Users can view brand products" ON public.products;
CREATE POLICY "Users can view brand products" ON public.products
FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid()) OR
    brand_id IS NULL -- Allow seeing "system" products if any
);

-- Policy: Manage products (Admin/Owner only)
DROP POLICY IF EXISTS "Admin can manage brand products" ON public.products;
CREATE POLICY "Admin can manage brand products" ON public.products
FOR ALL USING (
    brand_id IN (
        SELECT brand_id FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
);


-- 2. CREATE BRANCH_PRODUCTS TABLE (MappingTable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.branch_products (
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    price_override NUMERIC, -- Optional: different price per branch
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (branch_id, product_id)
);

ALTER TABLE public.branch_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own branch products" ON public.branch_products
FOR SELECT USING (
    branch_id IN (SELECT branch_id FROM public.user_profiles WHERE id = auth.uid()) OR
    branch_id IN (SELECT id FROM public.branches WHERE brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid()))
);


-- 3. MIGRATE INVENTORY (CRITICAL CHANGE: Create table + Move data)
-- ============================================================================
-- Create inventories table (since it didn't exist before)
CREATE TABLE IF NOT EXISTS public.inventories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID REFERENCES public.brands(id), -- Add brand_id column
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(branch_id, product_id) -- Only one inventory record per branch-product
);

-- Backfill data: Move 'current_stock' from products to 'inventories' for the default branch
DO $$
DECLARE
    first_brand_id UUID;
    first_branch_id UUID;
BEGIN
    SELECT id INTO first_brand_id FROM public.brands ORDER BY created_at ASC LIMIT 1;
    
    IF first_brand_id IS NOT NULL THEN
        -- Get a default branch for this brand
        SELECT id INTO first_branch_id FROM public.branches WHERE brand_id = first_brand_id LIMIT 1;

        IF first_branch_id IS NOT NULL THEN
            -- Insert inventory records for existing products
            INSERT INTO public.inventories (brand_id, branch_id, product_id, quantity, min_stock)
            SELECT 
                first_brand_id,
                first_branch_id,
                id,
                COALESCE(current_stock, 0),
                COALESCE(min_stock, 0)
            FROM public.products
            ON CONFLICT (branch_id, product_id) DO NOTHING;
            
            -- Optionally: We keep products.current_stock as a "total stock" cache, but for now we focus on establishing inventories
        END IF;
    END IF;
END $$;

ALTER TABLE public.inventories ENABLE ROW LEVEL SECURITY;

-- Policy: View inventory for own brand (Owner) or own branch (Staff)
DROP POLICY IF EXISTS "Inventory visibility" ON public.inventories;
CREATE POLICY "Inventory visibility" ON public.inventories
FOR SELECT USING (
    branch_id IN (SELECT branch_id FROM public.user_profiles WHERE id = auth.uid()) OR
    brand_id IN ( 
        SELECT brand_id FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
);


-- 4. MIGRATE ORDERS TABLE
-- ============================================================================
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id),
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

-- Backfill orders
DO $$
DECLARE
    first_brand_id UUID;
    first_branch_id UUID;
BEGIN
    SELECT id INTO first_brand_id FROM public.brands ORDER BY created_at ASC LIMIT 1;
    
    IF first_brand_id IS NOT NULL THEN
        SELECT id INTO first_branch_id FROM public.branches WHERE brand_id = first_brand_id LIMIT 1;

        UPDATE public.orders
        SET brand_id = first_brand_id, branch_id = first_branch_id
        WHERE brand_id IS NULL;
    END IF;
END $$;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Policy: Staff sees own branch orders, Owner sees all brand orders
DROP POLICY IF EXISTS "Order visibility" ON public.orders;
CREATE POLICY "Order visibility" ON public.orders
FOR SELECT USING (
    branch_id IN (SELECT branch_id FROM public.user_profiles WHERE id = auth.uid()) OR
    brand_id IN (
        SELECT brand_id FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
);


-- 5. REFRESH SCHEMA CACHE
-- ============================================================================
NOTIFY pgrst, 'reload config';
