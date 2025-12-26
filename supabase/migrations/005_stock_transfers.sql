-- ============================================================================
-- STORELY POS - STOCK TRANSFERS MIGRATION
-- ============================================================================
-- Enables stock transfers between branches with full workflow tracking

-- 1. STOCK TRANSFERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_code TEXT UNIQUE NOT NULL,
    brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
    from_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    to_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    shipped_at TIMESTAMP WITH TIME ZONE,
    shipped_by UUID REFERENCES auth.users(id),
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES auth.users(id),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by UUID REFERENCES auth.users(id),
    cancel_reason TEXT
);

-- 2. STOCK TRANSFER ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    received_quantity INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_stock_transfers_brand ON public.stock_transfers(brand_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_branch ON public.stock_transfers(from_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_branch ON public.stock_transfers(to_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON public.stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer ON public.stock_transfer_items(transfer_id);

-- 4. ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- Users can view transfers for their brand
DROP POLICY IF EXISTS "Users can view brand transfers" ON public.stock_transfers;
CREATE POLICY "Users can view brand transfers" ON public.stock_transfers
FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid())
);

-- Admin/Manager can manage transfers
DROP POLICY IF EXISTS "Admin can manage transfers" ON public.stock_transfers;
CREATE POLICY "Admin can manage transfers" ON public.stock_transfers
FOR ALL USING (
    brand_id IN (
        SELECT brand_id FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
);

-- Transfer items policies
DROP POLICY IF EXISTS "Users can view transfer items" ON public.stock_transfer_items;
CREATE POLICY "Users can view transfer items" ON public.stock_transfer_items
FOR SELECT USING (
    transfer_id IN (
        SELECT id FROM public.stock_transfers 
        WHERE brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid())
    )
);

DROP POLICY IF EXISTS "Admin can manage transfer items" ON public.stock_transfer_items;
CREATE POLICY "Admin can manage transfer items" ON public.stock_transfer_items
FOR ALL USING (
    transfer_id IN (
        SELECT id FROM public.stock_transfers 
        WHERE brand_id IN (
            SELECT brand_id FROM public.user_profiles 
            WHERE id = auth.uid() AND role IN ('owner', 'admin', 'manager')
        )
    )
);

-- 5. HELPER FUNCTION: Generate Transfer Code
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_transfer_code(p_brand_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    next_num INTEGER;
    code TEXT;
BEGIN
    -- Get the next number for this brand
    SELECT COALESCE(MAX(
        CASE 
            WHEN transfer_code ~ '^TF-[0-9]+$' 
            THEN CAST(SUBSTRING(transfer_code FROM 4) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO next_num
    FROM public.stock_transfers
    WHERE brand_id = p_brand_id;
    
    code := 'TF-' || LPAD(next_num::TEXT, 5, '0');
    RETURN code;
END;
$$;

-- 6. FUNCTION: Ship Transfer (deduct from source)
-- ============================================================================
CREATE OR REPLACE FUNCTION ship_stock_transfer(
    p_transfer_id UUID,
    p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transfer RECORD;
    v_item RECORD;
BEGIN
    -- Get transfer details
    SELECT * INTO v_transfer FROM public.stock_transfers WHERE id = p_transfer_id;
    
    IF v_transfer IS NULL THEN
        RAISE EXCEPTION 'Transfer not found';
    END IF;
    
    IF v_transfer.status != 'pending' THEN
        RAISE EXCEPTION 'Transfer must be in pending status to ship';
    END IF;
    
    -- Deduct inventory from source branch
    FOR v_item IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id
    LOOP
        -- Use existing decrement function
        PERFORM decrement_inventory(v_transfer.from_branch_id, v_item.product_id, v_item.quantity);
        
        -- Log the movement
        INSERT INTO public.inventory_logs (brand_id, branch_id, product_id, type, quantity, reference_id, notes, created_by)
        VALUES (v_transfer.brand_id, v_transfer.from_branch_id, v_item.product_id, 'transfer', -v_item.quantity, p_transfer_id, 'Transfer out: ' || v_transfer.transfer_code, p_user_id);
    END LOOP;
    
    -- Update transfer status
    UPDATE public.stock_transfers
    SET status = 'in_transit',
        shipped_at = NOW(),
        shipped_by = p_user_id
    WHERE id = p_transfer_id;
END;
$$;

-- 7. FUNCTION: Complete Transfer (add to destination)
-- ============================================================================
CREATE OR REPLACE FUNCTION complete_stock_transfer(
    p_transfer_id UUID,
    p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transfer RECORD;
    v_item RECORD;
    v_qty INTEGER;
BEGIN
    -- Get transfer details
    SELECT * INTO v_transfer FROM public.stock_transfers WHERE id = p_transfer_id;
    
    IF v_transfer IS NULL THEN
        RAISE EXCEPTION 'Transfer not found';
    END IF;
    
    IF v_transfer.status != 'in_transit' THEN
        RAISE EXCEPTION 'Transfer must be in transit to complete';
    END IF;
    
    -- Add inventory to destination branch
    FOR v_item IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id
    LOOP
        -- Use received quantity if set, otherwise use original quantity
        v_qty := COALESCE(NULLIF(v_item.received_quantity, 0), v_item.quantity);
        
        -- Use existing increment function
        PERFORM increment_inventory(v_transfer.to_branch_id, v_item.product_id, v_qty);
        
        -- Log the movement
        INSERT INTO public.inventory_logs (brand_id, branch_id, product_id, type, quantity, reference_id, notes, created_by)
        VALUES (v_transfer.brand_id, v_transfer.to_branch_id, v_item.product_id, 'transfer', v_qty, p_transfer_id, 'Transfer in: ' || v_transfer.transfer_code, p_user_id);
    END LOOP;
    
    -- Update transfer status
    UPDATE public.stock_transfers
    SET status = 'completed',
        completed_at = NOW(),
        completed_by = p_user_id
    WHERE id = p_transfer_id;
END;
$$;

-- 8. FUNCTION: Cancel Transfer (rollback if shipped)
-- ============================================================================
CREATE OR REPLACE FUNCTION cancel_stock_transfer(
    p_transfer_id UUID,
    p_user_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transfer RECORD;
    v_item RECORD;
BEGIN
    -- Get transfer details
    SELECT * INTO v_transfer FROM public.stock_transfers WHERE id = p_transfer_id;
    
    IF v_transfer IS NULL THEN
        RAISE EXCEPTION 'Transfer not found';
    END IF;
    
    IF v_transfer.status = 'completed' THEN
        RAISE EXCEPTION 'Cannot cancel a completed transfer';
    END IF;
    
    -- If in_transit, rollback inventory deduction
    IF v_transfer.status = 'in_transit' THEN
        FOR v_item IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id
        LOOP
            -- Add back to source branch
            PERFORM increment_inventory(v_transfer.from_branch_id, v_item.product_id, v_item.quantity);
            
            -- Log the rollback
            INSERT INTO public.inventory_logs (brand_id, branch_id, product_id, type, quantity, reference_id, notes, created_by)
            VALUES (v_transfer.brand_id, v_transfer.from_branch_id, v_item.product_id, 'adjustment', v_item.quantity, p_transfer_id, 'Transfer cancelled: ' || v_transfer.transfer_code, p_user_id);
        END LOOP;
    END IF;
    
    -- Update transfer status
    UPDATE public.stock_transfers
    SET status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = p_user_id,
        cancel_reason = p_reason
    WHERE id = p_transfer_id;
END;
$$;

-- 9. REFRESH SCHEMA CACHE
-- ============================================================================
NOTIFY pgrst, 'reload config';
