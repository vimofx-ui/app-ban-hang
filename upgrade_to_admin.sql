-- =============================================================================
-- UPGRADE STORELYPOS@GMAIL.COM TO ADMIN
-- Chạy trong Supabase Dashboard → SQL Editor
-- =============================================================================

-- BƯỚC 1: Kiểm tra user đã có trong user_profiles chưa
SELECT * FROM public.user_profiles;

-- BƯỚC 2: Kiểm tra user trong auth.users
SELECT id, email, created_at FROM auth.users WHERE email = 'storelypos@gmail.com';

-- BƯỚC 3: Tạo hoặc update profile với role admin
-- Nếu chưa có profile, sẽ INSERT. Nếu có rồi, sẽ UPDATE role thành admin
INSERT INTO public.user_profiles (id, full_name, role, is_active)
SELECT id, 'Admin', 'admin', true
FROM auth.users 
WHERE email = 'storelypos@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- BƯỚC 4: Kiểm tra kết quả
SELECT u.email, p.full_name, p.role, p.is_active
FROM auth.users u 
LEFT JOIN public.user_profiles p ON u.id = p.id
WHERE u.email = 'storelypos@gmail.com';
