-- 004_add_branch_details.sql
-- Add missing columns to branches table and fix status type to match frontend

-- 1. Add missing columns
ALTER TABLE public.branches
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS is_headquarters BOOLEAN DEFAULT false;

-- 2. Convert status to TEXT (active/inactive)
-- First, drop the default to allow type change
ALTER TABLE public.branches ALTER COLUMN status DROP DEFAULT;

-- Change type with conversion logic
ALTER TABLE public.branches 
ALTER COLUMN status TYPE TEXT 
USING CASE 
    WHEN status = 1 THEN 'active' 
    ELSE 'inactive' 
END;

-- Set new default
ALTER TABLE public.branches ALTER COLUMN status SET DEFAULT 'active';

-- 3. Add check constraint for status
ALTER TABLE public.branches 
ADD CONSTRAINT branches_status_check 
CHECK (status IN ('active', 'inactive'));

-- 4. Update existing rows if any have null is_headquarters
UPDATE public.branches SET is_headquarters = false WHERE is_headquarters IS NULL;

-- 5. Notify
NOTIFY pgrst, 'reload config';
