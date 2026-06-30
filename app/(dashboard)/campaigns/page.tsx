import { createClient } from '@/lib/supabase/server';
import { CampaignTable } from '@/components/campaigns/CampaignTable';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const supabase = await createClient();
  
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select(`
      id, name, description, status, from_name, from_email, created_at,
      template_id, smtp_config_id,
      template:email_templates!campaigns_template_id_fkey(name),
      smtp_config:smtp_configs(label)
    `)
    .order('created_at', { ascending: false })
    .range(0, 49);

  if (error) {
    console.error('Error fetching campaigns:', error);
  }

  return <CampaignTable initialCampaigns={campaigns || []} />;
}
