-- Add cost allocation fields to purchase_orders
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS shipping_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS import_tax numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_costs numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS supplier_discount numeric DEFAULT 0;

-- Add cost allocation fields to purchase_order_items
ALTER TABLE purchase_order_items
ADD COLUMN IF NOT EXISTS allocated_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS final_unit_cost numeric DEFAULT 0;

-- Update function to generate PO number if needed (optional, existing logic seems fine)
-- No changes needed for existing RLS if policies cover update/insert on all columns
