-- Delete duplicate admin account
-- First, check which accounts exist
SELECT id, full_name, role, email, created_at 
FROM user_profiles 
ORDER BY created_at;

-- To delete "Quản trị viên" account (keeping "Admin"), run:
DELETE FROM user_profiles WHERE full_name = 'Quản trị viên';

-- OR if you want to delete by ID (safer), first get the ID from above query, then:
-- DELETE FROM user_profiles WHERE id = 'PUT_THE_ID_HERE';

-- IMPORTANT: If this user has related records in other tables, you may need to delete those first
-- or update the foreign key constraints.
