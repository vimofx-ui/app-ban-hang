-- =============================================================================
-- 041_add_goods_receipts.sql - Thêm bảng phiếu nhập kho
-- =============================================================================

-- Bảng phiếu nhập kho (Goods Receipts)
CREATE TABLE IF NOT EXISTS public.goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id),
    branch_id UUID REFERENCES public.branches(id),
    purchase_order_id UUID REFERENCES public.purchase_orders(id),
    supplier_id UUID REFERENCES public.suppliers(id),
    receipt_number TEXT NOT NULL,
    receipt_date TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'cancelled')),
    total_items INTEGER DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    notes TEXT,
    received_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_gr_brand ON public.goods_receipts(brand_id);
CREATE INDEX IF NOT EXISTS idx_gr_po ON public.goods_receipts(purchase_order_id);

-- Chi tiết phiếu nhập kho
CREATE TABLE IF NOT EXISTS public.goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goods_receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
    purchase_order_item_id UUID REFERENCES public.purchase_order_items(id),
    product_id UUID NOT NULL REFERENCES public.products(id),
    product_name TEXT,
    sku TEXT,
    barcode TEXT,
    expected_qty INTEGER DEFAULT 0,
    received_qty INTEGER DEFAULT 0,
    damaged_qty INTEGER DEFAULT 0,
    unit_price NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    lot_number TEXT,
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_gri_receipt ON public.goods_receipt_items(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_gri_product ON public.goods_receipt_items(product_id);

-- Thêm cột payment_status và paid_amount vào purchase_orders nếu chưa có
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid'));

ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;

-- RLS cho goods_receipts
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view goods_receipts in their brand" ON public.goods_receipts;
CREATE POLICY "Users can view goods_receipts in their brand"
    ON public.goods_receipts FOR SELECT
    USING (brand_id IN (
        SELECT brand_id FROM public.user_profiles WHERE id = auth.uid()
    ));

DROP POLICY IF EXISTS "Users can insert goods_receipts in their brand" ON public.goods_receipts;
CREATE POLICY "Users can insert goods_receipts in their brand"
    ON public.goods_receipts FOR INSERT
    WITH CHECK (brand_id IN (
        SELECT brand_id FROM public.user_profiles WHERE id = auth.uid()
    ));

DROP POLICY IF EXISTS "Users can update goods_receipts in their brand" ON public.goods_receipts;
CREATE POLICY "Users can update goods_receipts in their brand"
    ON public.goods_receipts FOR UPDATE
    USING (brand_id IN (
        SELECT brand_id FROM public.user_profiles WHERE id = auth.uid()
    ));

-- RLS cho goods_receipt_items
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage goods_receipt_items" ON public.goods_receipt_items;
CREATE POLICY "Users can manage goods_receipt_items"
    ON public.goods_receipt_items FOR ALL
    USING (
        goods_receipt_id IN (
            SELECT id FROM public.goods_receipts WHERE brand_id IN (
                SELECT brand_id FROM public.user_profiles WHERE id = auth.uid()
            )
        )
    );

-- Function tạo số phiếu nhập
DROP FUNCTION IF EXISTS public.generate_receipt_number(UUID);

CREATE OR REPLACE FUNCTION public.generate_receipt_number(p_brand_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
    v_year TEXT;
    v_month TEXT;
BEGIN
    v_year := to_char(now(), 'YY');
    v_month := to_char(now(), 'MM');
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM public.goods_receipts
    WHERE brand_id = p_brand_id
    AND created_at >= date_trunc('month', now());
    
    RETURN 'GR' || v_year || v_month || lpad(v_count::TEXT, 4, '0');
END;
$$;
