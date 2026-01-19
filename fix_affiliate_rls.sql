-- Add INSERT policy for affiliates
CREATE POLICY "Users can register as affiliate" ON affiliates
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Add UPDATE policy for affiliates (for bank info)
CREATE POLICY "Users can update own affiliate profile" ON affiliates
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Verify it works by checking polices
select * from pg_policies where tablename = 'affiliates';
