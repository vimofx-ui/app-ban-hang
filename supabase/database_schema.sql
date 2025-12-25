-- =============================================================================
-- GROCERY POS & MANAGEMENT SYSTEM - DATABASE SCHEMA
-- Designed for Supabase (PostgreSQL)
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. USERS & AUTHENTICATION (leverages Supabase Auth)
-- =============================================================================

-- User profiles extending Supabase auth.users
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    avatar_url TEXT,
    hourly_rate BIGINT DEFAULT 0, -- Mức lương theo giờ (VND)
    permissions JSONB DEFAULT '[]', -- Danh sách quyền hạn (e.g. ['view_reports', 'manage_users'])
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 2. SUPPLIERS
-- =============================================================================

CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    tax_id VARCHAR(50),
    payment_terms INTEGER DEFAULT 30, -- Days
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. PRODUCTS & INVENTORY
-- =============================================================================

-- Product categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE,
    barcode VARCHAR(100) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id),
    
    -- Base unit info
    base_unit VARCHAR(50) NOT NULL DEFAULT 'cái', -- cái, lon, gói, etc.
    
    -- Pricing (in VND - using BIGINT for large numbers)
    cost_price BIGINT DEFAULT 0,          -- Giá vốn
    selling_price BIGINT NOT NULL,         -- Giá bán lẻ
    
    -- Stock management
    current_stock DECIMAL(15,3) DEFAULT 0, -- Allow decimals for kg, lít
    min_stock DECIMAL(15,3) DEFAULT 0,     -- Alert threshold
    allow_negative_stock BOOLEAN DEFAULT TRUE, -- Cho phép bán âm kho
    
    -- Metadata
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product units (for unit conversion: Thùng -> Lốc -> Lon)
CREATE TABLE product_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    unit_name VARCHAR(50) NOT NULL,       -- Thùng, Lốc, Lon
    conversion_rate DECIMAL(15,4) NOT NULL, -- 1 Thùng = 24 Lon -> rate = 24
    barcode VARCHAR(100),                  -- Separate barcode per unit
    selling_price BIGINT,                  -- Optional: different price per unit
    is_base_unit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(product_id, unit_name)
);

-- Stock movements (for tracking inventory changes)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN (
        'sale', 'return', 'purchase', 'adjustment', 'transfer', 'damage'
    )),
    quantity DECIMAL(15,3) NOT NULL, -- Positive for IN, Negative for OUT
    unit_id UUID REFERENCES product_units(id),
    reference_type VARCHAR(50),      -- 'order', 'purchase_order', 'stock_take'
    reference_id UUID,
    notes TEXT,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 4. PURCHASE ORDERS (Stock In)
-- =============================================================================

CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'received', 'cancelled')),
    
    -- Totals
    subtotal BIGINT DEFAULT 0,
    discount_amount BIGINT DEFAULT 0,
    tax_amount BIGINT DEFAULT 0,
    total_amount BIGINT DEFAULT 0,
    
    notes TEXT,
    expected_date DATE,
    received_date TIMESTAMPTZ,
    
    created_by UUID REFERENCES user_profiles(id),
    received_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    unit_id UUID REFERENCES product_units(id),
    
    quantity DECIMAL(15,3) NOT NULL,
    received_quantity DECIMAL(15,3) DEFAULT 0,
    unit_price BIGINT NOT NULL,
    total_price BIGINT NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 5. CUSTOMERS & LOYALTY
-- =============================================================================

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255),
    address TEXT,
    
    -- Loyalty
    points_balance INTEGER DEFAULT 0,
    total_spent BIGINT DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    
    -- Debt tracking
    debt_balance BIGINT DEFAULT 0,  -- Công nợ
    
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty configuration
CREATE TABLE loyalty_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    points_per_amount BIGINT NOT NULL DEFAULT 1000, -- 1000 VND = 1 point
    points_value BIGINT NOT NULL DEFAULT 1000,       -- 1 point = 1000 VND discount
    min_points_redeem INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Points transactions
CREATE TABLE points_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    order_id UUID, -- Will reference orders table
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'adjust', 'expire')),
    points INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 6. SHIFTS & CASH MANAGEMENT
-- =============================================================================

-- Shifts (Ca làm việc)
CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id),
    
    -- Timing
    clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clock_out TIMESTAMPTZ,
    
    -- Opening cash
    opening_cash BIGINT NOT NULL DEFAULT 0,
    opening_cash_details JSONB, -- Denomination breakdown
    opening_bank_balance BIGINT DEFAULT 0, -- Tiền trong tài khoản ngân hàng đầu ca
    
    -- Closing cash (filled at end of shift)
    closing_cash BIGINT,
    closing_cash_details JSONB,
    closing_bank_balance BIGINT, -- Tiền trong tài khoản ngân hàng cuối ca
    
    -- Salary Calculation
    salary_computed BIGINT DEFAULT 0, -- Lương tạm tính cho ca này
    salary_rate_snapshot BIGINT DEFAULT 0, -- Mức lương tại thời điểm kết ca
    
    -- Calculated values (updated in real-time)
    total_cash_sales BIGINT DEFAULT 0,
    total_card_sales BIGINT DEFAULT 0,
    total_transfer_sales BIGINT DEFAULT 0,
    total_debt_sales BIGINT DEFAULT 0,
    total_returns BIGINT DEFAULT 0,
    total_expenses BIGINT DEFAULT 0,
    
    -- Reconciliation
    expected_cash BIGINT, -- opening_cash + cash_sales - expenses
    discrepancy_amount BIGINT,
    reconciliation_status VARCHAR(20) CHECK (reconciliation_status IN ('exact', 'short', 'over', 'pending')),
    reconciliation_notes TEXT,
    
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'reconciled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cash denominations reference (Mệnh giá tiền VND - without 500đ as requested)
CREATE TABLE cash_denominations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    value BIGINT NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    sort_order INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Insert VND denominations (without 500đ)
INSERT INTO cash_denominations (value, name, sort_order) VALUES
    (500000, '500.000đ', 1),
    (200000, '200.000đ', 2),
    (100000, '100.000đ', 3),
    (50000, '50.000đ', 4),
    (20000, '20.000đ', 5),
    (10000, '10.000đ', 6),
    (5000, '5.000đ', 7),
    (2000, '2.000đ', 8),
    (1000, '1.000đ', 9);

-- =============================================================================
-- 7. ORDERS (POS Transactions)
-- =============================================================================

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    shift_id UUID REFERENCES shifts(id),
    customer_id UUID REFERENCES customers(id),
    
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft',      -- Đơn tạm (parked order)
        'completed',  -- Hoàn thành
        'returned',   -- Trả hàng
        'cancelled'   -- Hủy
    )),
    
    -- Totals
    subtotal BIGINT DEFAULT 0,
    discount_amount BIGINT DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    points_used INTEGER DEFAULT 0,
    points_discount BIGINT DEFAULT 0,
    tax_amount BIGINT DEFAULT 0,
    total_amount BIGINT DEFAULT 0,
    
    -- Payment
    payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'transfer', 'card', 'debt', 'mixed')),
    cash_received BIGINT DEFAULT 0,
    change_amount BIGINT DEFAULT 0,
    transfer_amount BIGINT DEFAULT 0,
    card_amount BIGINT DEFAULT 0,
    debt_amount BIGINT DEFAULT 0,
    
    -- Returns (if this is a return order)
    original_order_id UUID REFERENCES orders(id),
    return_reason TEXT,
    
    notes TEXT,
    provisional_printed BOOLEAN DEFAULT FALSE,
    receipt_printed BOOLEAN DEFAULT FALSE,
    
    created_by UUID REFERENCES user_profiles(id),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    unit_id UUID REFERENCES product_units(id),
    
    quantity DECIMAL(15,3) NOT NULL,
    unit_price BIGINT NOT NULL,
    discount_amount BIGINT DEFAULT 0,
    total_price BIGINT NOT NULL,
    
    -- For unit conversion tracking
    base_quantity DECIMAL(15,3), -- Quantity in base unit
    
    -- For returns
    returned_quantity DECIMAL(15,3) DEFAULT 0,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 8. TRANSACTIONS (Finance)
-- =============================================================================

CREATE TABLE transaction_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO transaction_categories (name, type) VALUES
    ('Tiền điện', 'expense'),
    ('Tiền nước', 'expense'),
    ('Tiền thuê mặt bằng', 'expense'),
    ('Thanh toán nhà cung cấp', 'expense'),
    ('Lương nhân viên', 'expense'),
    ('Chi phí vận chuyển', 'expense'),
    ('Chi phí khác', 'expense'),
    ('Thu nhập khác', 'income');

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    shift_id UUID REFERENCES shifts(id),
    category_id UUID REFERENCES transaction_categories(id),
    
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    amount BIGINT NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'transfer', 'card')),
    
    description TEXT,
    reference_type VARCHAR(50), -- 'supplier_payment', 'utility', etc.
    reference_id UUID,
    
    attachment_url TEXT,
    
    created_by UUID REFERENCES user_profiles(id),
    transaction_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 9. AUDIT LOGS (Security & Anti-Fraud)
-- =============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id),
    
    action_type VARCHAR(50) NOT NULL, -- 'ghost_scan', 'price_edit', 'order_cancel', 'stock_adjust', etc.
    entity_type VARCHAR(50) NOT NULL, -- 'order_item', 'product', 'order', etc.
    entity_id UUID,
    
    -- Change details
    old_value JSONB,
    new_value JSONB,
    
    -- Context
    reason TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    
    -- For ghost scan specifically
    shift_id UUID REFERENCES shifts(id),
    order_id UUID REFERENCES orders(id),
    product_id UUID REFERENCES products(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast audit log queries
CREATE INDEX idx_audit_logs_action ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- =============================================================================
-- 10. STOCK TAKE (Kiểm kê)
-- =============================================================================

CREATE TABLE stock_takes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    notes TEXT,
    
    created_by UUID REFERENCES user_profiles(id),
    completed_by UUID REFERENCES user_profiles(id),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_take_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_take_id UUID NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    
    system_quantity DECIMAL(15,3) NOT NULL, -- Quantity in system
    counted_quantity DECIMAL(15,3),         -- Physical count
    difference DECIMAL(15,3),               -- counted - system
    
    notes TEXT,
    counted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 11. INDEXES FOR PERFORMANCE
-- =============================================================================

-- Products
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = TRUE;

-- Product units
CREATE INDEX idx_product_units_barcode ON product_units(barcode);
CREATE INDEX idx_product_units_product ON product_units(product_id);

-- Orders
CREATE INDEX idx_orders_shift ON orders(shift_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_number ON orders(order_number);

-- Order items
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- Shifts
CREATE INDEX idx_shifts_user ON shifts(user_id);
CREATE INDEX idx_shifts_status ON shifts(status);
CREATE INDEX idx_shifts_date ON shifts(clock_in DESC);

-- Customers
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_code ON customers(code);

-- Stock movements
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at DESC);

-- Transactions
CREATE INDEX idx_transactions_shift ON transactions(shift_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX idx_transactions_type ON transactions(type);

-- =============================================================================
-- 12. FUNCTIONS & TRIGGERS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    today_date TEXT;
    seq_num INTEGER;
BEGIN
    today_date := TO_CHAR(NOW(), 'YYMMDD');
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(order_number FROM 8) AS INTEGER)
    ), 0) + 1
    INTO seq_num
    FROM orders
    WHERE order_number LIKE 'HD' || today_date || '%';
    
    RETURN 'HD' || today_date || LPAD(seq_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to generate transaction number
CREATE OR REPLACE FUNCTION generate_transaction_number(trans_type TEXT)
RETURNS TEXT AS $$
DECLARE
    prefix TEXT;
    today_date TEXT;
    seq_num INTEGER;
BEGIN
    prefix := CASE WHEN trans_type = 'expense' THEN 'PC' ELSE 'PT' END; -- Phiếu Chi / Phiếu Thu
    today_date := TO_CHAR(NOW(), 'YYMMDD');
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(transaction_number FROM 9) AS INTEGER)
    ), 0) + 1
    INTO seq_num
    FROM transactions
    WHERE transaction_number LIKE prefix || today_date || '%';
    
    RETURN prefix || today_date || LPAD(seq_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to calculate shift expected cash
CREATE OR REPLACE FUNCTION calculate_shift_expected_cash(shift_uuid UUID)
RETURNS BIGINT AS $$
DECLARE
    result BIGINT;
BEGIN
    SELECT 
        COALESCE(opening_cash, 0) + 
        COALESCE(total_cash_sales, 0) - 
        COALESCE(total_expenses, 0)
    INTO result
    FROM shifts
    WHERE id = shift_uuid;
    
    RETURN COALESCE(result, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to update product stock
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE products 
        SET current_stock = current_stock + NEW.quantity,
            updated_at = NOW()
        WHERE id = NEW.product_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE products 
        SET current_stock = current_stock - OLD.quantity,
            updated_at = NOW()
        WHERE id = OLD.product_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock AFTER INSERT OR DELETE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION update_product_stock();

-- =============================================================================
-- 13. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (basic - customize as needed)
CREATE POLICY "Users can view all profiles" ON user_profiles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all products" ON products
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage products" ON products
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all orders" ON orders
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage orders" ON orders
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all customers" ON customers
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage customers" ON customers
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view their shifts" ON shifts
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage shifts" ON shifts
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view audit logs" ON audit_logs
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create audit logs" ON audit_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- =============================================================================
-- 14. SAMPLE DATA FOR DEVELOPMENT (Optional - comment out for production)
-- =============================================================================

-- Insert a default loyalty config
INSERT INTO loyalty_config (name, points_per_amount, points_value, min_points_redeem, is_active)
VALUES ('Chương trình tích điểm', 1000, 1000, 100, TRUE);

-- Insert sample categories
INSERT INTO categories (name, description, sort_order) VALUES
    ('Nước giải khát', 'Nước ngọt, nước suối, trà', 1),
    ('Sữa & Các sản phẩm từ sữa', 'Sữa tươi, sữa chua, phô mai', 2),
    ('Bánh kẹo', 'Bánh, kẹo, snack', 3),
    ('Mì gói & Thực phẩm ăn liền', 'Mì gói, cháo, phở', 4),
    ('Gia vị', 'Nước mắm, dầu ăn, bột ngọt', 5),
    ('Đồ dùng gia đình', 'Giấy, xà phòng, hóa chất', 6);
