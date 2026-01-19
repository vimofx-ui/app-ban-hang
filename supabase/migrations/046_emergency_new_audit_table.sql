-- EMERGENCY MIGRATION: Create a fresh audit logs table
-- The old table 'audit_logs' is locked/timed out. We are starting fresh.

CREATE TABLE IF NOT EXISTS audit_logs_new (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Core Fields
    action_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    
    -- Data Fields (JSONB)
    old_value JSONB,
    new_value JSONB,
    
    -- Context
    reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    
    -- Relations (Loose linking to avoid FK locks if other tables are busy, but FK is better)
    -- Using loose linking for safety in this emergency script
    user_id UUID, 
    shift_id UUID,
    order_id TEXT,
    product_id TEXT,
    
    -- NEW RISK SCORING FIELDS (The goal)
    risk_score INTEGER DEFAULT 0,
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low'
);

-- Optimize for read speed
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_created_at ON audit_logs_new(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_order_id ON audit_logs_new(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_user_id ON audit_logs_new(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_risk_score ON audit_logs_new(risk_score DESC);

-- Enable RLS (Security)
ALTER TABLE audit_logs_new ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (authenticated)
CREATE POLICY "Enable insert for authenticated users" ON audit_logs_new FOR INSERT TO authenticated WITH CHECK (true);

-- Allow viewing (adjust as needed, currently allowing authenticated)
CREATE POLICY "Enable select for authenticated users" ON audit_logs_new FOR SELECT TO authenticated USING (true);
