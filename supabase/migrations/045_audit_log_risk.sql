-- OPTIMIZED MIGRATION FOR LARGE TABLES / TIMEOUT ISSUES
-- Run these statements one by one if you still encounter issues.

-- 1. Add columns WITHOUT default values first (Instant operation)
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS risk_score INTEGER;

ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical'));

-- 2. Set default values for FUTURE inserts only (Instant operation)
ALTER TABLE audit_logs ALTER COLUMN risk_score SET DEFAULT 0;
ALTER TABLE audit_logs ALTER COLUMN risk_level SET DEFAULT 'low';

-- 3. Create Index (Can be skipped if table is massive and index creation times out)
CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_score ON audit_logs(risk_score DESC);
