-- Invoice Image Storage Setup
-- Run this in Supabase SQL Editor

-- Ensure invoice_images column exists on purchase_orders table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'purchase_orders' 
        AND column_name = 'invoice_images'
    ) THEN
        ALTER TABLE purchase_orders ADD COLUMN invoice_images TEXT[];
    END IF;
END $$;

-- Create storage bucket for invoice images
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-images', 'invoice-images', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated uploads to invoice-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from invoice-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow service role deletes from invoice-images" ON storage.objects;

-- Allow authenticated users to upload to invoice-images bucket
CREATE POLICY "Allow authenticated uploads to invoice-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoice-images');

-- Allow authenticated users to read from invoice-images bucket  
CREATE POLICY "Allow authenticated reads from invoice-images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'invoice-images');

-- Allow service role to delete from invoice-images bucket
CREATE POLICY "Allow service role deletes from invoice-images"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'invoice-images');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_purchase_orders_invoice_images 
ON purchase_orders USING GIN (invoice_images);
