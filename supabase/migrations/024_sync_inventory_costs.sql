-- RPC to decrement quantity in inventory_costs without changing avg_cost
-- Used when SELLING items (or any stock_out that uses FIFO/WAC logic where unit value doesn't change)
CREATE OR REPLACE FUNCTION record_stock_out(
    p_product_id UUID,
    p_branch_id UUID,
    p_qty_out INT -- Positive number representing reduction
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Decrease quantity in inventory_costs
    UPDATE inventory_costs
    SET 
        quantity = quantity - p_qty_out,
        updated_at = now()
    WHERE product_id = p_product_id AND branch_id = p_branch_id;
    
    -- Note: We do NOT change avg_cost.
    -- If row doesn't exist, we don't do anything (it implies 0 stock anyway).
END;
$$;
