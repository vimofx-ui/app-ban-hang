-- =============================================================================
-- FIX #8: Add missing 'price' column to products and reload schema
-- =============================================================================

-- Add 'price' column (some queries might be looking for this instead of selling_price)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price NUMERIC;

-- Sync price with selling_price for existing data
UPDATE public.products SET price = selling_price WHERE price IS NULL;

-- Also add any other potentially missing columns
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_wholesale_qty INTEGER DEFAULT 1;

-- REFRESH SCHEMA CACHE - Multiple notifications to ensure it works
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload config');

-- Also try the NOTIFY command directly
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

SELECT 'Fix #8: Added price column and reloaded schema!' AS status;
