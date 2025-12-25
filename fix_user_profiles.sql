-- Fix Foreign Key Constraint on user_profiles
-- =============================================
-- Lỗi hiện tại: user_profiles.id phải tồn tại trong auth.users
-- Giải pháp: Xóa foreign key constraint để cho phép tạo nhân viên độc lập

-- Bước 1: Tìm tên constraint (có thể khác trên hệ thống khác)
SELECT conname, conrelid::regclass AS table_name
FROM pg_constraint
WHERE conrelid = 'public.user_profiles'::regclass
AND contype = 'f';

-- Bước 2: Xóa foreign key constraint
-- QUAN TRỌNG: Thay 'user_profiles_id_fkey' bằng tên constraint từ bước 1 nếu khác
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

-- Bước 3: Thêm các cột cần thiết (nếu chưa có)
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS role_id TEXT;

-- Bước 4: Đảm bảo RLS policy cho phép insert
DROP POLICY IF EXISTS "Allow authenticated users full access" ON user_profiles;
CREATE POLICY "Allow authenticated users full access" ON user_profiles
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bước 5: Refresh cache
NOTIFY pgrst, 'reload config';

-- Hoàn tất! Giờ bạn có thể tạo nhân viên mà không cần tài khoản Auth
