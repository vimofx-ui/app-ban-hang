-- =============================================================================
-- FIELD 'created_by' MISSING IN PRODUCTS TABLE
-- Chạy script này trong Supabase Dashboard → SQL Editor để sửa lỗi "Không thể lưu sản phẩm"
-- =============================================================================

-- 1. Thêm cột created_by vào bảng products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 2. Thêm cột code (nếu cần cho tương lai)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS code TEXT;

-- 3. Cập nhật RLS Policy (Cho phép admin/staff quản lý sản phẩm)
-- Xóa policy cũ nếu có để tránh conflict
DROP POLICY IF EXISTS "Users can manage products" ON products;

-- Tạo policy mới kiểm tra auth
CREATE POLICY "Users can manage products" ON products 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);
