-- Add is_general_mailbox column to contacts table
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS is_general_mailbox BOOLEAN DEFAULT false;
