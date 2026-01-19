-- =============================================================================
-- TEST: Check if audit_logs table has data & INSERT test record
-- Run this in Supabase SQL Editor
-- =============================================================================

-- 1. Check current data in audit_logs
SELECT * FROM public.audit_logs ORDER BY created_at DESC LIMIT 10;

-- 2. If empty, INSERT a test record manually
INSERT INTO public.audit_logs (brand_id, user_id, action, entity_type, entity_id, new_values)
SELECT 
    (SELECT id FROM brands LIMIT 1),
    auth.uid(),
    'TEST_LOG',
    'system',
    gen_random_uuid(),
    '{"message": "Test log entry"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE action = 'TEST_LOG' LIMIT 1);

-- 3. Verify the insert worked
SELECT * FROM public.audit_logs ORDER BY created_at DESC LIMIT 10;
