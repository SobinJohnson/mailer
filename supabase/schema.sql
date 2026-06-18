-- ============================================================================
-- KOLDPWR Mailing System — Full Database Schema
-- Run this in the Supabase SQL Editor to create all tables
-- ============================================================================

-- ─── Companies ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  industry      TEXT,
  city          TEXT,
  state         TEXT,
  website       TEXT,
  linkedin_url  TEXT,
  notes         TEXT,
  tags          TEXT[] DEFAULT '{}',
  status        TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'do_not_contact')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── Contacts ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID REFERENCES companies(id) ON DELETE CASCADE,
  first_name    TEXT NOT NULL,
  last_name     TEXT,
  email         TEXT NOT NULL,
  designation   TEXT,
  phone         TEXT,
  is_primary    BOOLEAN DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS contacts_email_unique ON contacts(email);

-- ─── Email Templates ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  subject       TEXT NOT NULL,
  body_html     TEXT NOT NULL,
  body_text     TEXT,
  variables     JSONB DEFAULT '[]',
  category      TEXT CHECK (category IN ('intro', 'follow_up', 'product', 'event')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── SMTP Configurations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS smtp_configs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label        TEXT NOT NULL,
  host         TEXT NOT NULL,
  port         INTEGER DEFAULT 465,
  secure       BOOLEAN DEFAULT true,
  username     TEXT NOT NULL,
  password     TEXT NOT NULL,
  from_email   TEXT NOT NULL,
  from_name    TEXT,
  is_default   BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ─── Attachments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attachments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename       TEXT NOT NULL,
  storage_path   TEXT NOT NULL,
  mime_type      TEXT,
  size_bytes     INTEGER,
  uploaded_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── Campaigns ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  template_id      UUID REFERENCES email_templates(id),
  smtp_config_id   UUID REFERENCES smtp_configs(id),
  from_name        TEXT NOT NULL,
  from_email       TEXT NOT NULL,
  reply_to         TEXT,
  status           TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed')),
  send_gap_minutes INTEGER DEFAULT 15,
  gap_jitter_pct   INTEGER DEFAULT 20,
  scheduled_at     TIMESTAMPTZ,
  attachments      JSONB DEFAULT '[]',
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ─── Campaign Recipients ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id),
  company_id      UUID REFERENCES companies(id),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sent', 'failed', 'skipped')),
  scheduled_send  TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  error_message   TEXT,
  email_snapshot  JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cr_campaign_status ON campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_cr_scheduled_queued ON campaign_recipients(scheduled_send) WHERE status = 'queued';

-- ─── Send Log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS send_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id    UUID REFERENCES campaign_recipients(id),
  campaign_id     UUID REFERENCES campaigns(id),
  contact_email   TEXT,
  status          TEXT CHECK (status IN ('sent', 'failed', 'bounced')),
  smtp_response   TEXT,
  sent_at         TIMESTAMPTZ DEFAULT now()
);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Simple policy: all data accessible to authenticated users only
-- For multi-tenant, you'd add user_id FK and filter by auth.uid()

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access" ON companies FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated access" ON contacts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated access" ON email_templates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated access" ON smtp_configs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated access" ON attachments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated access" ON campaigns FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated access" ON campaign_recipients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated access" ON send_log FOR ALL USING (auth.role() = 'authenticated');

-- ─── Auto-update updated_at ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER email_templates_updated_at BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Storage Bucket ──────────────────────────────────────────────────────────
-- Run this separately or via Supabase Dashboard:
-- Create a private bucket called 'campaign-attachments'
-- Only server-side (service key) can read/write
