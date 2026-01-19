-- =============================================================================
-- FIX #10: Add ALL remaining missing columns to products table
-- =============================================================================

-- Add purchase_price column (the error shows this is missing)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchase_price NUMERIC DEFAULT 0;

-- Add price column (for backward compatibility)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price NUMERIC;

-- Sync price with selling_price if null
UPDATE public.products SET price = selling_price WHERE price IS NULL;
UPDATE public.products SET purchase_price = cost_price WHERE purchase_price IS NULL OR purchase_price = 0;

-- Add any other potentially missing columns from productStore
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS has_price_override BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS base_price NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS exclude_from_loyalty_points BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_wholesale_qty INTEGER DEFAULT 1;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_by UUID;

-- Reload schema
SELECT pg_notify('pgrst', 'reload schema');
NOTIFY pgrst, 'reload schema';

SELECT 'Fix #10 Complete: Added purchase_price and other missing columns!' AS status;
