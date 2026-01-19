-- Brand Permissions: Per-brand configuration for staff permissions
-- Each brand can configure which permissions staff have

CREATE TABLE IF NOT EXISTS brand_permissions (
    brand_id UUID PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
    
    -- Staff permission settings
    staff_can_view_cost_price BOOLEAN DEFAULT FALSE,      -- Giá vốn
    staff_can_view_purchase_price BOOLEAN DEFAULT FALSE,  -- Giá nhập
    staff_can_edit_selling_price BOOLEAN DEFAULT FALSE,   -- Sửa giá bán
    staff_can_edit_purchase_price BOOLEAN DEFAULT FALSE,  -- Sửa giá nhập
    staff_can_delete_products BOOLEAN DEFAULT FALSE,      -- Xóa sản phẩm
    staff_can_view_reports BOOLEAN DEFAULT FALSE,         -- Xem báo cáo
    staff_can_manage_inventory BOOLEAN DEFAULT TRUE,      -- Quản lý tồn kho
    staff_can_process_orders BOOLEAN DEFAULT TRUE,        -- Xử lý đơn hàng
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE brand_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Only brand owner/admin can read/update their brand's permissions
CREATE POLICY "Brand admins can manage permissions" ON brand_permissions
    FOR ALL
    USING (
        brand_id IN (
            SELECT brand_id FROM user_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    )
    WITH CHECK (
        brand_id IN (
            SELECT brand_id FROM user_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- Staff can read their brand's permissions (to check their own permissions)
CREATE POLICY "Staff can read their brand permissions" ON brand_permissions
    FOR SELECT
    USING (
        brand_id IN (SELECT brand_id FROM user_profiles WHERE id = auth.uid())
    );

-- Create default permissions for existing brands
INSERT INTO brand_permissions (brand_id)
SELECT id FROM brands
ON CONFLICT (brand_id) DO NOTHING;

-- Function to get permission for current user
CREATE OR REPLACE FUNCTION get_brand_permission(permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role TEXT;
    v_brand_id UUID;
    v_result BOOLEAN;
BEGIN
    -- Get current user's role and brand
    SELECT role, brand_id INTO v_user_role, v_brand_id
    FROM user_profiles
    WHERE id = auth.uid();
    
    -- Admins and owners have all permissions
    IF v_user_role IN ('admin', 'owner', 'manager') THEN
        RETURN TRUE;
    END IF;
    
    -- For staff, check brand_permissions table
    EXECUTE format(
        'SELECT %I FROM brand_permissions WHERE brand_id = $1',
        'staff_' || permission_name
    ) INTO v_result
    USING v_brand_id;
    
    RETURN COALESCE(v_result, FALSE);
END;
$$;

-- Trigger to auto-create permissions for new brands
CREATE OR REPLACE FUNCTION create_brand_permissions_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO brand_permissions (brand_id)
    VALUES (NEW.id)
    ON CONFLICT (brand_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_brand_permissions ON brands;
CREATE TRIGGER trigger_create_brand_permissions
    AFTER INSERT ON brands
    FOR EACH ROW
    EXECUTE FUNCTION create_brand_permissions_trigger();
