-- ============================================================
-- Mailer CRM — Database Initialization Script
-- ============================================================
-- This runs automatically when Docker first creates the database.
-- It creates the full schema matching what Supabase Cloud provides.
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Organizations ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Organization Members ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- ── Companies ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  city TEXT,
  state TEXT,
  website TEXT,
  linkedin_url TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'do_not_contact')),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Contacts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT NOT NULL,
  designation TEXT,
  phone TEXT,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  linkedin_url TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Email Templates ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables JSONB DEFAULT '[]',
  category TEXT CHECK (category IN ('intro', 'follow_up', 'product', 'event')),
  attachments JSONB DEFAULT '[]',
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SMTP Configs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.smtp_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER DEFAULT 465,
  secure BOOLEAN DEFAULT true,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  is_default BOOLEAN DEFAULT false,
  imap_host TEXT,
  imap_port INTEGER DEFAULT 993,
  imap_secure BOOLEAN DEFAULT true,
  imap_username TEXT,
  imap_password TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Attachments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Campaigns ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  template_id UUID REFERENCES public.email_templates(id),
  smtp_config_id UUID REFERENCES public.smtp_configs(id),
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  reply_to TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed')),
  send_gap_minutes INTEGER DEFAULT 15,
  gap_jitter_pct INTEGER DEFAULT 20,
  scheduled_at TIMESTAMPTZ,
  attachments JSONB DEFAULT '[]',
  active_days TEXT[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  followup_template_id UUID REFERENCES public.email_templates(id),
  followup_gap_days INTEGER DEFAULT 3,
  start_date DATE,
  end_date DATE,
  send_time TIME,
  followups JSONB DEFAULT '[]',
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Campaign Recipients ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id),
  company_id UUID REFERENCES public.companies(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sent', 'failed', 'skipped', 'replied')),
  scheduled_send TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  email_snapshot JSONB,
  message_id TEXT,
  replied_at TIMESTAMPTZ,
  reply_snapshot JSONB,
  step INTEGER DEFAULT 1,
  parent_message_id TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Send Log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES public.campaign_recipients(id),
  campaign_id UUID REFERENCES public.campaigns(id),
  contact_email TEXT,
  status TEXT CHECK (status IN ('sent', 'failed', 'bounced')),
  smtp_response TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cr_status ON public.campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_cr_scheduled ON public.campaign_recipients(scheduled_send);
CREATE INDEX IF NOT EXISTS idx_cr_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cr_message_id ON public.campaign_recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);
CREATE INDEX IF NOT EXISTS idx_send_log_campaign ON public.send_log(campaign_id);

-- ── RLS Policies (permissive for self-hosted) ───────────────
-- For self-hosted setups we enable RLS but grant full access
-- to authenticated users. Tighten these for multi-tenant prod.

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.send_log ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','organization_members','companies','contacts','email_templates','smtp_configs','attachments','campaigns','campaign_recipients','send_log']
  LOOP
    EXECUTE format('CREATE POLICY IF NOT EXISTS "Authenticated access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Insert Default Organization ─────────────────────────────
INSERT INTO public.organizations (name)
SELECT 'Default Workspace'
WHERE NOT EXISTS (SELECT 1 FROM public.organizations LIMIT 1);
