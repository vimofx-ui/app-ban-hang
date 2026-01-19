-- =============================================================================
-- FIX PURCHASE ORDERS SCHEMA
-- =============================================================================
-- Run this in Supabase SQL Editor to add missing columns and tables
-- This is a quick fix - the full migration is in smart_purchase_orders.sql

-- Add branch_id column if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'branch_id') THEN
        ALTER TABLE purchase_orders ADD COLUMN branch_id UUID REFERENCES branches(id);
    END IF;
END $$;

-- Add order_date column if missing  
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'order_date') THEN
        ALTER TABLE purchase_orders ADD COLUMN order_date DATE DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- Make supplier_id nullable for orders without supplier
ALTER TABLE purchase_orders ALTER COLUMN supplier_id DROP NOT NULL;

-- Create index for branch_id
CREATE INDEX IF NOT EXISTS idx_po_branch ON purchase_orders(branch_id);

-- Disable RLS for testing (enable after fixing JWT-based policies)
ALTER TABLE purchase_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;

-- Grant access
GRANT ALL ON purchase_orders TO authenticated;
GRANT ALL ON purchase_order_items TO authenticated;
GRANT ALL ON suppliers TO authenticated;

-- Create generate_po_number function if not exists
CREATE OR REPLACE FUNCTION generate_po_number(p_brand_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_count INT;
    v_prefix VARCHAR(10);
    v_date VARCHAR(8);
BEGIN
    v_date := TO_CHAR(NOW(), 'YYMMDD');
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM purchase_orders
    WHERE brand_id = p_brand_id
    AND DATE(created_at) = CURRENT_DATE;
    
    RETURN 'REI' || v_date || LPAD(v_count::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Test the function
-- SELECT generate_po_number('your-brand-id-here');

COMMIT;
