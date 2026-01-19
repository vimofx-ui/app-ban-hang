-- =============================================================================
-- FIX #12: Fix payment_terms column type
-- =============================================================================

-- Change payment_terms column type from INTEGER/NUMERIC to TEXT to support values like "30 ngày"
ALTER TABLE public.suppliers ALTER COLUMN payment_terms TYPE TEXT USING payment_terms::TEXT;

-- Reload schema
SELECT pg_notify('pgrst', 'reload schema');
NOTIFY pgrst, 'reload schema';

SELECT 'Fix #12 Complete: Changed payment_terms to TEXT!' AS status;
