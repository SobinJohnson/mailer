-- ============================================================================
-- Multi-Tenant Isolation Migration
-- Run this in the Supabase SQL Editor to enable strict organization-based access
-- ============================================================================

-- 1. Add organization_id to weekly_plans and contact_groups if they don't exist
ALTER TABLE public.weekly_plans 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.contact_groups 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 2. Update existing records to have default organization_id
DO $$
DECLARE
  default_org_id UUID;
BEGIN
  SELECT id INTO default_org_id FROM public.organizations LIMIT 1;
  IF default_org_id IS NOT NULL THEN
    UPDATE public.companies SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.contacts SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.email_templates SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.smtp_configs SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.campaigns SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.campaign_recipients SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.send_log SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.weekly_plans SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.contact_groups SET organization_id = default_org_id WHERE organization_id IS NULL;
  END IF;
END $$;

-- 3. Create security helper function to get user's organization memberships
CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF uuid AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. Trigger function to automatically populate organization_id on insert
CREATE OR REPLACE FUNCTION public.set_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() LIMIT 1);
  END IF;
  
  -- If still null (e.g. during signup or setup), fallback to the default organization
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := (SELECT id FROM public.organizations LIMIT 1);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Drop triggers if they exist to prevent duplicate creation errors
DROP TRIGGER IF EXISTS set_companies_org_id ON public.companies;
DROP TRIGGER IF EXISTS set_contacts_org_id ON public.contacts;
DROP TRIGGER IF EXISTS set_templates_org_id ON public.email_templates;
DROP TRIGGER IF EXISTS set_smtp_org_id ON public.smtp_configs;
DROP TRIGGER IF EXISTS set_campaigns_org_id ON public.campaigns;
DROP TRIGGER IF EXISTS set_recipients_org_id ON public.campaign_recipients;
DROP TRIGGER IF EXISTS set_send_log_org_id ON public.send_log;
DROP TRIGGER IF EXISTS set_weekly_plans_org_id ON public.weekly_plans;
DROP TRIGGER IF EXISTS set_contact_groups_org_id ON public.contact_groups;

-- 6. Attach trigger to tables
CREATE TRIGGER set_companies_org_id BEFORE INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
CREATE TRIGGER set_contacts_org_id BEFORE INSERT ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
CREATE TRIGGER set_templates_org_id BEFORE INSERT ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
CREATE TRIGGER set_smtp_org_id BEFORE INSERT ON public.smtp_configs FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
CREATE TRIGGER set_campaigns_org_id BEFORE INSERT ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
CREATE TRIGGER set_recipients_org_id BEFORE INSERT ON public.campaign_recipients FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
CREATE TRIGGER set_send_log_org_id BEFORE INSERT ON public.send_log FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
CREATE TRIGGER set_weekly_plans_org_id BEFORE INSERT ON public.weekly_plans FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
CREATE TRIGGER set_contact_groups_org_id BEFORE INSERT ON public.contact_groups FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

-- 7. Drop old open policies if they exist
DROP POLICY IF EXISTS "Authenticated access" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated access" ON public.organization_members;
DROP POLICY IF EXISTS "Authenticated access" ON public.companies;
DROP POLICY IF EXISTS "Authenticated access" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated access" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated access" ON public.smtp_configs;
DROP POLICY IF EXISTS "Authenticated access" ON public.campaigns;
DROP POLICY IF EXISTS "Authenticated access" ON public.campaign_recipients;
DROP POLICY IF EXISTS "Authenticated access" ON public.send_log;
DROP POLICY IF EXISTS "Authenticated access" ON public.weekly_plans;
DROP POLICY IF EXISTS "Authenticated access" ON public.contact_groups;
DROP POLICY IF EXISTS "Authenticated access" ON public.daily_schedules;
DROP POLICY IF EXISTS "Authenticated access" ON public.contact_group_members;

-- Also drop other generic names just in case
DROP POLICY IF EXISTS "Tenant isolation for companies" ON public.companies;
DROP POLICY IF EXISTS "Tenant isolation for contacts" ON public.contacts;
DROP POLICY IF EXISTS "Tenant isolation for templates" ON public.email_templates;
DROP POLICY IF EXISTS "Tenant isolation for SMTP" ON public.smtp_configs;
DROP POLICY IF EXISTS "Tenant isolation for campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Tenant isolation for recipients" ON public.campaign_recipients;
DROP POLICY IF EXISTS "Tenant isolation for logs" ON public.send_log;
DROP POLICY IF EXISTS "Tenant isolation for weekly plans" ON public.weekly_plans;
DROP POLICY IF EXISTS "Tenant isolation for contact groups" ON public.contact_groups;
DROP POLICY IF EXISTS "Tenant isolation for daily_schedules" ON public.daily_schedules;
DROP POLICY IF EXISTS "Tenant isolation for contact_group_members" ON public.contact_group_members;

-- 8. Define strict RLS policies
CREATE POLICY "Users can access their organizations" ON public.organizations
  FOR ALL TO authenticated USING (id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Members can view membership details" ON public.organization_members
  FOR ALL TO authenticated USING (user_id = auth.uid() OR organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Tenant isolation for companies" ON public.companies
  FOR ALL TO authenticated USING (organization_id IN (SELECT public.get_user_organizations())) WITH CHECK (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Tenant isolation for contacts" ON public.contacts
  FOR ALL TO authenticated USING (organization_id IN (SELECT public.get_user_organizations())) WITH CHECK (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Tenant isolation for templates" ON public.email_templates
  FOR ALL TO authenticated USING (organization_id IN (SELECT public.get_user_organizations())) WITH CHECK (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Tenant isolation for SMTP" ON public.smtp_configs
  FOR ALL TO authenticated USING (organization_id IN (SELECT public.get_user_organizations())) WITH CHECK (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Tenant isolation for campaigns" ON public.campaigns
  FOR ALL TO authenticated USING (organization_id IN (SELECT public.get_user_organizations())) WITH CHECK (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Tenant isolation for recipients" ON public.campaign_recipients
  FOR ALL TO authenticated USING (organization_id IN (SELECT public.get_user_organizations())) WITH CHECK (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Tenant isolation for logs" ON public.send_log
  FOR ALL TO authenticated USING (organization_id IN (SELECT public.get_user_organizations())) WITH CHECK (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Tenant isolation for weekly plans" ON public.weekly_plans
  FOR ALL TO authenticated USING (organization_id IN (SELECT public.get_user_organizations())) WITH CHECK (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Tenant isolation for contact groups" ON public.contact_groups
  FOR ALL TO authenticated USING (organization_id IN (SELECT public.get_user_organizations())) WITH CHECK (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Tenant isolation for daily_schedules" ON public.daily_schedules
  FOR ALL TO authenticated USING (weekly_plan_id IN (SELECT id FROM public.weekly_plans));

CREATE POLICY "Tenant isolation for contact_group_members" ON public.contact_group_members
  FOR ALL TO authenticated USING (group_id IN (SELECT id FROM public.contact_groups));

-- 9. Automatic Workspace Provisioning on User Signup
-- Create a trigger function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
  org_name TEXT;
BEGIN
  -- Determine organization name from email
  org_name := COALESCE(split_part(NEW.email, '@', 1) || '''s Workspace', 'Personal Workspace');
  
  -- Create a new organization for the user
  INSERT INTO public.organizations (name)
  VALUES (org_name)
  RETURNING id INTO new_org_id;

  -- Add the user as owner of the organization
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger to auth.users (runs AFTER INSERT)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();

-- Backfill existing users who don't have an organization membership
DO $$
DECLARE
  user_rec RECORD;
  new_org_id UUID;
  org_name TEXT;
BEGIN
  FOR user_rec IN 
    SELECT id, email FROM auth.users 
    WHERE id NOT IN (SELECT user_id FROM public.organization_members)
  LOOP
    org_name := COALESCE(split_part(user_rec.email, '@', 1) || '''s Workspace', 'Personal Workspace');
    
    INSERT INTO public.organizations (name)
    VALUES (org_name)
    RETURNING id INTO new_org_id;
    
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, user_rec.id, 'owner');
  END LOOP;
END $$;

