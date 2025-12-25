-- =============================================================================
-- GROCERY POS - DATABASE SCHEMA
-- =============================================================================
-- Run this SQL in Supabase SQL Editor to create all tables
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- USERS & ROLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, description, permissions, is_system) VALUES
('admin', 'Administrator - Full access', '["*"]', TRUE),
('staff', 'Staff - Basic POS access', '["pos.access", "products.view", "customers.view"]', TRUE)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'staff',
    role_id UUID REFERENCES roles(id),
    avatar_url TEXT,
    hourly_rate DECIMAL(10,2) DEFAULT 0,
    permissions JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CATEGORIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    sort_order INTEGER DEFAULT 0,
    exclude_from_loyalty_points BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PRODUCTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100),
    sku VARCHAR(100) UNIQUE,
    barcode VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id),
    category_ids JSONB DEFAULT '[]'::jsonb,
    brand VARCHAR(100),
    base_unit VARCHAR(50) DEFAULT 'Cái',
    purchase_price DECIMAL(15,2) DEFAULT 0,
    cost_price DECIMAL(15,2) DEFAULT 0,
    avg_cost_price DECIMAL(15,2) DEFAULT 0,
    total_cost_value DECIMAL(15,2) DEFAULT 0,
    selling_price DECIMAL(15,2) NOT NULL,
    wholesale_price DECIMAL(15,2),
    current_stock DECIMAL(15,3) DEFAULT 0,
    min_stock DECIMAL(15,3) DEFAULT 0,
    allow_negative_stock BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    weight DECIMAL(10,3),
    tax_apply BOOLEAN DEFAULT FALSE,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    product_kind VARCHAR(20) DEFAULT 'normal', -- normal, combo, unit_conversion
    combo_items JSONB DEFAULT '[]'::jsonb,
    last_sold_at TIMESTAMPTZ,
    total_sold DECIMAL(15,3) DEFAULT 0,
    exclude_from_loyalty_points BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- =============================================================================
-- PRODUCT UNITS (for unit conversion)
-- =============================================================================

CREATE TABLE IF NOT EXISTS product_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    unit_name VARCHAR(100) NOT NULL,
    conversion_rate DECIMAL(15,6) NOT NULL DEFAULT 1,
    barcode VARCHAR(100),
    selling_price DECIMAL(15,2),
    is_base_unit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_units_product ON product_units(product_id);

-- =============================================================================
-- CUSTOMERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    gender VARCHAR(10),
    points_balance INTEGER DEFAULT 0,
    total_spent DECIMAL(15,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    debt_balance DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(code);

-- =============================================================================
-- SUPPLIERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    tax_id VARCHAR(50),
    payment_terms INTEGER DEFAULT 0,
    notes TEXT,
    debt_balance DECIMAL(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SHIFTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    clock_in TIMESTAMPTZ NOT NULL,
    clock_out TIMESTAMPTZ,
    opening_cash DECIMAL(15,2) DEFAULT 0,
    opening_cash_details JSONB,
    opening_bank_balance DECIMAL(15,2) DEFAULT 0,
    closing_cash DECIMAL(15,2),
    closing_cash_details JSONB,
    closing_bank_balance DECIMAL(15,2),
    total_cash_sales DECIMAL(15,2) DEFAULT 0,
    total_card_sales DECIMAL(15,2) DEFAULT 0,
    total_transfer_sales DECIMAL(15,2) DEFAULT 0,
    total_debt_sales DECIMAL(15,2) DEFAULT 0,
    total_point_sales DECIMAL(15,2) DEFAULT 0,
    total_returns DECIMAL(15,2) DEFAULT 0,
    total_expenses DECIMAL(15,2) DEFAULT 0,
    salary_computed DECIMAL(15,2),
    salary_rate_snapshot DECIMAL(10,2),
    expected_cash DECIMAL(15,2),
    discrepancy_amount DECIMAL(15,2),
    reconciliation_status VARCHAR(20) DEFAULT 'pending',
    reconciliation_notes TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_user ON shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);

-- =============================================================================
-- ORDERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    shift_id UUID REFERENCES shifts(id),
    customer_id UUID REFERENCES customers(id),
    status VARCHAR(20) DEFAULT 'completed',
    payment_status VARCHAR(20) DEFAULT 'paid',
    subtotal DECIMAL(15,2) NOT NULL,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    points_used INTEGER DEFAULT 0,
    points_discount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(20),
    cash_received DECIMAL(15,2) DEFAULT 0,
    change_amount DECIMAL(15,2) DEFAULT 0,
    transfer_amount DECIMAL(15,2) DEFAULT 0,
    card_amount DECIMAL(15,2) DEFAULT 0,
    debt_amount DECIMAL(15,2) DEFAULT 0,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    remaining_debt DECIMAL(15,2) DEFAULT 0,
    paid_at TIMESTAMPTZ,
    original_order_id UUID REFERENCES orders(id),
    return_reason TEXT,
    notes TEXT,
    provisional_printed BOOLEAN DEFAULT FALSE,
    receipt_printed BOOLEAN DEFAULT FALSE,
    seller_id UUID REFERENCES users(id),
    seller_name VARCHAR(255),
    created_by UUID REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders(shift_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- =============================================================================
-- ORDER ITEMS
-- =============================================================================

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    unit_id UUID REFERENCES product_units(id),
    quantity DECIMAL(15,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total_price DECIMAL(15,2) NOT NULL,
    base_quantity DECIMAL(15,3),
    returned_quantity DECIMAL(15,3) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- =============================================================================
-- TRANSACTIONS (Income/Expense)
-- =============================================================================

CREATE TABLE IF NOT EXISTS transaction_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'income' or 'expense'
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number VARCHAR(50) NOT NULL,
    shift_id UUID REFERENCES shifts(id),
    category_id UUID REFERENCES transaction_categories(id),
    type VARCHAR(20) NOT NULL, -- 'income' or 'expense'
    amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(20),
    description TEXT,
    reference_type VARCHAR(50),
    reference_id UUID,
    attachment_url TEXT,
    transaction_date DATE NOT NULL,
    is_accounting BOOLEAN DEFAULT TRUE,
    target_name VARCHAR(255),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_shift ON transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);

-- =============================================================================
-- PURCHASE ORDERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number VARCHAR(50) NOT NULL UNIQUE,
    supplier_id UUID REFERENCES suppliers(id),
    status VARCHAR(20) DEFAULT 'draft',
    subtotal DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    expected_date DATE,
    received_date DATE,
    created_by UUID REFERENCES users(id),
    received_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    unit_id UUID REFERENCES product_units(id),
    quantity DECIMAL(15,3) NOT NULL,
    received_quantity DECIMAL(15,3) DEFAULT 0,
    returned_quantity DECIMAL(15,3) DEFAULT 0,
    unit_price DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- DEBT PAYMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS debt_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_type VARCHAR(20) NOT NULL, -- 'customer' or 'supplier'
    order_id UUID REFERENCES orders(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    customer_id UUID REFERENCES customers(id),
    supplier_id UUID REFERENCES suppliers(id),
    amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(20),
    debt_before DECIMAL(15,2) NOT NULL,
    debt_after DECIMAL(15,2) NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_by_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- POINT TRANSACTIONS (Loyalty)
-- =============================================================================

CREATE TABLE IF NOT EXISTS point_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    order_id UUID REFERENCES orders(id),
    points_change INTEGER NOT NULL, -- Positive = earned, Negative = used
    reason TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_point_trans_customer ON point_transactions(customer_id);

-- =============================================================================
-- STOCK HISTORY
-- =============================================================================

CREATE TABLE IF NOT EXISTS stock_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    quantity_change DECIMAL(15,3) NOT NULL,
    quantity_before DECIMAL(15,3),
    quantity_after DECIMAL(15,3),
    reason TEXT,
    reference_type VARCHAR(50), -- 'sale', 'purchase', 'adjustment', 'return'
    reference_id UUID,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_history(product_id);

-- =============================================================================
-- AUDIT LOGS (Ghost Scan, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    shift_id UUID REFERENCES shifts(id),
    order_id UUID REFERENCES orders(id),
    product_id UUID REFERENCES products(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- =============================================================================
-- REMINDERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(20) NOT NULL, -- 'shift_elapsed' or 'scheduled'
    elapsed_minutes INTEGER,
    schedule_time TIME,
    days_of_week JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    repeat_interval INTEGER,
    max_repeats INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ROW LEVEL SECURITY (Optional - Enable for multi-tenant)
-- =============================================================================

-- Uncomment below to enable RLS
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- DONE! Your database is ready.
-- =============================================================================
