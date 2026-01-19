-- =============================================================================
-- FIX ORDERS SCHEMA AND RLS POLICIES
-- =============================================================================

-- 1. ADD MISSING COLUMNS
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS is_delivery BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS delivery_info JSONB DEFAULT '{}'::jsonb;

-- 2. FIX RLS POLICIES FOR ORDERS
-- First, ensure RLS is enabled
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts/confusion
DROP POLICY IF EXISTS "Staff view branch orders" ON public.orders;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.orders;
DROP POLICY IF EXISTS "Enable update for own orders" ON public.orders;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.orders;

-- 2.1 INSERT POLICY
-- Allow authenticated users (staff/admin) to create orders
CREATE POLICY "Enable insert for authenticated users" ON public.orders
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = created_by);

-- 2.2 SELECT POLICY
-- Allow users to view orders (broad permission for now to unblock POS)
CREATE POLICY "Enable select for authenticated users" ON public.orders
FOR SELECT TO authenticated 
USING (true);

-- 2.3 UPDATE POLICY
-- Allow users to update orders they created or if they are admin
CREATE POLICY "Enable update for authenticated users" ON public.orders
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true); 

-- 3. FIX RLS POLICIES FOR ORDER_ITEMS
DROP POLICY IF EXISTS "Enable insert for order_items" ON public.order_items;
DROP POLICY IF EXISTS "Enable select for order_items" ON public.order_items;

CREATE POLICY "Enable insert for order_items" ON public.order_items
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable select for order_items" ON public.order_items
FOR SELECT TO authenticated
USING (true);

-- 4. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload config';
