-- =============================================================================
-- MIGRATION 038: Thêm các cột còn thiếu vào bảng customers
-- 
-- Mục đích: Sửa lỗi "Could not find the 'gender' column of 'customers'"
--           và đảm bảo tất cả các cột frontend cần đều tồn tại
-- Ngày: 2026-01-01
-- =============================================================================

-- Thêm cột gender
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS gender TEXT;

-- Thêm cột ngày sinh
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Thêm các cột thống kê nếu chưa có
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS points_balance INTEGER DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_spent NUMERIC DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS debt_balance NUMERIC DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_purchase_at TIMESTAMPTZ;

-- Thêm constraint giới tính
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'customers_gender_check'
    ) THEN
        ALTER TABLE public.customers 
        ADD CONSTRAINT customers_gender_check 
        CHECK (gender IS NULL OR gender IN ('male', 'female', 'other'));
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- BACKFILL: Cập nhật last_purchase_at cho khách hàng dựa trên đơn hàng gần nhất
UPDATE public.customers c
SET last_purchase_at = subquery.last_order
FROM (
    SELECT customer_id, MAX(created_at) as last_order
    FROM public.orders
    WHERE customer_id IS NOT NULL AND status = 'completed'
    GROUP BY customer_id
) subquery
WHERE c.id = subquery.customer_id
  AND (c.last_purchase_at IS NULL OR c.last_purchase_at < subquery.last_order);

SELECT 'Migration 038 Complete: Added gender + stats columns + backfilled last_purchase_at!' AS status;
