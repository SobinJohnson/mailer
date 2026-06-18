import { createServiceClient } from '@/lib/supabase/server';
import { CampaignWizard } from '@/components/campaigns/CampaignWizard';

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage() {
  const supabase = createServiceClient();
  
  const [templatesRes, smtpRes, companiesRes, groupsRes] = await Promise.all([
    supabase.from('email_templates').select('id, name, subject').order('name'),
    supabase.from('smtp_configs').select('id, label, from_email, from_name').order('label'),
    supabase.from('companies').select('id, name, tags, contacts(id, first_name, last_name, email, is_primary)').eq('status', 'active'),
    supabase
      .from('contact_groups')
      .select('id, name, description, color, members:contact_group_members(contact:contacts(id, first_name, last_name, email))')
      .order('name'),
  ]);

  return (
    <CampaignWizard 
      templates={templatesRes.data || []}
      smtpConfigs={smtpRes.data || []}
      companies={companiesRes.data || []}
      groups={groupsRes.data || []}
    />
  );
}
