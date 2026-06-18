import { createClient } from '@/lib/supabase/server';
import { CampaignTable } from '@/components/campaigns/CampaignTable';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const supabase = await createClient();
  
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      template:email_templates!campaigns_template_id_fkey(name),
      smtp_config:smtp_configs(label)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching campaigns:', error);
  }

  return <CampaignTable initialCampaigns={campaigns || []} />;
}
