-- Add signature_html column to smtp_configs table
ALTER TABLE smtp_configs
ADD COLUMN IF NOT EXISTS signature_html TEXT;
