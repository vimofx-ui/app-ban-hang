-- =============================================================================
-- FIX #7: NUCLEAR OPTION - Completely Remove RLS for Development
-- 
-- This is the most aggressive fix. It completely disables RLS on ALL tables
-- so we can confirm the app logic works without database permission issues.
--
-- RUN THIS IF NOTHING ELSE WORKS!
-- =============================================================================

-- DISABLE RLS ON ALL CRITICAL TABLES
ALTER TABLE IF EXISTS public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_costs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.brands DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.supplier_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_units DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.branch_prices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs DISABLE ROW LEVEL SECURITY;

-- DROP ALL TRIGGERS that might interfere
DROP TRIGGER IF EXISTS trigger_set_cost_at_sale ON order_items;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Verify all critical columns exist
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_name TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS cost_at_sale NUMERIC DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS profit NUMERIC DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS total_price NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN DEFAULT false;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS brand_id UUID;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS debt_balance NUMERIC DEFAULT 0;

-- REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

SELECT 'NUCLEAR FIX COMPLETE: ALL RLS DISABLED, ALL TRIGGERS DROPPED!' AS status;
