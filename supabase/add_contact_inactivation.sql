-- Migration to support contact inactivation on campaign reply and tracking reply read state
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS reply_read BOOLEAN DEFAULT false;
