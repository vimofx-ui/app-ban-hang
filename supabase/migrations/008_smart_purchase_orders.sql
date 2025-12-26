-- =============================================================================
-- SMART PURCHASE ORDERS - Supplier Products Mapping & Forecast Support
-- =============================================================================
-- This migration adds:
-- 1. supplier_products table for tracking supplier-product relationships and prices
-- 2. Updates to support sales forecasting for smart PO generation

-- =============================================================================
-- 1. SUPPLIER PRODUCTS MAPPING TABLE
-- =============================================================================
-- Tracks which supplier provides which products, at what price, and history

CREATE TABLE IF NOT EXISTS public.supplier_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    
    -- Pricing
    last_import_price DECIMAL(14,2) DEFAULT 0,
    avg_import_price DECIMAL(14,2) DEFAULT 0,
    min_import_price DECIMAL(14,2) DEFAULT 0,
    max_import_price DECIMAL(14,2) DEFAULT 0,
    
    -- History
    last_import_date TIMESTAMP WITH TIME ZONE,
    total_import_count INTEGER DEFAULT 0,
    total_import_quantity INTEGER DEFAULT 0,
    
    -- Metadata
    is_preferred BOOLEAN DEFAULT false,  -- Mark as preferred supplier for this product
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique supplier-product combination per brand
    UNIQUE(brand_id, supplier_id, product_id)
);

-- Enable RLS
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view supplier_products of their brand"
ON public.supplier_products FOR SELECT
USING (
    brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid())
);

CREATE POLICY "Admin/Owner can manage supplier_products"
ON public.supplier_products FOR ALL
USING (
    brand_id IN (
        SELECT brand_id FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
);

-- =============================================================================
-- 2. FUNCTION TO UPDATE SUPPLIER-PRODUCT RELATIONSHIP AFTER PO RECEIVED
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_supplier_product_on_import()
RETURNS TRIGGER AS $$
DECLARE
    v_brand_id UUID;
    v_supplier_id UUID;
    v_existing_record RECORD;
BEGIN
    -- Get brand_id and supplier_id from the purchase order
    SELECT po.brand_id, po.supplier_id 
    INTO v_brand_id, v_supplier_id
    FROM public.purchase_orders po
    WHERE po.id = NEW.purchase_order_id;
    
    -- Check if supplier_product mapping exists
    SELECT * INTO v_existing_record
    FROM public.supplier_products
    WHERE brand_id = v_brand_id 
      AND supplier_id = v_supplier_id 
      AND product_id = NEW.product_id;
    
    IF v_existing_record IS NOT NULL THEN
        -- Update existing record
        UPDATE public.supplier_products SET
            last_import_price = NEW.unit_price,
            avg_import_price = (
                (avg_import_price * total_import_count + NEW.unit_price) / (total_import_count + 1)
            ),
            min_import_price = LEAST(min_import_price, NEW.unit_price),
            max_import_price = GREATEST(max_import_price, NEW.unit_price),
            last_import_date = NOW(),
            total_import_count = total_import_count + 1,
            total_import_quantity = total_import_quantity + COALESCE(NEW.received_quantity, NEW.quantity),
            updated_at = NOW()
        WHERE id = v_existing_record.id;
    ELSE
        -- Create new record
        INSERT INTO public.supplier_products (
            brand_id, supplier_id, product_id,
            last_import_price, avg_import_price, min_import_price, max_import_price,
            last_import_date, total_import_count, total_import_quantity
        ) VALUES (
            v_brand_id, v_supplier_id, NEW.product_id,
            NEW.unit_price, NEW.unit_price, NEW.unit_price, NEW.unit_price,
            NOW(), 1, COALESCE(NEW.received_quantity, NEW.quantity)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on purchase_order_items when received
-- Note: This should be called after the PO is received, not on insert
-- We'll handle this in the application layer for more control

-- =============================================================================
-- 3. FUNCTION TO GET PRODUCTS NEEDING REORDER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_products_needing_reorder(p_brand_id UUID)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    product_sku TEXT,
    current_stock INTEGER,
    min_stock INTEGER,
    shortage INTEGER,
    suggested_supplier_id UUID,
    suggested_supplier_name TEXT,
    suggested_price DECIMAL,
    avg_daily_sales DECIMAL,
    suggested_quantity INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH product_sales AS (
        -- Calculate average daily sales for last 30 days
        SELECT 
            oi.product_id,
            COALESCE(SUM(oi.quantity)::DECIMAL / 30, 0) as avg_daily
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        WHERE o.brand_id = p_brand_id
          AND o.created_at >= NOW() - INTERVAL '30 days'
          AND o.status = 'completed'
        GROUP BY oi.product_id
    ),
    best_supplier AS (
        -- Find best supplier for each product (lowest last price)
        SELECT DISTINCT ON (sp.product_id)
            sp.product_id,
            sp.supplier_id,
            s.name as supplier_name,
            sp.last_import_price
        FROM public.supplier_products sp
        JOIN public.suppliers s ON s.id = sp.supplier_id
        WHERE sp.brand_id = p_brand_id
        ORDER BY sp.product_id, sp.last_import_price ASC
    )
    SELECT 
        p.id as product_id,
        p.name as product_name,
        p.sku as product_sku,
        COALESCE(i.quantity, 0)::INTEGER as current_stock,
        COALESCE(p.min_stock, 0)::INTEGER as min_stock,
        (COALESCE(p.min_stock, 0) - COALESCE(i.quantity, 0))::INTEGER as shortage,
        bs.supplier_id as suggested_supplier_id,
        bs.supplier_name as suggested_supplier_name,
        COALESCE(bs.last_import_price, p.cost_price) as suggested_price,
        COALESCE(ps.avg_daily, 0) as avg_daily_sales,
        -- Suggest quantity: forecast 14 days + cover shortage
        GREATEST(
            COALESCE(ps.avg_daily * 14, 0)::INTEGER + (COALESCE(p.min_stock, 0) - COALESCE(i.quantity, 0)),
            1
        )::INTEGER as suggested_quantity
    FROM public.products p
    LEFT JOIN public.inventories i ON i.product_id = p.id
    LEFT JOIN product_sales ps ON ps.product_id = p.id
    LEFT JOIN best_supplier bs ON bs.product_id = p.id
    WHERE p.brand_id = p_brand_id
      AND p.is_active = true
      AND COALESCE(i.quantity, 0) <= COALESCE(p.min_stock, 0)
    ORDER BY (COALESCE(p.min_stock, 0) - COALESCE(i.quantity, 0)) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 4. FUNCTION TO GET SUPPLIER PRICE COMPARISON
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_supplier_price_comparison(p_product_id UUID)
RETURNS TABLE (
    supplier_id UUID,
    supplier_name TEXT,
    last_import_price DECIMAL,
    avg_import_price DECIMAL,
    min_import_price DECIMAL,
    max_import_price DECIMAL,
    last_import_date TIMESTAMP WITH TIME ZONE,
    total_import_count INTEGER,
    is_preferred BOOLEAN,
    is_cheapest BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH prices AS (
        SELECT 
            sp.supplier_id,
            s.name as supplier_name,
            sp.last_import_price,
            sp.avg_import_price,
            sp.min_import_price,
            sp.max_import_price,
            sp.last_import_date,
            sp.total_import_count,
            sp.is_preferred,
            MIN(sp.last_import_price) OVER () as min_price
        FROM public.supplier_products sp
        JOIN public.suppliers s ON s.id = sp.supplier_id
        WHERE sp.product_id = p_product_id
    )
    SELECT 
        p.supplier_id,
        p.supplier_name,
        p.last_import_price,
        p.avg_import_price,
        p.min_import_price,
        p.max_import_price,
        p.last_import_date,
        p.total_import_count,
        p.is_preferred,
        (p.last_import_price = p.min_price) as is_cheapest
    FROM prices p
    ORDER BY p.last_import_price ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 5. INDEX FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_supplier_products_brand 
ON public.supplier_products(brand_id);

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier 
ON public.supplier_products(supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_products_product 
ON public.supplier_products(product_id);

CREATE INDEX IF NOT EXISTS idx_supplier_products_preferred 
ON public.supplier_products(brand_id, product_id, is_preferred) 
WHERE is_preferred = true;
