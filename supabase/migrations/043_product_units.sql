-- =============================================================================
-- 043: PRODUCT UNITS TABLE
-- Bảng lưu đơn vị quy đổi cho sản phẩm
-- =============================================================================

-- Drop existing objects if they exist (for clean re-run)
DROP TRIGGER IF EXISTS set_product_units_timestamp ON product_units;
DROP FUNCTION IF EXISTS update_product_units_timestamp();

-- Drop policies if exist
DO $$ BEGIN
    DROP POLICY IF EXISTS "product_units_select" ON product_units;
    DROP POLICY IF EXISTS "product_units_insert" ON product_units;
    DROP POLICY IF EXISTS "product_units_update" ON product_units;
    DROP POLICY IF EXISTS "product_units_delete" ON product_units;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Create product_units table if not exists
CREATE TABLE IF NOT EXISTS product_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    unit_name VARCHAR(100) NOT NULL,
    conversion_rate NUMERIC(10, 4) NOT NULL DEFAULT 1,
    selling_price NUMERIC(15, 2) DEFAULT 0,
    cost_price NUMERIC(15, 2) DEFAULT 0,
    barcode VARCHAR(100),
    sku VARCHAR(100),
    is_base_unit BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes (only if table exists)
DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS idx_product_units_product_id ON product_units(product_id);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS idx_product_units_barcode ON product_units(barcode) WHERE barcode IS NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- RLS Policies
ALTER TABLE product_units ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (simplified)
CREATE POLICY "product_units_all" ON product_units
    FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_product_units_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_product_units_timestamp
    BEFORE UPDATE ON product_units
    FOR EACH ROW
    EXECUTE FUNCTION update_product_units_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON product_units TO authenticated;
GRANT SELECT ON product_units TO anon;
