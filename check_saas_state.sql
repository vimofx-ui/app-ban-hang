-- Check Brands
SELECT * FROM brands;

-- Check Branches
SELECT * FROM branches;

-- Check User Profiles (limit 5) to see if brand_id/branch_id are set
SELECT id, email, role, brand_id, branch_id FROM user_profiles LIMIT 5;

-- Check trigger function existence
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_type = 'FUNCTION' 
AND routine_name = 'handle_new_user_brand';
