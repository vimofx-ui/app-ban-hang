-- =============================================================================
-- GOODS RECEIPTS TABLES - For receiving goods
-- =============================================================================
-- Run this in Supabase SQL Editor

-- 1. GOODS RECEIPTS TABLE
CREATE TABLE IF NOT EXISTS goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    receipt_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    total_amount DECIMAL(14,2) DEFAULT 0,
    notes TEXT,
    received_by UUID,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gr_brand ON goods_receipts(brand_id);
CREATE INDEX IF NOT EXISTS idx_gr_po ON goods_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_gr_status ON goods_receipts(status);

-- 2. GOODS RECEIPT ITEMS TABLE
CREATE TABLE IF NOT EXISTS goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255),
    sku VARCHAR(100),
    barcode VARCHAR(100),
    expected_qty INT NOT NULL DEFAULT 0,
    received_qty INT DEFAULT 0,
    damaged_qty INT DEFAULT 0,
    unit_price DECIMAL(14,2) DEFAULT 0,
    total_price DECIMAL(14,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gri_gr ON goods_receipt_items(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_gri_product ON goods_receipt_items(product_id);

-- 3. DISABLE RLS FOR TESTING
ALTER TABLE goods_receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items DISABLE ROW LEVEL SECURITY;

-- 4. GRANT ACCESS
GRANT ALL ON goods_receipts TO authenticated, anon;
GRANT ALL ON goods_receipt_items TO authenticated, anon;

-- 5. RECEIPT NUMBER GENERATOR
CREATE OR REPLACE FUNCTION generate_receipt_number(p_brand_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_count INT;
    v_date VARCHAR(6);
BEGIN
    v_date := TO_CHAR(NOW(), 'YYMMDD');
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM goods_receipts
    WHERE brand_id = p_brand_id
    AND DATE(created_at) = CURRENT_DATE;
    
    RETURN 'GR' || v_date || LPAD(v_count::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Verify
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('goods_receipts', 'goods_receipt_items');
