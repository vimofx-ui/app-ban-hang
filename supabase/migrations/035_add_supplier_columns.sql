-- =============================================================================
-- FIX #11: Add missing columns to suppliers table
-- =============================================================================

-- Add bank_account and bank_name columns
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS bank_account TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS tax_code TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS website TEXT;

-- Reload schema
SELECT pg_notify('pgrst', 'reload schema');
NOTIFY pgrst, 'reload schema';

SELECT 'Fix #11 Complete: Added missing supplier columns!' AS status;
