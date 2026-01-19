-- =============================================================================
-- FIX EXISTING TABLES - Add missing columns
-- =============================================================================
-- Run this if tables already exist but missing columns

-- Add brand_id to purchase_orders if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'brand_id') THEN
        ALTER TABLE purchase_orders ADD COLUMN brand_id UUID REFERENCES brands(id) ON DELETE CASCADE;
        
        -- Set default value for existing rows (use the first brand)
        UPDATE purchase_orders SET brand_id = (SELECT id FROM brands LIMIT 1) WHERE brand_id IS NULL;
    END IF;
END $$;

-- Add branch_id to purchase_orders if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'branch_id') THEN
        ALTER TABLE purchase_orders ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add other missing columns to purchase_orders
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'order_date') THEN
        ALTER TABLE purchase_orders ADD COLUMN order_date DATE DEFAULT CURRENT_DATE;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'subtotal') THEN
        ALTER TABLE purchase_orders ADD COLUMN subtotal DECIMAL(14,2) DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'total_amount') THEN
        ALTER TABLE purchase_orders ADD COLUMN total_amount DECIMAL(14,2) DEFAULT 0;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_po_brand ON purchase_orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_po_branch ON purchase_orders(branch_id);

-- Disable RLS
ALTER TABLE purchase_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;

-- Grant access
GRANT ALL ON purchase_orders TO authenticated, anon;
GRANT ALL ON purchase_order_items TO authenticated, anon;
GRANT ALL ON suppliers TO authenticated, anon;

-- Create/update PO number generator
CREATE OR REPLACE FUNCTION generate_po_number(p_brand_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_count INT;
    v_date VARCHAR(6);
BEGIN
    v_date := TO_CHAR(NOW(), 'YYMMDD');
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM purchase_orders
    WHERE brand_id = p_brand_id
    AND DATE(created_at) = CURRENT_DATE;
    
    RETURN 'REI' || v_date || LPAD(v_count::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Verify
SELECT column_name FROM information_schema.columns WHERE table_name = 'purchase_orders';
