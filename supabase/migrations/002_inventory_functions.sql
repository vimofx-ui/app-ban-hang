-- ============================================================================
-- STORELY POS - PHASE 3: INVENTORY FUNCTIONS
-- ============================================================================

-- 1. Decrement inventory (for order sync from POS)
-- ============================================================================
CREATE OR REPLACE FUNCTION decrement_inventory(
    p_branch_id UUID,
    p_product_id UUID,
    p_quantity INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Try to update existing inventory record
    UPDATE inventories
    SET quantity = quantity - p_quantity,
        updated_at = NOW()
    WHERE branch_id = p_branch_id
    AND product_id = p_product_id;

    -- If no row was updated, create new inventory record with negative
    IF NOT FOUND THEN
        INSERT INTO inventories (branch_id, product_id, quantity, updated_at)
        VALUES (p_branch_id, p_product_id, -p_quantity, NOW());
    END IF;
END;
$$;

-- 2. Increment inventory (for restocking / receiving goods)
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_inventory(
    p_branch_id UUID,
    p_product_id UUID,
    p_quantity INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Try to update existing inventory record
    UPDATE inventories
    SET quantity = quantity + p_quantity,
        updated_at = NOW()
    WHERE branch_id = p_branch_id
    AND product_id = p_product_id;

    -- If no row was updated, create new inventory record
    IF NOT FOUND THEN
        INSERT INTO inventories (branch_id, product_id, quantity, updated_at)
        VALUES (p_branch_id, p_product_id, p_quantity, NOW());
    END IF;
END;
$$;

-- 3. Get inventory for a branch
-- ============================================================================
CREATE OR REPLACE FUNCTION get_branch_inventory(p_branch_id UUID)
RETURNS TABLE (
    product_id UUID,
    quantity INTEGER
)
LANGUAGE sql
STABLE
AS $$
    SELECT product_id, quantity
    FROM inventories
    WHERE branch_id = p_branch_id;
$$;

-- 4. Inventory logs table (for audit)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID,
    branch_id UUID,
    product_id UUID,
    type TEXT CHECK (type IN ('in', 'out', 'adjustment', 'transfer')),
    quantity INTEGER,
    reference_id UUID, -- order_id, transfer_id, etc.
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own branch logs" ON public.inventory_logs
FOR SELECT USING (
    branch_id IN (SELECT branch_id FROM public.user_profiles WHERE id = auth.uid())
);

CREATE POLICY "Admin can insert logs" ON public.inventory_logs
FOR INSERT WITH CHECK (true);

-- 5. Add local_id column to orders if not exists
-- ============================================================================
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS local_id UUID UNIQUE;

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_orders_local_id ON public.orders(local_id);

-- 6. Refresh schema cache
-- ============================================================================
NOTIFY pgrst, 'reload config';
