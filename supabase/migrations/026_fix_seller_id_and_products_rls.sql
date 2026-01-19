-- =============================================================================
-- FIX #2: Missing Columns and Remaining RLS Issues
-- =============================================================================

-- 1. ADD MISSING seller_id and seller_name COLUMNS TO ORDERS
-- (These are referenced in posStore.ts but may not exist in DB)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_name TEXT;

-- 2. ADD cost_at_sale and profit to order_items (if not exists from 023)
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS cost_at_sale NUMERIC DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS profit NUMERIC DEFAULT 0;
-- Rename total to total_price if needed (posStore uses total_price)
-- Actually, let's just add total_price if missing, keep total for backwards compat
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS total_price NUMERIC DEFAULT 0;

-- 3. FIX PRODUCTS RLS - Ensure Staff can also INSERT/UPDATE (not just Admin/Owner)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View products" ON public.products;
DROP POLICY IF EXISTS "Manage products" ON public.products;
DROP POLICY IF EXISTS "products_select" ON public.products;
DROP POLICY IF EXISTS "products_insert" ON public.products;
DROP POLICY IF EXISTS "products_update" ON public.products;
DROP POLICY IF EXISTS "products_delete" ON public.products;

-- SELECT: All users in the same brand can view products
CREATE POLICY "products_select" ON public.products FOR SELECT USING (
    brand_id = public.get_user_brand_id() OR brand_id IS NULL
);

-- INSERT: Admin/Owner can create products
CREATE POLICY "products_insert" ON public.products FOR INSERT WITH CHECK (
    brand_id = public.get_user_brand_id()
);

-- UPDATE: Admin/Owner can update products
CREATE POLICY "products_update" ON public.products FOR UPDATE USING (
    brand_id = public.get_user_brand_id()
);

-- DELETE: Only Admin/Owner can delete
CREATE POLICY "products_delete" ON public.products FOR DELETE USING (
    brand_id = public.get_user_brand_id() AND public.is_admin_or_owner()
);

-- 4. FIX PRODUCT_UNITS RLS
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_units_select" ON public.product_units;
DROP POLICY IF EXISTS "product_units_insert" ON public.product_units;
DROP POLICY IF EXISTS "product_units_update" ON public.product_units;
DROP POLICY IF EXISTS "product_units_delete" ON public.product_units;

CREATE POLICY "product_units_select" ON public.product_units FOR SELECT USING (
    product_id IN (SELECT id FROM public.products WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "product_units_insert" ON public.product_units FOR INSERT WITH CHECK (
    product_id IN (SELECT id FROM public.products WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "product_units_update" ON public.product_units FOR UPDATE USING (
    product_id IN (SELECT id FROM public.products WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "product_units_delete" ON public.product_units FOR DELETE USING (
    product_id IN (SELECT id FROM public.products WHERE brand_id = public.get_user_brand_id())
);

-- 5. FIX CATEGORIES RLS (needed for product creation)
-- First, add brand_id column if it doesn't exist
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select" ON public.categories;
DROP POLICY IF EXISTS "categories_insert" ON public.categories;
DROP POLICY IF EXISTS "categories_update" ON public.categories;
DROP POLICY IF EXISTS "categories_delete" ON public.categories;

CREATE POLICY "categories_select" ON public.categories FOR SELECT USING (
    brand_id = public.get_user_brand_id() OR brand_id IS NULL
);

CREATE POLICY "categories_insert" ON public.categories FOR INSERT WITH CHECK (
    brand_id = public.get_user_brand_id() OR brand_id IS NULL
);

CREATE POLICY "categories_update" ON public.categories FOR UPDATE USING (
    brand_id = public.get_user_brand_id()
);

CREATE POLICY "categories_delete" ON public.categories FOR DELETE USING (
    brand_id = public.get_user_brand_id()
);

-- 6. FIX CUSTOMERS RLS (More permissive for staff)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View customers" ON public.customers;
DROP POLICY IF EXISTS "Manage customers" ON public.customers;
DROP POLICY IF EXISTS "customers_select" ON public.customers;
DROP POLICY IF EXISTS "customers_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_update" ON public.customers;
DROP POLICY IF EXISTS "customers_delete" ON public.customers;

CREATE POLICY "customers_select" ON public.customers FOR SELECT USING (
    brand_id = public.get_user_brand_id()
);

CREATE POLICY "customers_insert" ON public.customers FOR INSERT WITH CHECK (
    brand_id = public.get_user_brand_id()
);

CREATE POLICY "customers_update" ON public.customers FOR UPDATE USING (
    brand_id = public.get_user_brand_id()
);

CREATE POLICY "customers_delete" ON public.customers FOR DELETE USING (
    brand_id = public.get_user_brand_id() AND public.is_admin_or_owner()
);

-- 7. FIX SHIFTS RLS
-- First, add branch_id column if it doesn't exist
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shifts_select" ON public.shifts;
DROP POLICY IF EXISTS "shifts_insert" ON public.shifts;
DROP POLICY IF EXISTS "shifts_update" ON public.shifts;

CREATE POLICY "shifts_select" ON public.shifts FOR SELECT USING (
    branch_id = public.get_user_branch_id() 
    OR branch_id IN (SELECT id FROM public.branches WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "shifts_insert" ON public.shifts FOR INSERT WITH CHECK (
    branch_id = public.get_user_branch_id()
);

CREATE POLICY "shifts_update" ON public.shifts FOR UPDATE USING (
    branch_id = public.get_user_branch_id()
    OR branch_id IN (SELECT id FROM public.branches WHERE brand_id = public.get_user_brand_id())
);

-- 8. FIX POINT_TRANSACTIONS RLS (SKIP IF TABLE DOESN'T EXIST)
-- This table may not exist yet in some installations
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'point_transactions') THEN
        ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "point_transactions_select" ON public.point_transactions;
        DROP POLICY IF EXISTS "point_transactions_insert" ON public.point_transactions;
        
        EXECUTE 'CREATE POLICY "point_transactions_select" ON public.point_transactions FOR SELECT USING (
            customer_id IN (SELECT id FROM public.customers WHERE brand_id = public.get_user_brand_id())
        )';
        
        EXECUTE 'CREATE POLICY "point_transactions_insert" ON public.point_transactions FOR INSERT WITH CHECK (
            customer_id IN (SELECT id FROM public.customers WHERE brand_id = public.get_user_brand_id())
        )';
    END IF;
END $$;

-- =============================================================================
-- REFRESH SCHEMA CACHE
-- =============================================================================
NOTIFY pgrst, 'reload config';
SELECT 'Fix #2 Complete: seller_id, products RLS, categories RLS!' AS status;
