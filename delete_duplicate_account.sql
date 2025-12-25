-- Xóa tài khoản trùng "Quản trị viên" từ Supabase
-- ============================================

-- Bước 1: Xem danh sách người dùng hiện tại
SELECT id, full_name, email, role, is_active, created_at 
FROM user_profiles 
ORDER BY created_at;

-- Bước 2: Xóa "Quản trị viên" (giữ lại "Admin")
DELETE FROM user_profiles WHERE full_name = 'Quản trị viên';

-- Bước 3: Kiểm tra lại - Chỉ còn 1 tài khoản
SELECT id, full_name, email, role FROM user_profiles;

-- LƯU Ý: Nếu lỗi foreign key, chạy lệnh sau trước:
-- DELETE FROM work_shifts WHERE user_id IN (SELECT id FROM user_profiles WHERE full_name = 'Quản trị viên');
