import { neon } from '@neondatabase/serverless'

// Neon connection string from wrangler.jsonc
const DATABASE_URL = "postgresql://neondb_owner:npg_sabPi8G2kYDB@ep-royal-bonus-a1rbqyjs-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

const sql = neon(DATABASE_URL)

async function runMigration() {
    console.log('Starting database migration...')

    try {
        // Enable UUID extension
        await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`
        console.log('✓ UUID extension enabled')

        // Create roles table
        await sql`
            CREATE TABLE IF NOT EXISTS roles (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                permissions JSONB DEFAULT '[]'::jsonb,
                is_system BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `
        console.log('✓ Created roles table')

        // Create user_profiles table
        await sql`
            CREATE TABLE IF NOT EXISTS user_profiles (
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
            )
        `
        console.log('✓ Created user_profiles table')

        // Create categories table
        await sql`
            CREATE TABLE IF NOT EXISTS categories (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                parent_id UUID REFERENCES categories(id),
                sort_order INTEGER DEFAULT 0,
                exclude_from_loyalty_points BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `
        console.log('✓ Created categories table')

        // Create products table
        await sql`
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
                product_kind VARCHAR(20) DEFAULT 'normal',
                combo_items JSONB DEFAULT '[]'::jsonb,
                last_sold_at TIMESTAMPTZ,
                total_sold DECIMAL(15,3) DEFAULT 0,
                exclude_from_loyalty_points BOOLEAN DEFAULT FALSE,
                created_by UUID REFERENCES user_profiles(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `
        console.log('✓ Created products table')

        // Create customers table
        await sql`
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
            )
        `
        console.log('✓ Created customers table')

        // Create suppliers table
        await sql`
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
            )
        `
        console.log('✓ Created suppliers table')

        // Create shifts table
        await sql`
            CREATE TABLE IF NOT EXISTS shifts (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES user_profiles(id),
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
            )
        `
        console.log('✓ Created shifts table')

        // Create orders table
        await sql`
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
                seller_id UUID REFERENCES user_profiles(id),
                seller_name VARCHAR(255),
                created_by UUID REFERENCES user_profiles(id),
                completed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `
        console.log('✓ Created orders table')

        // Create order_items table
        await sql`
            CREATE TABLE IF NOT EXISTS order_items (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                product_id UUID NOT NULL REFERENCES products(id),
                unit_id UUID,
                quantity DECIMAL(15,3) NOT NULL,
                unit_price DECIMAL(15,2) NOT NULL,
                discount_amount DECIMAL(15,2) DEFAULT 0,
                total_price DECIMAL(15,2) NOT NULL,
                base_quantity DECIMAL(15,3),
                returned_quantity DECIMAL(15,3) DEFAULT 0,
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `
        console.log('✓ Created order_items table')

        // Create audit_logs table
        await sql`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES user_profiles(id),
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
            )
        `
        console.log('✓ Created audit_logs table')

        // Insert default roles
        await sql`
            INSERT INTO roles (name, description, permissions, is_system) VALUES
            ('admin', 'Administrator - Full access', '["*"]', TRUE),
            ('staff', 'Staff - Basic POS access', '["pos.access", "products.view", "customers.view"]', TRUE)
            ON CONFLICT (name) DO NOTHING
        `
        console.log('✓ Inserted default roles')

        // Insert sample product for testing
        await sql`
            INSERT INTO products (name, sku, barcode, selling_price, current_stock, base_unit) VALUES
            ('Sản phẩm Test 1', 'TEST001', '8888888888881', 25000, 100, 'Cái'),
            ('Sản phẩm Test 2', 'TEST002', '8888888888882', 35000, 50, 'Cái'),
            ('Coca Cola', 'COCA001', '5449000000996', 12000, 200, 'Lon')
            ON CONFLICT (sku) DO NOTHING
        `
        console.log('✓ Inserted sample products')

        console.log('\n🎉 Migration completed successfully!')

    } catch (error) {
        console.error('Migration failed:', error)
        process.exit(1)
    }
}

runMigration()
