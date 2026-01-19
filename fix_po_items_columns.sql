-- =============================================================================
-- FIX PURCHASE ORDER ITEMS - Add missing columns
-- =============================================================================
-- Run this in Supabase SQL Editor

-- Add missing columns to purchase_order_items
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_order_items' AND column_name = 'discount_percent') THEN
        ALTER TABLE purchase_order_items ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_order_items' AND column_name = 'discount_amount') THEN
        ALTER TABLE purchase_order_items ADD COLUMN discount_amount DECIMAL(14,2) DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_order_items' AND column_name = 'tax_percent') THEN
        ALTER TABLE purchase_order_items ADD COLUMN tax_percent DECIMAL(5,2) DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_order_items' AND column_name = 'tax_amount') THEN
        ALTER TABLE purchase_order_items ADD COLUMN tax_amount DECIMAL(14,2) DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_order_items' AND column_name = 'received_qty') THEN
        ALTER TABLE purchase_order_items ADD COLUMN received_qty INT DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_order_items' AND column_name = 'total') THEN
        ALTER TABLE purchase_order_items ADD COLUMN total DECIMAL(14,2) DEFAULT 0;
    END IF;
END $$;

-- Add invoice_images column to purchase_orders for storing images
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'invoice_images') THEN
        ALTER TABLE purchase_orders ADD COLUMN invoice_images TEXT[];
    END IF;
END $$;

-- Disable RLS for easier testing
ALTER TABLE purchase_order_items DISABLE ROW LEVEL SECURITY;

-- Grant access
GRANT ALL ON purchase_order_items TO authenticated, anon;

-- Verify columns
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'purchase_order_items'
ORDER BY ordinal_position;
