-- =============================================================================
-- TẠO TÀI KHOẢN ADMIN CHO PRODUCTION
-- Chạy script này trong Supabase SQL Editor
-- =============================================================================

-- LƯU Ý: Bạn KHÔNG THỂ tạo user trực tiếp bằng SQL vì Supabase Auth cần hash password
-- Thay vào đó, hãy làm theo các bước sau:

-- =====================================================
-- CÁCH 1: TẠO USER QUA SUPABASE DASHBOARD (KHUYẾN NGHỊ)
-- =====================================================
-- 1. Vào Supabase Dashboard: https://supabase.com/dashboard
-- 2. Chọn project của bạn
-- 3. Vào Authentication → Users
-- 4. Click "Add user" → "Create new user"
-- 5. Nhập:
--    - Email: storelypos@gmail.com
--    - Password: Vandan1988
--    - ✔ Auto Confirm User (quan trọng!)
-- 6. Click "Create user"
-- 7. Sau khi tạo xong, copy User UID
-- 8. Chạy SQL bên dưới để tạo profile với role admin

-- =====================================================
-- SAU KHI TẠO USER, CHẠY SQL NÀY ĐỂ TẠO PROFILE ADMIN
-- =====================================================
-- Thay 'YOUR_USER_UUID' bằng UUID thực của user vừa tạo

/*
INSERT INTO public.user_profiles (id, full_name, role, is_active)
VALUES (
    'YOUR_USER_UUID',  -- Thay bằng UUID thực từ bước 7
    'Admin',
    'admin',
    true
);
*/

-- =====================================================
-- CÁCH 2: ĐĂNG KÝ QUA APP RỒI UPDATE ROLE
-- =====================================================
-- 1. Mở https://app-ban-hang.vercel.app/register
-- 2. Đăng ký với email: storelypos@gmail.com, password: Vandan1988
-- 3. Xác nhận email (nếu có)
-- 4. Sau khi đăng ký thành công, chạy SQL này để upgrade lên admin:

/*
UPDATE public.user_profiles 
SET role = 'admin' 
WHERE id = (
    SELECT id FROM auth.users WHERE email = 'storelypos@gmail.com'
);
*/

-- =====================================================
-- KIỂM TRA USER ĐÃ TẠO
-- =====================================================

-- Xem tất cả users trong auth.users
-- SELECT id, email, created_at FROM auth.users;

-- Xem tất cả profiles
-- SELECT * FROM public.user_profiles;
