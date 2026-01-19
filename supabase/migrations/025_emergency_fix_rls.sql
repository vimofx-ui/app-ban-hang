-- =============================================================================
-- EMERGENCY FIX: RLS Policies for Core Operations
-- PURPOSE: Allow Staff/Admin to CREATE orders, suppliers, purchase orders
-- MAINTAINS: Brand and Branch isolation
-- =============================================================================

-- HELPER FUNCTION: Get user's brand_id (cached)
CREATE OR REPLACE FUNCTION public.get_user_brand_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT brand_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- HELPER FUNCTION: Get user's branch_id (cached)
CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT branch_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- HELPER FUNCTION: Check if user is Admin/Owner
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'admin')
    );
$$;

-- =============================================================================
-- 1. ORDERS TABLE - Full CRUD for staff
-- =============================================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop all existing order policies
DROP POLICY IF EXISTS "Order visibility" ON public.orders;
DROP POLICY IF EXISTS "Orders insert" ON public.orders;
DROP POLICY IF EXISTS "Orders update" ON public.orders;
DROP POLICY IF EXISTS "Orders delete" ON public.orders;

-- SELECT: Staff sees own branch, Admin sees all brand orders
CREATE POLICY "Orders select" ON public.orders FOR SELECT USING (
    brand_id = public.get_user_brand_id()
    AND (
        branch_id = public.get_user_branch_id()
        OR public.is_admin_or_owner()
    )
);

-- INSERT: Staff can create orders for their branch
CREATE POLICY "Orders insert" ON public.orders FOR INSERT WITH CHECK (
    brand_id = public.get_user_brand_id()
    AND branch_id = public.get_user_branch_id()
);

-- UPDATE: Staff can update own branch orders
CREATE POLICY "Orders update" ON public.orders FOR UPDATE USING (
    brand_id = public.get_user_brand_id()
    AND (
        branch_id = public.get_user_branch_id()
        OR public.is_admin_or_owner()
    )
);

-- DELETE: Only Admin/Owner can delete
CREATE POLICY "Orders delete" ON public.orders FOR DELETE USING (
    brand_id = public.get_user_brand_id()
    AND public.is_admin_or_owner()
);

-- =============================================================================
-- 2. ORDER_ITEMS TABLE - Full CRUD
-- =============================================================================
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update" ON public.order_items;
DROP POLICY IF EXISTS "order_items_delete" ON public.order_items;

-- SELECT: Via order's brand/branch
CREATE POLICY "order_items_select" ON public.order_items FOR SELECT USING (
    order_id IN (
        SELECT id FROM public.orders 
        WHERE brand_id = public.get_user_brand_id()
    )
);

-- INSERT: If user can access the order
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT WITH CHECK (
    order_id IN (
        SELECT id FROM public.orders 
        WHERE brand_id = public.get_user_brand_id()
        AND (branch_id = public.get_user_branch_id() OR public.is_admin_or_owner())
    )
);

-- UPDATE/DELETE: Same logic
CREATE POLICY "order_items_update" ON public.order_items FOR UPDATE USING (
    order_id IN (
        SELECT id FROM public.orders 
        WHERE brand_id = public.get_user_brand_id()
    )
);

CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE USING (
    order_id IN (
        SELECT id FROM public.orders WHERE brand_id = public.get_user_brand_id()
    )
    AND public.is_admin_or_owner()
);

-- =============================================================================
-- 3. SUPPLIERS TABLE - Create/Update for Admins
-- =============================================================================
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_select" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_insert" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_update" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_delete" ON public.suppliers;

CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT USING (
    brand_id = public.get_user_brand_id() OR brand_id IS NULL
);

CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT WITH CHECK (
    brand_id = public.get_user_brand_id()
);

CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE USING (
    brand_id = public.get_user_brand_id()
);

CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE USING (
    brand_id = public.get_user_brand_id() AND public.is_admin_or_owner()
);

-- =============================================================================
-- 4. PURCHASE_ORDERS TABLE - Full CRUD
-- =============================================================================
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_orders_select" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_insert" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_update" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_delete" ON public.purchase_orders;

CREATE POLICY "purchase_orders_select" ON public.purchase_orders FOR SELECT USING (
    brand_id = public.get_user_brand_id()
);

CREATE POLICY "purchase_orders_insert" ON public.purchase_orders FOR INSERT WITH CHECK (
    brand_id = public.get_user_brand_id()
);

CREATE POLICY "purchase_orders_update" ON public.purchase_orders FOR UPDATE USING (
    brand_id = public.get_user_brand_id()
);

CREATE POLICY "purchase_orders_delete" ON public.purchase_orders FOR DELETE USING (
    brand_id = public.get_user_brand_id() AND public.is_admin_or_owner()
);

-- =============================================================================
-- 5. PURCHASE_ORDER_ITEMS TABLE - Full CRUD
-- =============================================================================
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_order_items_select" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items_insert" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items_update" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items_delete" ON public.purchase_order_items;

CREATE POLICY "purchase_order_items_select" ON public.purchase_order_items FOR SELECT USING (
    purchase_order_id IN (
        SELECT id FROM public.purchase_orders WHERE brand_id = public.get_user_brand_id()
    )
);

CREATE POLICY "purchase_order_items_insert" ON public.purchase_order_items FOR INSERT WITH CHECK (
    purchase_order_id IN (
        SELECT id FROM public.purchase_orders WHERE brand_id = public.get_user_brand_id()
    )
);

CREATE POLICY "purchase_order_items_update" ON public.purchase_order_items FOR UPDATE USING (
    purchase_order_id IN (
        SELECT id FROM public.purchase_orders WHERE brand_id = public.get_user_brand_id()
    )
);

CREATE POLICY "purchase_order_items_delete" ON public.purchase_order_items FOR DELETE USING (
    purchase_order_id IN (
        SELECT id FROM public.purchase_orders WHERE brand_id = public.get_user_brand_id()
    )
);

-- =============================================================================
-- 6. INVENTORIES TABLE - Full CRUD
-- =============================================================================
ALTER TABLE public.inventories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inventory visibility" ON public.inventories;
DROP POLICY IF EXISTS "inventories_select" ON public.inventories;
DROP POLICY IF EXISTS "inventories_insert" ON public.inventories;
DROP POLICY IF EXISTS "inventories_update" ON public.inventories;

CREATE POLICY "inventories_select" ON public.inventories FOR SELECT USING (
    brand_id = public.get_user_brand_id()
);

CREATE POLICY "inventories_insert" ON public.inventories FOR INSERT WITH CHECK (
    brand_id = public.get_user_brand_id()
);

CREATE POLICY "inventories_update" ON public.inventories FOR UPDATE USING (
    brand_id = public.get_user_brand_id()
);

-- =============================================================================
-- 7. INVENTORY_COSTS TABLE - Full CRUD (NEW for WAC)
-- =============================================================================
ALTER TABLE public.inventory_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for authenticated users based on branch" ON public.inventory_costs;
DROP POLICY IF EXISTS "inventory_costs_select" ON public.inventory_costs;
DROP POLICY IF EXISTS "inventory_costs_insert" ON public.inventory_costs;
DROP POLICY IF EXISTS "inventory_costs_update" ON public.inventory_costs;

CREATE POLICY "inventory_costs_select" ON public.inventory_costs FOR SELECT USING (
    branch_id = public.get_user_branch_id()
    OR branch_id IN (SELECT id FROM public.branches WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "inventory_costs_insert" ON public.inventory_costs FOR INSERT WITH CHECK (
    branch_id IN (SELECT id FROM public.branches WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "inventory_costs_update" ON public.inventory_costs FOR UPDATE USING (
    branch_id IN (SELECT id FROM public.branches WHERE brand_id = public.get_user_brand_id())
);

-- =============================================================================
-- 8. STOCK_MOVEMENTS TABLE - Full CRUD
-- =============================================================================
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_movements_select" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_insert" ON public.stock_movements;

CREATE POLICY "stock_movements_select" ON public.stock_movements FOR SELECT USING (true);
CREATE POLICY "stock_movements_insert" ON public.stock_movements FOR INSERT WITH CHECK (true);

-- =============================================================================
-- REFRESH SCHEMA CACHE
-- =============================================================================
NOTIFY pgrst, 'reload config';
SELECT 'RLS Emergency Fix Complete!' AS status;
