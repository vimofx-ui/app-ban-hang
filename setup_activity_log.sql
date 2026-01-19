-- Create Activity Log Table
CREATE TABLE IF NOT EXISTS order_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    user_name TEXT,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_order_activity_logs_order_id ON order_activity_logs(order_id);

-- Enable RLS
ALTER TABLE order_activity_logs ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON order_activity_logs;
CREATE POLICY "Enable read access for authenticated users" ON order_activity_logs
    FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON order_activity_logs;
CREATE POLICY "Enable insert access for authenticated users" ON order_activity_logs
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
