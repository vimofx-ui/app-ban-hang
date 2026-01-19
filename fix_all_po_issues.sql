-- =============================================================================
-- FIX ALL PURCHASE ORDER ISSUES
-- =============================================================================
-- Run this ENTIRE script in Supabase SQL Editor to fix all PO-related issues
-- Created: 2025-12-28
-- =============================================================================

-- 1. Add product_name column to purchase_order_items if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_order_items' AND column_name = 'product_name') THEN
        ALTER TABLE purchase_order_items ADD COLUMN product_name TEXT;
    END IF;
END $$;

-- 2. Add invoice_images column to purchase_orders if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'invoice_images') THEN
        ALTER TABLE purchase_orders ADD COLUMN invoice_images TEXT[];
    END IF;
END $$;

-- 3. Create Activity Log table if not exists
CREATE TABLE IF NOT EXISTS order_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    user_id UUID,
    user_name TEXT,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_order_activity_logs_order_id ON order_activity_logs(order_id);

-- 4. Enable RLS and create policies for activity logs
ALTER TABLE order_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON order_activity_logs;
CREATE POLICY "Enable read access for authenticated users" ON order_activity_logs
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON order_activity_logs;
CREATE POLICY "Enable insert access for authenticated users" ON order_activity_logs
    FOR INSERT WITH CHECK (true);

-- 5. Fix purchase_order_items RLS - make sure authenticated users can insert
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated" ON purchase_order_items;
CREATE POLICY "Enable all for authenticated" ON purchase_order_items
    FOR ALL USING (true) WITH CHECK (true);

-- 6. Fix purchase_orders RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated orders" ON purchase_orders;
CREATE POLICY "Enable all for authenticated orders" ON purchase_orders
    FOR ALL USING (true) WITH CHECK (true);

-- 7. Storage bucket policy for invoice-images (run separately in Storage policies)
-- Go to Supabase Dashboard -> Storage -> invoice-images -> Policies -> Add policy:
-- Policy name: "Public read access"
-- Allowed operations: SELECT
-- Target roles: authenticated, anon
-- USING expression: true

-- 8. Verify the changes
SELECT 'purchase_order_items columns:' as info;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'purchase_order_items' ORDER BY ordinal_position;

SELECT 'purchase_orders columns:' as info;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'purchase_orders' ORDER BY ordinal_position;

SELECT 'order_activity_logs exists:' as info, EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'order_activity_logs') as exists;

-- =============================================================================
-- IMPORTANT: After running this SQL, go to Supabase Dashboard:
-- 1. Storage -> Buckets -> invoice-images -> Make public OR add policies
-- 2. Verify tables were updated correctly
-- =============================================================================
