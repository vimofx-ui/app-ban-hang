-- =============================================================================
-- FIX #3: Relax RLS for Admins/Owners
-- PURPOSE: Allow Admin/Owner to INSERT/UPDATE even if branch_id doesn't match
-- This fixes issues where 'get_user_branch_id()' returns null or old branch
-- =============================================================================

-- 1. ORDERS INSERT POLICY
DROP POLICY IF EXISTS "Orders insert" ON public.orders;
CREATE POLICY "Orders insert" ON public.orders FOR INSERT WITH CHECK (
    brand_id = public.get_user_brand_id()
    AND (
        branch_id = public.get_user_branch_id()
        OR branch_id IS NULL
        OR public.is_admin_or_owner() -- Allow owner to insert for any branch
    )
);

-- 2. ORDER ITEMS INSERT POLICY
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT WITH CHECK (
    order_id IN (
        SELECT id FROM public.orders 
        WHERE brand_id = public.get_user_brand_id()
        -- Implicitly allowed via order ownership
    )
);

-- 3. INVENTORIES INSERT POLICY
DROP POLICY IF EXISTS "inventories_insert" ON public.inventories;
CREATE POLICY "inventories_insert" ON public.inventories FOR INSERT WITH CHECK (
    brand_id = public.get_user_brand_id()
    -- Allow inserting into any branch (for product creation which initializes stock)
    AND (
        branch_id = public.get_user_branch_id()
        OR public.is_admin_or_owner()
    )
);

-- 4. INVENTORY COSTS INSERT POLICY
DROP POLICY IF EXISTS "inventory_costs_insert" ON public.inventory_costs;
CREATE POLICY "inventory_costs_insert" ON public.inventory_costs FOR INSERT WITH CHECK (
    branch_id IN (
        SELECT id FROM public.branches WHERE brand_id = public.get_user_brand_id()
    )
);

-- 5. RELAX PRODUCTS INSERT CHECK (Already done in 026 but reinforcing)
-- (No change needed if 026 ran, but let's be sure)

-- 6. ENSURE seller_id IS POPULATED IF NULL
-- Create a trigger on orders to set seller_id if missing?
-- (Optional, but good for data integrity)

-- =============================================================================
-- REFRESH SCHEMA CACHE
-- =============================================================================
NOTIFY pgrst, 'reload config';
SELECT 'Fix #3 Complete: Relaxed RLS for Orders and Inventories' AS status;
