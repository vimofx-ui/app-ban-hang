-- 1. Table to store Weighted Average Cost (WAC)
-- This table tracks the cost SEPARATELY from quantity (in inventories)
-- though they should be updated together.
CREATE TABLE IF NOT EXISTS inventory_costs (
    product_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    avg_cost NUMERIC DEFAULT 0,
    quantity INT DEFAULT 0, -- Snapshot quantity at time of cost update
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (product_id, branch_id)
);

-- Enable RLS
ALTER TABLE inventory_costs ENABLE ROW LEVEL SECURITY;

-- 2. RLS Policies
CREATE POLICY "Enable read for authenticated users based on branch" ON inventory_costs
    FOR SELECT
    USING (
        branch_id IN (
            SELECT branch_id FROM user_profiles WHERE id = auth.uid()
        )
        OR 
        EXISTS (
            SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- 3. RPC to Calculate and Update Weighted Average Cost
-- This handles both IMPORT (qty_in > 0) and RETURN TO SUPPLIER (qty_in < 0)
CREATE OR REPLACE FUNCTION update_avg_cost(
    p_product_id UUID,
    p_branch_id UUID,
    p_qty_in INT,
    p_unit_cost NUMERIC -- For Import: final_unit_price; For Return: original final_unit_price
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_q_old INT := 0;
    v_c_old NUMERIC := 0;
    v_total_old NUMERIC;
    v_total_in NUMERIC;
    v_c_new NUMERIC;
    v_q_new INT;
BEGIN
    -- Get current cost and quantity from inventory_costs
    -- Note: inventory_costs.quantity tracks the qty used for cost calc, 
    -- which might slightly differ from 'inventories' if not perfectly synced, 
    -- but for WAC formula we need independent variables to be safe.
    -- However, better to trust 'inventories' as source of truth for QUANTITY.
    
    SELECT quantity INTO v_q_old
    FROM inventories 
    WHERE product_id = p_product_id AND branch_id = p_branch_id;
    
    IF v_q_old IS NULL THEN
        v_q_old := 0;
    END IF;

    SELECT avg_cost INTO v_c_old
    FROM inventory_costs
    WHERE product_id = p_product_id AND branch_id = p_branch_id;

    IF v_c_old IS NULL THEN
        v_c_old := 0;
    END IF;

    -- Calculate Totals
    v_total_old := v_q_old * v_c_old;
    v_total_in := p_qty_in * p_unit_cost;
    v_q_new := v_q_old + p_qty_in;

    -- Safety check for divide by zero or negative stock scenarios
    IF v_q_new <= 0 THEN
        -- If stock becomes 0 or negative, reset cost to 0 or keep last known?
        -- Standard: If 0, cost is 0.
        v_c_new := 0;
    ELSE
        -- WAC Formula
        v_c_new := (v_total_old + v_total_in) / v_q_new;
    END IF;

    -- Prevent negative cost (should not happen mathematically if inputs are correct, but safe guard)
    IF v_c_new < 0 THEN
        v_c_new := 0;
    END IF;

    -- Update inventory_costs table
    INSERT INTO inventory_costs (product_id, branch_id, avg_cost, quantity, updated_at)
    VALUES (p_product_id, p_branch_id, v_c_new, v_q_new, now())
    ON CONFLICT (product_id, branch_id)
    DO UPDATE SET
        avg_cost = EXCLUDED.avg_cost,
        quantity = EXCLUDED.quantity,
        updated_at = now();

    -- Update real inventory quantity
    -- (This assumes this RPC is the ONLY way to change stock for these transactions)
    -- BUT, 'inventories' table might be updated elsewhere. 
    -- To follow the specific request flow: This function updates COST.
    -- We should also update the Physical Stock here to ensure atomicity.
    
    INSERT INTO inventories (branch_id, brand_id, product_id, quantity)
    VALUES (
        p_branch_id, 
        (SELECT brand_id FROM branches WHERE id = p_branch_id), 
        p_product_id, 
        p_qty_in
    )
    ON CONFLICT (branch_id, product_id)
    DO UPDATE SET
        quantity = inventories.quantity + p_qty_in;

END;
$$;
