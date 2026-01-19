-- Add extra_cost column to purchase_order_items table
ALTER TABLE purchase_order_items 
ADD COLUMN IF NOT EXISTS extra_cost numeric DEFAULT 0;

COMMENT ON COLUMN purchase_order_items.extra_cost IS 'Chi phí riêng cho từng sản phẩm (ví dụ: phí sửa chữa, phí lắp đặt riêng)';
