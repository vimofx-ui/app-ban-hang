-- =============================================================================
-- BRAND CUSTOMIZATION & WHITE-LABEL MIGRATION
-- =============================================================================

-- 1. Extend Brands Table with Customization Fields
-- Note: Some fields might already exist from previous migrations, using IF NOT EXISTS
ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#16a34a', -- Default Green
ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#16a34a',
ADD COLUMN IF NOT EXISTS receipt_logo_url TEXT,
ADD COLUMN IF NOT EXISTS receipt_footer_text TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS support_phone TEXT,
ADD COLUMN IF NOT EXISTS support_email TEXT;

-- 2. Storage Bucket for Brand Assets (Logos)
-- We need to ensure the bucket 'brand-assets' exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Public Access to Brand Assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'brand-assets');

CREATE POLICY "Authenticated users can upload brand assets"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'brand-assets' AND
    auth.role() = 'authenticated'
);

CREATE POLICY "Owners can update their brand assets"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'brand-assets' AND
    auth.uid() = owner
);

CREATE POLICY "Owners can delete their brand assets"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'brand-assets' AND
    auth.uid() = owner
);

-- 3. Brand Settings History (Optional - for reverting changes)
-- Skipped for now to keep it simple

-- 4. Dynamic Manifest Support (Concept)
-- No SQL needed, handled by API/Edge Function
