-- 1. Add cost tracking columns to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_at_sale NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS profit NUMERIC DEFAULT 0;

-- 2. Trigger function to capture cost automatically
CREATE OR REPLACE FUNCTION capture_cost_at_sale()
RETURNS TRIGGER AS $$
DECLARE
    v_branch_id UUID;
    v_avg_cost NUMERIC := 0;
BEGIN
    -- Get Branch ID from Order
    -- This assumes the Order row exists before Items are inserted (standard flow)
    SELECT branch_id INTO v_branch_id FROM orders WHERE id = NEW.order_id;

    -- Get Weighted Average Cost from inventory_costs (Primary source)
    SELECT avg_cost INTO v_avg_cost
    FROM inventory_costs
    WHERE product_id = NEW.product_id AND branch_id = v_branch_id;

    -- Fallback: If no WAC record (e.g. data migration issue), check products.cost_price
    IF v_avg_cost IS NULL OR v_avg_cost = 0 THEN
       SELECT cost_price INTO v_avg_cost FROM products WHERE id = NEW.product_id;
    END IF;
    
    -- Ensure distinct 0 if still null
    IF v_avg_cost IS NULL THEN
        v_avg_cost := 0;
    END IF;

    -- Set the snapshot values
    NEW.cost_at_sale := v_avg_cost;
    -- Calculate profit for this item line
    -- total_price is revenue. Profit = Revenue - (Qty * Cost)
    -- This assumes total_price is already net of discounts?
    -- Usually total_price in order_items is (unit_price * qty) - discount
    NEW.profit := (NEW.total_price) - (NEW.quantity * v_avg_cost);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create Trigger
DROP TRIGGER IF EXISTS trigger_set_cost_at_sale ON order_items;

CREATE TRIGGER trigger_set_cost_at_sale
BEFORE INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION capture_cost_at_sale();
