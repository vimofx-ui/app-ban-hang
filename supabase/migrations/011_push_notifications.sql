-- =============================================================================
-- PUSH NOTIFICATIONS SUPPORT
-- =============================================================================

-- 1. Table to store FCM Tokens for users (Multi-device support)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    token TEXT NOT NULL,           -- FCM Registration Token
    device_type TEXT,              -- 'android', 'ios', 'web'
    user_agent TEXT,
    
    brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, token)
);

-- 2. RLS Policies
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own subscriptions"
ON public.push_subscriptions
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3. Notifications Table (For In-App history)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    body TEXT,
    data JSONB,            -- Extra data like { order_id: '...' }
    type TEXT,             -- 'order_created', 'stock_low', 'system'
    
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast retrieval
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(recipient_id) WHERE is_read = FALSE;

-- RLS for Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications"
ON public.notifications FOR SELECT
USING (recipient_id = auth.uid());

CREATE POLICY "System/Owners can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (
    -- Allow users to create notifications for themselves or others in same brand if owner
    auth.uid() = recipient_id OR 
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
);

CREATE POLICY "Users can update their own notifications (mark as read)"
ON public.notifications FOR UPDATE
USING (recipient_id = auth.uid());
