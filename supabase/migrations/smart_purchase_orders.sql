-- =============================================================================
-- SMART PURCHASE ORDERS - Database Schema Migration
-- =============================================================================
-- Run this in Supabase SQL Editor

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

-- Index for brand lookup
CREATE INDEX IF NOT EXISTS idx_suppliers_brand_id ON suppliers(brand_id);

-- 2. SUPPLIER PRODUCTS (Price List per Supplier)
CREATE TABLE IF NOT EXISTS supplier_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    supplier_sku VARCHAR(100),
    last_import_price DECIMAL(14,2) NOT NULL DEFAULT 0,
    min_order_qty INT DEFAULT 1,
    lead_time_days INT DEFAULT 3,
    last_import_date DATE,
    is_preferred BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(supplier_id, product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_product ON supplier_products(product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_brand ON supplier_products(brand_id);

-- 3. PURCHASE ORDERS
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    po_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    -- Status: draft, pending, approved, ordered, delivering, partial, received, cancelled
    order_date DATE DEFAULT CURRENT_DATE,
    expected_date DATE,
    received_date DATE,
    subtotal DECIMAL(14,2) DEFAULT 0,
    discount_amount DECIMAL(14,2) DEFAULT 0,
    tax_amount DECIMAL(14,2) DEFAULT 0,
    total_amount DECIMAL(14,2) DEFAULT 0,
    paid_amount DECIMAL(14,2) DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'unpaid',
    -- Payment: unpaid, partial, paid
    notes TEXT,
    internal_notes TEXT,
    approved_by UUID REFERENCES user_profiles(id),
    approved_at TIMESTAMPTZ,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_po_brand ON purchase_orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_po_branch ON purchase_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number);

-- 4. PURCHASE ORDER ITEMS
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
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

-- Index
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product ON purchase_order_items(product_id);

-- 5. GOODS RECEIVING (Phiếu nhập kho)
CREATE TABLE IF NOT EXISTS goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    receipt_number VARCHAR(50) NOT NULL,
    receipt_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'draft',
    -- Status: draft, completed, cancelled
    total_items INT DEFAULT 0,
    total_amount DECIMAL(14,2) DEFAULT 0,
    notes TEXT,
    received_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_gr_brand ON goods_receipts(brand_id);
CREATE INDEX IF NOT EXISTS idx_gr_po ON goods_receipts(purchase_order_id);

-- 6. GOODS RECEIPT ITEMS
CREATE TABLE IF NOT EXISTS goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    purchase_order_item_id UUID REFERENCES purchase_order_items(id),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    expected_qty INT DEFAULT 0,
    received_qty INT NOT NULL DEFAULT 0,
    damaged_qty INT DEFAULT 0,
    unit_price DECIMAL(14,2) DEFAULT 0,
    total DECIMAL(14,2) DEFAULT 0,
    lot_number VARCHAR(100),
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_gri_receipt ON goods_receipt_items(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_gri_product ON goods_receipt_items(product_id);
CREATE INDEX IF NOT EXISTS idx_gri_barcode ON goods_receipt_items(barcode);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;

-- Suppliers RLS
CREATE POLICY "suppliers_brand_isolation" ON suppliers
    FOR ALL USING (brand_id = auth.jwt() ->> 'brand_id'::text);

-- Supplier Products RLS
CREATE POLICY "supplier_products_brand_isolation" ON supplier_products
    FOR ALL USING (brand_id = auth.jwt() ->> 'brand_id'::text);

-- Purchase Orders RLS
CREATE POLICY "po_brand_isolation" ON purchase_orders
    FOR ALL USING (brand_id = auth.jwt() ->> 'brand_id'::text);

-- PO Items RLS (via purchase_orders)
CREATE POLICY "po_items_access" ON purchase_order_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM purchase_orders po
            WHERE po.id = purchase_order_items.purchase_order_id
            AND po.brand_id = auth.jwt() ->> 'brand_id'::text
        )
    );

-- Goods Receipts RLS
CREATE POLICY "gr_brand_isolation" ON goods_receipts
    FOR ALL USING (brand_id = auth.jwt() ->> 'brand_id'::text);

-- GR Items RLS
CREATE POLICY "gri_access" ON goods_receipt_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM goods_receipts gr
            WHERE gr.id = goods_receipt_items.goods_receipt_id
            AND gr.brand_id = auth.jwt() ->> 'brand_id'::text
        )
    );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Generate PO Number
CREATE OR REPLACE FUNCTION generate_po_number(p_brand_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_count INT;
    v_prefix VARCHAR(10);
    v_date VARCHAR(8);
BEGIN
    v_date := TO_CHAR(NOW(), 'YYYYMMDD');
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM purchase_orders
    WHERE brand_id = p_brand_id
    AND DATE(created_at) = CURRENT_DATE;
    
    RETURN 'PO-' || v_date || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Generate Receipt Number
CREATE OR REPLACE FUNCTION generate_receipt_number(p_brand_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_count INT;
    v_date VARCHAR(8);
BEGIN
    v_date := TO_CHAR(NOW(), 'YYYYMMDD');
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM goods_receipts
    WHERE brand_id = p_brand_id
    AND DATE(created_at) = CURRENT_DATE;
    
    RETURN 'GR-' || v_date || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Update inventory after goods receipt
CREATE OR REPLACE FUNCTION update_inventory_on_receipt()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Add received quantities to inventory
        UPDATE branch_inventory bi
        SET quantity = bi.quantity + gri.received_qty,
            updated_at = NOW()
        FROM goods_receipt_items gri
        WHERE gri.goods_receipt_id = NEW.id
        AND bi.branch_id = NEW.branch_id
        AND bi.product_id = gri.product_id;
        
        -- Insert if not exists
        INSERT INTO branch_inventory (branch_id, product_id, brand_id, quantity)
        SELECT NEW.branch_id, gri.product_id, NEW.brand_id, gri.received_qty
        FROM goods_receipt_items gri
        WHERE gri.goods_receipt_id = NEW.id
        AND NOT EXISTS (
            SELECT 1 FROM branch_inventory bi
            WHERE bi.branch_id = NEW.branch_id
            AND bi.product_id = gri.product_id
        );
        
        -- Create inventory log
        INSERT INTO inventory_logs (branch_id, product_id, brand_id, change_type, quantity_change, reference_type, reference_id, notes)
        SELECT NEW.branch_id, gri.product_id, NEW.brand_id, 'import', gri.received_qty,
               'goods_receipt', NEW.id, 'Nhập kho từ phiếu ' || NEW.receipt_number
        FROM goods_receipt_items gri
        WHERE gri.goods_receipt_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for inventory update
DROP TRIGGER IF EXISTS trigger_goods_receipt_inventory ON goods_receipts;
CREATE TRIGGER trigger_goods_receipt_inventory
    AFTER UPDATE ON goods_receipts
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_on_receipt();

-- =============================================================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================================================

-- You can insert sample suppliers after running this migration
-- Example:
-- INSERT INTO suppliers (brand_id, name, phone, email) 
-- VALUES ('your-brand-id', 'NCC ABC', '0909123456', 'abc@supplier.com');
