-- =============================================================================
-- 044: INVENTORY AUDIT SYSTEM (Kiểm kê kho)
-- =============================================================================

-- 1. Create stock_audits table
CREATE TABLE IF NOT EXISTS stock_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL, -- References branches(id)
    code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID DEFAULT auth.uid(),
    completed_at TIMESTAMPTZ,
    completed_by UUID
);

-- 2. Create stock_audit_items table
CREATE TABLE IF NOT EXISTS stock_audit_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES stock_audits(id) ON DELETE CASCADE,
    product_id UUID NOT NULL, -- References products(id)
    system_qty INTEGER NOT NULL DEFAULT 0,
    actual_qty INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS Policies (Simplified for now)
ALTER TABLE stock_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_audit_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_audits_all" ON stock_audits;
CREATE POLICY "stock_audits_all" ON stock_audits FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "stock_audit_items_all" ON stock_audit_items;
CREATE POLICY "stock_audit_items_all" ON stock_audit_items FOR ALL USING (auth.role() = 'authenticated');

-- 4. Grant Permissions
GRANT ALL ON stock_audits TO authenticated;
GRANT ALL ON stock_audit_items TO authenticated;
GRANT SELECT ON stock_audits TO anon;
GRANT SELECT ON stock_audit_items TO anon;

-- 5. Function to apply audit results
CREATE OR REPLACE FUNCTION apply_inventory_audit(p_audit_id UUID)
RETURNS VOID AS $$
DECLARE
    r RECORD;
    v_branch_id UUID;
    v_status TEXT;
BEGIN
    -- Get audit info
    SELECT branch_id, status INTO v_branch_id, v_status
    FROM stock_audits WHERE id = p_audit_id;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Audit not found';
    END IF;

    IF v_status != 'draft' THEN
        RAISE EXCEPTION 'Audit must be in draft status to apply';
    END IF;

    -- Loop through items and update inventory
    FOR r IN SELECT * FROM stock_audit_items WHERE audit_id = p_audit_id LOOP
        -- Upsert inventory
        INSERT INTO inventories (product_id, branch_id, quantity, updated_at)
        VALUES (r.product_id, v_branch_id, r.actual_qty, now())
        ON CONFLICT (product_id, branch_id) 
        DO UPDATE SET 
            quantity = EXCLUDED.quantity,
            updated_at = now();
    END LOOP;

    -- Update audit status
    UPDATE stock_audits
    SET status = 'completed',
        completed_at = now(),
        completed_by = auth.uid()
    WHERE id = p_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION apply_inventory_audit(UUID) TO authenticated;
