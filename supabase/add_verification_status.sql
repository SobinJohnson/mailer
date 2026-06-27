-- Add verification_status to contacts table
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified' 
CHECK (verification_status IN ('verified', 'risky', 'failed', 'unverified'));
