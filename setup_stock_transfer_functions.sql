-- ============================================================================
-- PHASE 11: STOCK TRANSFER FUNCTIONS
-- ============================================================================
-- Các hàm này xử lý việc chuyển kho giữa các chi nhánh
-- - ship_stock_transfer: Xuất kho từ chi nhánh nguồn
-- - complete_stock_transfer: Nhập kho vào chi nhánh đích
-- - cancel_stock_transfer: Hủy phiếu chuyển kho
-- ============================================================================

-- 1. Hàm tạo mã chuyển kho tự động
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_transfer_code(p_brand_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER;
    v_code TEXT;
BEGIN
    SELECT COUNT(*) + 1 INTO v_count
    FROM stock_transfers
    WHERE brand_id = p_brand_id;
    
    v_code := 'TF-' || LPAD(v_count::TEXT, 5, '0');
    RETURN v_code;
END;
$$;

-- 2. Xuất kho chuyển hàng (Ship Transfer)
-- Trừ tồn kho ở chi nhánh nguồn
-- ============================================================================
CREATE OR REPLACE FUNCTION ship_stock_transfer(p_transfer_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transfer RECORD;
    v_item RECORD;
BEGIN
    -- Lấy thông tin phiếu chuyển
    SELECT * INTO v_transfer FROM stock_transfers WHERE id = p_transfer_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy phiếu chuyển kho';
    END IF;
    
    IF v_transfer.status != 'pending' THEN
        RAISE EXCEPTION 'Phiếu chuyển kho không ở trạng thái chờ xử lý';
    END IF;
    
    -- Trừ tồn kho từ chi nhánh nguồn
    FOR v_item IN SELECT * FROM stock_transfer_items WHERE transfer_id = p_transfer_id LOOP
        -- Gọi hàm trừ kho đã có sẵn
        PERFORM decrement_inventory(v_transfer.from_branch_id, v_item.product_id, v_item.quantity);
        
        -- Ghi log
        INSERT INTO inventory_logs (brand_id, branch_id, product_id, type, quantity, reference_id, notes, created_by)
        VALUES (v_transfer.brand_id, v_transfer.from_branch_id, v_item.product_id, 'out', v_item.quantity, p_transfer_id, 'Xuất chuyển kho', p_user_id);
    END LOOP;
    
    -- Cập nhật trạng thái phiếu
    UPDATE stock_transfers 
    SET status = 'in_transit',
        shipped_at = NOW(),
        shipped_by = p_user_id
    WHERE id = p_transfer_id;
END;
$$;

-- 3. Hoàn tất nhận hàng (Complete Transfer)
-- Cộng tồn kho vào chi nhánh đích
-- ============================================================================
CREATE OR REPLACE FUNCTION complete_stock_transfer(p_transfer_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transfer RECORD;
    v_item RECORD;
BEGIN
    -- Lấy thông tin phiếu chuyển
    SELECT * INTO v_transfer FROM stock_transfers WHERE id = p_transfer_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy phiếu chuyển kho';
    END IF;
    
    IF v_transfer.status != 'in_transit' THEN
        RAISE EXCEPTION 'Phiếu chuyển kho không ở trạng thái đang vận chuyển';
    END IF;
    
    -- Cộng tồn kho vào chi nhánh đích (sử dụng received_quantity nếu có)
    FOR v_item IN SELECT * FROM stock_transfer_items WHERE transfer_id = p_transfer_id LOOP
        -- Số lượng nhận = received_quantity nếu đã xác nhận, không thì lấy quantity gốc
        DECLARE
            v_qty INTEGER := COALESCE(NULLIF(v_item.received_quantity, 0), v_item.quantity);
        BEGIN
            PERFORM increment_inventory(v_transfer.to_branch_id, v_item.product_id, v_qty);
            
            -- Ghi log
            INSERT INTO inventory_logs (brand_id, branch_id, product_id, type, quantity, reference_id, notes, created_by)
            VALUES (v_transfer.brand_id, v_transfer.to_branch_id, v_item.product_id, 'in', v_qty, p_transfer_id, 'Nhập từ chuyển kho', p_user_id);
        END;
    END LOOP;
    
    -- Cập nhật trạng thái phiếu
    UPDATE stock_transfers 
    SET status = 'completed',
        completed_at = NOW(),
        completed_by = p_user_id
    WHERE id = p_transfer_id;
END;
$$;

-- 4. Hủy phiếu chuyển kho (Cancel Transfer)
-- Hoàn lại tồn kho nếu đã xuất
-- ============================================================================
CREATE OR REPLACE FUNCTION cancel_stock_transfer(p_transfer_id UUID, p_user_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transfer RECORD;
    v_item RECORD;
BEGIN
    SELECT * INTO v_transfer FROM stock_transfers WHERE id = p_transfer_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy phiếu chuyển kho';
    END IF;
    
    IF v_transfer.status = 'completed' THEN
        RAISE EXCEPTION 'Không thể hủy phiếu đã hoàn tất';
    END IF;
    
    IF v_transfer.status = 'cancelled' THEN
        RAISE EXCEPTION 'Phiếu đã bị hủy';
    END IF;
    
    -- Nếu đã xuất kho (in_transit), hoàn lại tồn kho nguồn
    IF v_transfer.status = 'in_transit' THEN
        FOR v_item IN SELECT * FROM stock_transfer_items WHERE transfer_id = p_transfer_id LOOP
            PERFORM increment_inventory(v_transfer.from_branch_id, v_item.product_id, v_item.quantity);
            
            INSERT INTO inventory_logs (brand_id, branch_id, product_id, type, quantity, reference_id, notes, created_by)
            VALUES (v_transfer.brand_id, v_transfer.from_branch_id, v_item.product_id, 'in', v_item.quantity, p_transfer_id, 'Hoàn kho do hủy chuyển', p_user_id);
        END LOOP;
    END IF;
    
    -- Cập nhật trạng thái
    UPDATE stock_transfers 
    SET status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = p_user_id,
        cancel_reason = p_reason
    WHERE id = p_transfer_id;
END;
$$;

-- 5. Tạo bảng stock_transfers nếu chưa có
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_code TEXT NOT NULL,
    brand_id UUID NOT NULL,
    from_branch_id UUID NOT NULL REFERENCES branches(id),
    to_branch_id UUID NOT NULL REFERENCES branches(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    shipped_at TIMESTAMP WITH TIME ZONE,
    shipped_by UUID,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by UUID,
    cancel_reason TEXT
);

CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    received_quantity INTEGER DEFAULT 0,
    notes TEXT
);

-- RLS cho stock_transfers
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- Xóa policies cũ nếu tồn tại (để tránh lỗi "already exists")
DROP POLICY IF EXISTS "Users can view transfers of their brand" ON public.stock_transfers;
DROP POLICY IF EXISTS "Users can insert transfers" ON public.stock_transfers;
DROP POLICY IF EXISTS "Users can view transfer items" ON public.stock_transfer_items;
DROP POLICY IF EXISTS "Users can insert transfer items" ON public.stock_transfer_items;

-- Tạo lại Policies
CREATE POLICY "Users can view transfers of their brand" ON public.stock_transfers
FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can insert transfers" ON public.stock_transfers
FOR INSERT WITH CHECK (
    brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can view transfer items" ON public.stock_transfer_items
FOR SELECT USING (
    transfer_id IN (SELECT id FROM stock_transfers WHERE brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid()))
);

CREATE POLICY "Users can insert transfer items" ON public.stock_transfer_items
FOR INSERT WITH CHECK (true);

-- 6. Refresh schema
-- ============================================================================
NOTIFY pgrst, 'reload config';
