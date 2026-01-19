-- =============================================================================
-- MIGRATION 037: KHÔI PHỤC BẢO MẬT VÀ TRIGGERS
-- 
-- Mục đích: Bật lại Row Level Security (RLS) và triggers đã bị tắt tạm thời
--           trong file 029 và 031 để sửa lỗi POS, sản phẩm, nhà cung cấp.
--
-- Ngày: 2026-01-01
-- Ghi chú: Các policies đã được sửa trong migrations 025-030, an toàn để bật lại
-- =============================================================================

-- =============================================================================
-- PHẦN 1: ĐẢM BẢO CÁC HELPER FUNCTIONS TỒN TẠI (SECURITY DEFINER)
-- =============================================================================

-- Helper: Lấy brand_id của user hiện tại
CREATE OR REPLACE FUNCTION public.get_user_brand_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT brand_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Helper: Lấy branch_id của user hiện tại
CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT branch_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Helper: Kiểm tra user có phải Admin/Owner không
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
-- PHẦN 2: ĐẢM BẢO TRIGGER FUNCTION TỒN TẠI VỚI SECURITY DEFINER
-- =============================================================================

-- Function tính giá vốn khi bán (SECURITY DEFINER để bypass RLS)
CREATE OR REPLACE FUNCTION capture_cost_at_sale()
RETURNS TRIGGER AS $$
DECLARE
    v_branch_id UUID;
    v_avg_cost NUMERIC := 0;
BEGIN
    -- Lấy Branch ID từ Order (bypass RLS nhờ SECURITY DEFINER)
    SELECT branch_id INTO v_branch_id FROM orders WHERE id = NEW.order_id;

    -- Lấy giá vốn bình quân từ inventory_costs
    IF v_branch_id IS NOT NULL THEN
        SELECT avg_cost INTO v_avg_cost
        FROM inventory_costs
        WHERE product_id = NEW.product_id AND branch_id = v_branch_id;
    END IF;

    -- Fallback: Nếu không có WAC, lấy từ products.cost_price
    IF v_avg_cost IS NULL OR v_avg_cost = 0 THEN
       SELECT cost_price INTO v_avg_cost FROM products WHERE id = NEW.product_id;
    END IF;
    
    -- Đảm bảo không NULL
    IF v_avg_cost IS NULL THEN
        v_avg_cost := 0;
    END IF;

    -- Gán giá vốn snapshot
    NEW.cost_at_sale := v_avg_cost;
    -- Tính lợi nhuận: Doanh thu - (Số lượng * Giá vốn)
    NEW.profit := COALESCE(NEW.total_price, 0) - (COALESCE(NEW.quantity, 0) * v_avg_cost);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PHẦN 3: BẬT ROW LEVEL SECURITY TRÊN CÁC BẢNG
-- =============================================================================

-- Bảng đơn hàng
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Bảng sản phẩm
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;

-- Bảng nhà cung cấp
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

-- Bảng tồn kho
ALTER TABLE public.inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Bảng khách hàng
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Bảng ca làm việc
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- Bảng đơn nhập hàng
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Bảng thương hiệu và chi nhánh
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Bảng người dùng
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Bảng giá theo chi nhánh
ALTER TABLE public.branch_prices ENABLE ROW LEVEL SECURITY;

-- Bảng audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PHẦN 4: TẠO/CẬP NHẬT RLS POLICIES CHO CÁC BẢNG QUAN TRỌNG
-- =============================================================================

-- -------------------- ORDERS --------------------
DROP POLICY IF EXISTS "Orders select" ON public.orders;
DROP POLICY IF EXISTS "Orders insert" ON public.orders;
DROP POLICY IF EXISTS "Orders update" ON public.orders;
DROP POLICY IF EXISTS "Orders delete" ON public.orders;
DROP POLICY IF EXISTS "Full access for authenticated" ON public.orders;

CREATE POLICY "Orders select" ON public.orders FOR SELECT USING (
    brand_id = public.get_user_brand_id()
);

CREATE POLICY "Orders insert" ON public.orders FOR INSERT WITH CHECK (
    brand_id = public.get_user_brand_id()
    AND (
        branch_id = public.get_user_branch_id()
        OR branch_id IS NULL
        OR public.is_admin_or_owner()
    )
);

CREATE POLICY "Orders update" ON public.orders FOR UPDATE USING (
    brand_id = public.get_user_brand_id()
);

CREATE POLICY "Orders delete" ON public.orders FOR DELETE USING (
    brand_id = public.get_user_brand_id() AND public.is_admin_or_owner()
);

-- -------------------- ORDER_ITEMS --------------------
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update" ON public.order_items;
DROP POLICY IF EXISTS "order_items_delete" ON public.order_items;
DROP POLICY IF EXISTS "Full access for authenticated" ON public.order_items;

CREATE POLICY "order_items_select" ON public.order_items FOR SELECT USING (
    order_id IN (SELECT id FROM public.orders WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT WITH CHECK (
    order_id IN (SELECT id FROM public.orders WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "order_items_update" ON public.order_items FOR UPDATE USING (
    order_id IN (SELECT id FROM public.orders WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE USING (
    order_id IN (SELECT id FROM public.orders WHERE brand_id = public.get_user_brand_id())
    AND public.is_admin_or_owner()
);

-- -------------------- PRODUCTS --------------------
DROP POLICY IF EXISTS "products_select" ON public.products;
DROP POLICY IF EXISTS "products_insert" ON public.products;
DROP POLICY IF EXISTS "products_update" ON public.products;
DROP POLICY IF EXISTS "products_delete" ON public.products;
DROP POLICY IF EXISTS "Full access for authenticated" ON public.products;

CREATE POLICY "products_select" ON public.products FOR SELECT USING (
    brand_id = public.get_user_brand_id() OR brand_id IS NULL
);

CREATE POLICY "products_insert" ON public.products FOR INSERT WITH CHECK (
    brand_id = public.get_user_brand_id()
);

CREATE POLICY "products_update" ON public.products FOR UPDATE USING (
    brand_id = public.get_user_brand_id()
);

CREATE POLICY "products_delete" ON public.products FOR DELETE USING (
    brand_id = public.get_user_brand_id() AND public.is_admin_or_owner()
);

-- -------------------- SUPPLIERS --------------------
DROP POLICY IF EXISTS "suppliers_select" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_insert" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_update" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_delete" ON public.suppliers;
DROP POLICY IF EXISTS "Full access for authenticated" ON public.suppliers;

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

-- -------------------- CUSTOMERS --------------------
DROP POLICY IF EXISTS "customers_select" ON public.customers;
DROP POLICY IF EXISTS "customers_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_update" ON public.customers;
DROP POLICY IF EXISTS "customers_delete" ON public.customers;
DROP POLICY IF EXISTS "Full access for authenticated" ON public.customers;

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

-- -------------------- INVENTORIES --------------------
DROP POLICY IF EXISTS "inventories_select" ON public.inventories;
DROP POLICY IF EXISTS "inventories_insert" ON public.inventories;
DROP POLICY IF EXISTS "inventories_update" ON public.inventories;
DROP POLICY IF EXISTS "Full access for authenticated" ON public.inventories;

CREATE POLICY "inventories_select" ON public.inventories FOR SELECT USING (
    brand_id = public.get_user_brand_id()
);

CREATE POLICY "inventories_insert" ON public.inventories FOR INSERT WITH CHECK (
    brand_id = public.get_user_brand_id()
);

CREATE POLICY "inventories_update" ON public.inventories FOR UPDATE USING (
    brand_id = public.get_user_brand_id()
);

-- -------------------- INVENTORY_COSTS --------------------
DROP POLICY IF EXISTS "inventory_costs_select" ON public.inventory_costs;
DROP POLICY IF EXISTS "inventory_costs_insert" ON public.inventory_costs;
DROP POLICY IF EXISTS "inventory_costs_update" ON public.inventory_costs;

CREATE POLICY "inventory_costs_select" ON public.inventory_costs FOR SELECT USING (
    branch_id IN (SELECT id FROM public.branches WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "inventory_costs_insert" ON public.inventory_costs FOR INSERT WITH CHECK (
    branch_id IN (SELECT id FROM public.branches WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "inventory_costs_update" ON public.inventory_costs FOR UPDATE USING (
    branch_id IN (SELECT id FROM public.branches WHERE brand_id = public.get_user_brand_id())
);

-- -------------------- CATEGORIES --------------------
DROP POLICY IF EXISTS "categories_select" ON public.categories;
DROP POLICY IF EXISTS "categories_insert" ON public.categories;
DROP POLICY IF EXISTS "categories_update" ON public.categories;
DROP POLICY IF EXISTS "categories_delete" ON public.categories;
DROP POLICY IF EXISTS "Full access for authenticated" ON public.categories;

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

-- -------------------- SHIFTS --------------------
DROP POLICY IF EXISTS "shifts_select" ON public.shifts;
DROP POLICY IF EXISTS "shifts_insert" ON public.shifts;
DROP POLICY IF EXISTS "shifts_update" ON public.shifts;

CREATE POLICY "shifts_select" ON public.shifts FOR SELECT USING (
    branch_id IN (SELECT id FROM public.branches WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "shifts_insert" ON public.shifts FOR INSERT WITH CHECK (
    branch_id = public.get_user_branch_id()
    OR branch_id IN (SELECT id FROM public.branches WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "shifts_update" ON public.shifts FOR UPDATE USING (
    branch_id IN (SELECT id FROM public.branches WHERE brand_id = public.get_user_brand_id())
);

-- -------------------- PURCHASE_ORDERS --------------------
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

-- -------------------- PURCHASE_ORDER_ITEMS --------------------
DROP POLICY IF EXISTS "purchase_order_items_select" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items_insert" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items_update" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items_delete" ON public.purchase_order_items;

CREATE POLICY "purchase_order_items_select" ON public.purchase_order_items FOR SELECT USING (
    purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "purchase_order_items_insert" ON public.purchase_order_items FOR INSERT WITH CHECK (
    purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "purchase_order_items_update" ON public.purchase_order_items FOR UPDATE USING (
    purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "purchase_order_items_delete" ON public.purchase_order_items FOR DELETE USING (
    purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE brand_id = public.get_user_brand_id())
);

-- -------------------- PRODUCT_UNITS --------------------
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

-- -------------------- STOCK_MOVEMENTS --------------------
DROP POLICY IF EXISTS "stock_movements_select" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_insert" ON public.stock_movements;

CREATE POLICY "stock_movements_select" ON public.stock_movements FOR SELECT USING (true);
CREATE POLICY "stock_movements_insert" ON public.stock_movements FOR INSERT WITH CHECK (true);

-- -------------------- SUPPLIER_PRODUCTS --------------------
DROP POLICY IF EXISTS "supplier_products_select" ON public.supplier_products;
DROP POLICY IF EXISTS "supplier_products_insert" ON public.supplier_products;
DROP POLICY IF EXISTS "supplier_products_update" ON public.supplier_products;
DROP POLICY IF EXISTS "supplier_products_delete" ON public.supplier_products;

CREATE POLICY "supplier_products_select" ON public.supplier_products FOR SELECT USING (
    supplier_id IN (SELECT id FROM public.suppliers WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "supplier_products_insert" ON public.supplier_products FOR INSERT WITH CHECK (
    supplier_id IN (SELECT id FROM public.suppliers WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "supplier_products_update" ON public.supplier_products FOR UPDATE USING (
    supplier_id IN (SELECT id FROM public.suppliers WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "supplier_products_delete" ON public.supplier_products FOR DELETE USING (
    supplier_id IN (SELECT id FROM public.suppliers WHERE brand_id = public.get_user_brand_id())
);

-- -------------------- BRANCH_PRICES --------------------
DROP POLICY IF EXISTS "branch_prices_select" ON public.branch_prices;
DROP POLICY IF EXISTS "branch_prices_insert" ON public.branch_prices;
DROP POLICY IF EXISTS "branch_prices_update" ON public.branch_prices;
DROP POLICY IF EXISTS "branch_prices_delete" ON public.branch_prices;

CREATE POLICY "branch_prices_select" ON public.branch_prices FOR SELECT USING (
    branch_id IN (SELECT id FROM public.branches WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "branch_prices_insert" ON public.branch_prices FOR INSERT WITH CHECK (
    branch_id IN (SELECT id FROM public.branches WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "branch_prices_update" ON public.branch_prices FOR UPDATE USING (
    branch_id IN (SELECT id FROM public.branches WHERE brand_id = public.get_user_brand_id())
);

CREATE POLICY "branch_prices_delete" ON public.branch_prices FOR DELETE USING (
    branch_id IN (SELECT id FROM public.branches WHERE brand_id = public.get_user_brand_id())
);

-- -------------------- USER_PROFILES --------------------
DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON public.user_profiles;

-- User có thể xem profile của mình và các user cùng brand
CREATE POLICY "user_profiles_select" ON public.user_profiles FOR SELECT USING (
    id = auth.uid() OR brand_id = public.get_user_brand_id()
);

-- Chỉ cho phép insert profile của chính mình
CREATE POLICY "user_profiles_insert" ON public.user_profiles FOR INSERT WITH CHECK (
    id = auth.uid()
);

-- User có thể update profile của mình, Admin có thể update user cùng brand
CREATE POLICY "user_profiles_update" ON public.user_profiles FOR UPDATE USING (
    id = auth.uid() OR (brand_id = public.get_user_brand_id() AND public.is_admin_or_owner())
);

-- -------------------- BRANDS --------------------
DROP POLICY IF EXISTS "Users can view own brand" ON public.brands;
DROP POLICY IF EXISTS "Owner can update brand" ON public.brands;

CREATE POLICY "Users can view own brand" ON public.brands FOR SELECT USING (
    owner_id = auth.uid() 
    OR id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid())
);

CREATE POLICY "Owner can update brand" ON public.brands FOR UPDATE USING (
    owner_id = auth.uid()
);

-- -------------------- BRANCHES --------------------
DROP POLICY IF EXISTS "Users can view brand branches" ON public.branches;
DROP POLICY IF EXISTS "Admin can manage branches" ON public.branches;

CREATE POLICY "Users can view brand branches" ON public.branches FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid())
);

CREATE POLICY "Admin can manage branches" ON public.branches FOR ALL USING (
    brand_id IN (
        SELECT brand_id FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
);

-- -------------------- AUDIT_LOGS --------------------
DROP POLICY IF EXISTS "Brand admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

CREATE POLICY "Brand admins can view audit logs" ON public.audit_logs FOR SELECT USING (
    brand_id IN (
        SELECT brand_id FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
);

CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- =============================================================================
-- PHẦN 5: KHÔI PHỤC TRIGGER TÍNH GIÁ VỐN
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_set_cost_at_sale ON order_items;

CREATE TRIGGER trigger_set_cost_at_sale
BEFORE INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION capture_cost_at_sale();

-- =============================================================================
-- PHẦN 6: REFRESH SCHEMA CACHE
-- =============================================================================
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

SELECT 'Migration 037 Complete: RLS + Trigger khôi phục thành công!' AS status;
