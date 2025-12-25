-- Fix missing columns in products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS category_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS exclude_from_loyalty_points BOOLEAN DEFAULT false;

-- Verify policies
DROP POLICY IF EXISTS "Users can manage products" ON products;
CREATE POLICY "Users can manage products" ON products 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Refresh schema cache (usually automatic but good to know)
NOTIFY pgrst, 'reload config';
