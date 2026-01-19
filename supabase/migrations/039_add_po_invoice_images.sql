-- =============================================================================
-- MIGRATION 039: Thêm cột invoice_images vào bảng purchase_orders
-- 
-- Mục đích: Cho phép lưu trữ hình ảnh hóa đơn đính kèm đơn nhập hàng
-- Ngày: 2026-01-01
-- =============================================================================

-- Thêm cột invoice_images (array of URLs)
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS invoice_images TEXT[] DEFAULT '{}';

-- Thêm các cột cost allocation nếu chưa có
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC DEFAULT 0;

ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS import_tax NUMERIC DEFAULT 0;

ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS other_costs NUMERIC DEFAULT 0;

ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS supplier_discount NUMERIC DEFAULT 0;

-- Thêm cột cost allocation vào purchase_order_items nếu chưa có
ALTER TABLE public.purchase_order_items 
ADD COLUMN IF NOT EXISTS allocated_cost NUMERIC DEFAULT 0;

ALTER TABLE public.purchase_order_items 
ADD COLUMN IF NOT EXISTS final_unit_cost NUMERIC DEFAULT 0;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Migration 039 Complete: Added invoice_images + cost allocation columns!' AS status;
