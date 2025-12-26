-- =============================================================================
-- BRAND SLUG MIGRATION - Add slug field for subdomain-based routing
-- =============================================================================

-- Add slug column to brands table for subdomain identification
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique index on slug (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_slug 
ON public.brands (LOWER(slug)) 
WHERE slug IS NOT NULL;

-- Update existing brands with auto-generated slugs based on their names
-- Converts name to lowercase, replaces spaces with hyphens, removes special chars
UPDATE public.brands 
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;

-- Function to auto-generate slug from name on insert
CREATE OR REPLACE FUNCTION public.generate_brand_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := LOWER(REGEXP_REPLACE(REGEXP_REPLACE(NEW.name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g'));
        
        -- Ensure uniqueness by appending random suffix if exists
        WHILE EXISTS (SELECT 1 FROM public.brands WHERE LOWER(slug) = LOWER(NEW.slug) AND id != NEW.id) LOOP
            NEW.slug := NEW.slug || '-' || SUBSTRING(gen_random_uuid()::TEXT, 1, 4);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto slug generation
DROP TRIGGER IF EXISTS trigger_brand_slug ON public.brands;
CREATE TRIGGER trigger_brand_slug
    BEFORE INSERT OR UPDATE ON public.brands
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_brand_slug();

-- Add brand settings columns for white-label support (optional, prepare for Phase 4)
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#16a34a';
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#059669';

-- Comment for documentation
COMMENT ON COLUMN public.brands.slug IS 'URL-safe identifier for subdomain routing (e.g., "my-store" -> my-store.storelypos.com)';
