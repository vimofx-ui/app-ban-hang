-- Fix missing category_ids column in products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS category_ids uuid[] DEFAULT '{}';

-- Create index for better performance on array operations
CREATE INDEX IF NOT EXISTS idx_products_category_ids ON products USING GIN (category_ids);
