-- Fix status check constraint
-- Run this in Supabase SQL Editor

-- Drop the old check constraint
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

-- Add new check constraint with all valid statuses
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check 
CHECK (status IN ('draft', 'pending', 'approved', 'ordered', 'delivering', 'partial', 'received', 'cancelled', 'completed'));

-- Verify
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'purchase_orders' AND constraint_type = 'CHECK';
