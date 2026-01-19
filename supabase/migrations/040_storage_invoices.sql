-- =============================================================================
-- MIGRATION 040: Setup Storage Bucket cho Hóa đơn (Invoices)
-- 
-- Mục đích: Tạo bucket 'invoices' để lưu ảnh hóa đơn
-- =============================================================================

-- 1. Tạo bucket 'invoices' nếu chưa tồn tại
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Setup Security Policies (RLS)

-- Cho phép xem ảnh (Public READ)
CREATE POLICY "Public Access Invoices" ON storage.objects
  FOR SELECT USING (bucket_id = 'invoices');

-- Cho phép upload ảnh (Authenticated Users)
CREATE POLICY "Authenticated Upload Invoices" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND bucket_id = 'invoices'
  );

-- Cho phép update ảnh (Authenticated Users)
CREATE POLICY "Authenticated Update Invoices" ON storage.objects
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND bucket_id = 'invoices'
  );

-- Cho phép xóa ảnh (Authenticated Users)
CREATE POLICY "Authenticated Delete Invoices" ON storage.objects
  FOR DELETE USING (
    auth.role() = 'authenticated' AND bucket_id = 'invoices'
  );

-- Lưu ý: Để tự động xóa ảnh sau 90 ngày, vui lòng thiết lập Lifecycle Rule trong Supabase Dashboard -> Storage -> invoices -> Configuration -> Lifecycle Rules.
