-- =============================================================================
-- SIMPLE PURCHASE ORDERS MIGRATION (Run this first!)
-- =============================================================================
-- This creates only the essential tables for purchase orders to work
-- Run in Supabase SQL Editor

-- 1. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    tax_code VARCHAR(50),
    contact_person VARCHAR(255),
    bank_account VARCHAR(100),
    bank_name VARCHAR(255),
    payment_terms VARCHAR(100) DEFAULT '30 ngày',
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_brand_id ON suppliers(brand_id);

-- 2. PURCHASE ORDERS TABLE
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    po_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    order_date DATE DEFAULT CURRENT_DATE,
    expected_date DATE,
    received_date DATE,
    subtotal DECIMAL(14,2) DEFAULT 0,
    discount_amount DECIMAL(14,2) DEFAULT 0,
    tax_amount DECIMAL(14,2) DEFAULT 0,
    total_amount DECIMAL(14,2) DEFAULT 0,
    paid_amount DECIMAL(14,2) DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'unpaid',
    notes TEXT,
    internal_notes TEXT,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_brand ON purchase_orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_po_branch ON purchase_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);

-- 3. PURCHASE ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    unit VARCHAR(50) DEFAULT 'cái',
    ordered_qty INT NOT NULL DEFAULT 0,
    received_qty INT DEFAULT 0,
    unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(14,2) DEFAULT 0,
    tax_percent DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(14,2) DEFAULT 0,
    total DECIMAL(14,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product ON purchase_order_items(product_id);

-- 4. DISABLE RLS FOR NOW (easier testing)
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items DISABLE ROW LEVEL SECURITY;

-- 5. GRANT ACCESS
GRANT ALL ON suppliers TO authenticated;
GRANT ALL ON suppliers TO anon;
GRANT ALL ON purchase_orders TO authenticated;
GRANT ALL ON purchase_orders TO anon;
GRANT ALL ON purchase_order_items TO authenticated;
GRANT ALL ON purchase_order_items TO anon;

-- 6. SIMPLE PO NUMBER GENERATOR
CREATE OR REPLACE FUNCTION generate_po_number(p_brand_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_count INT;
    v_date VARCHAR(6);
BEGIN
    v_date := TO_CHAR(NOW(), 'YYMMDD');
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM purchase_orders
    WHERE brand_id = p_brand_id
    AND DATE(created_at) = CURRENT_DATE;
    
    RETURN 'REI' || v_date || LPAD(v_count::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Done! You can now create purchase orders
