import { createClient } from '@/lib/supabase/server';
import { CampaignWizard } from '@/components/campaigns/CampaignWizard';

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage() {
  const supabase = await createClient();
  
  const [templatesRes, smtpRes, companiesRes, groupsRes] = await Promise.all([
    supabase.from('email_templates').select('id, name, subject').order('name'),
    supabase.from('smtp_configs').select('id, label, from_email, from_name').order('label'),
    supabase.from('companies').select('id, name, tags, contacts(id, first_name, last_name, email, is_primary, is_active)').eq('status', 'active'),
    supabase
      .from('contact_groups')
      .select('id, name, description, color, members:contact_group_members(contact:contacts(id, first_name, last_name, email, is_active))')
      .order('name'),
  ]);

  // Map the contact groups and extract contact from single-element arrays to match interface
  const groups = (groupsRes.data || []).map((g: any) => ({
    id: g.id,
    name: g.name,
    description: g.description || undefined,
    color: g.color || '#000000',
    members: (g.members || [])
      .map((m: any) => {
        const contact = Array.isArray(m.contact) ? m.contact[0] : m.contact;
        return contact ? { contact } : null;
      })
      .filter((m: any): m is { contact: any } => m !== null),
  }));

  return (
    <CampaignWizard 
      templates={templatesRes.data || []}
      smtpConfigs={smtpRes.data || []}
      companies={companiesRes.data || []}
      groups={groups}
    />
  );
}

