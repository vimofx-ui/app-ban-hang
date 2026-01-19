-- =============================================================================
-- AUDIT LOGS ENHANCEMENT - Multi-tenant & Automation
-- =============================================================================

-- 1. Add Brand/Branch Context to Audit Logs
-- =============================================================================
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- Index for faster filtering by brand
CREATE INDEX IF NOT EXISTS idx_audit_logs_brand ON public.audit_logs(brand_id);

-- 2. Update RLS for Audit Logs
-- =============================================================================
DROP POLICY IF EXISTS "Users can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can create audit logs" ON public.audit_logs;

CREATE POLICY "Users can view audit logs of their brand"
ON public.audit_logs FOR SELECT
USING (brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create audit logs for their brand"
ON public.audit_logs FOR INSERT
WITH CHECK (brand_id IN (SELECT brand_id FROM public.user_profiles WHERE id = auth.uid()));

-- 3. Generic Trigger Function for Auto-Logging
-- =============================================================================
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_brand_id UUID;
    v_branch_id UUID;
    v_action_type TEXT;
    v_entity_type TEXT;
    v_reason TEXT;
    v_old_data JSONB;
    v_new_data JSONB;
BEGIN
    -- Get current user context
    v_user_id := auth.uid();
    
    -- If no user (system action), try to get from record if exists, or null
    -- Attempt to get brand/branch from the record itself or user profile
    BEGIN
        SELECT brand_id, branch_id INTO v_brand_id, v_branch_id
        FROM public.user_profiles
        WHERE id = v_user_id;
    EXCEPTION WHEN OTHERS THEN
        -- If user profile lookup fails, use nulls
        v_brand_id := NULL;
        v_branch_id := NULL;
    END;

    -- If record has brand_id, prefer that (for integrity)
    IF TG_OP = 'DELETE' THEN
        IF OLD ? 'brand_id' THEN v_brand_id := OLD.brand_id; END IF;
    ELSE
        IF NEW ? 'brand_id' THEN v_brand_id := NEW.brand_id; END IF;
    END IF;

    -- Define Action and Data
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'create';
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_action_type := 'update';
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'delete';
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
    END IF;

    v_entity_type := TG_TABLE_NAME;

    -- Insert Log
    INSERT INTO public.audit_logs (
        user_id,
        brand_id,
        branch_id,
        action_type,
        entity_type,
        entity_id,
        old_value,
        new_value,
        reason
    ) VALUES (
        v_user_id,
        v_brand_id,
        v_branch_id,
        v_action_type,
        v_entity_type,
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.id 
            ELSE NEW.id 
        END,
        v_old_data,
        v_new_data,
        'Auto-logged via DB Trigger'
    );

    RETURN NULL; -- Result is ignored for AFTER triggers
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply Triggers to Critical Tables
-- =============================================================================

-- Products: Log all changes
DROP TRIGGER IF EXISTS audit_products_trigger ON public.products;
CREATE TRIGGER audit_products_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Orders: Log status changes or deletions
-- We might want to filter only specific updates to reduce noise
DROP TRIGGER IF EXISTS audit_orders_trigger ON public.orders;
CREATE TRIGGER audit_orders_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Inventories/Stock: Log adjustments
-- Note: 'inventories' table might verify name from stock_movements or similar
-- Assuming 'stock_movements' is the source of truth for stock changes
DROP TRIGGER IF EXISTS audit_stock_movements_trigger ON public.stock_movements;
CREATE TRIGGER audit_stock_movements_trigger
AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Suppliers: Log changes
DROP TRIGGER IF EXISTS audit_suppliers_trigger ON public.suppliers;
CREATE TRIGGER audit_suppliers_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
