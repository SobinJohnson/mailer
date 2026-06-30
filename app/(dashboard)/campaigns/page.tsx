import { createClient } from '@/lib/supabase/server';
import { CampaignTable } from '@/components/campaigns/CampaignTable';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    sortBy?: string;
    sortDirection?: string;
  }>;
};

export default async function CampaignsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const search = params.search || '';
  const sortBy = params.sortBy || 'created_at';
  const sortDirection = params.sortDirection === 'asc' ? 'asc' : 'desc';

  const pageSize = 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  
  let query = supabase
    .from('campaigns')
    .select(`
      id, name, description, status, from_name, from_email, created_at,
      template_id, smtp_config_id,
      template:email_templates!campaigns_template_id_fkey(name),
      smtp_config:smtp_configs(label)
    `, { count: 'exact' });

  if (search) {
    query = query.or(`name.ilike.%${search}%,status.ilike.%${search}%`);
  }

  query = query
    .order(sortBy, { ascending: sortDirection === 'asc' })
    .range(from, to);

  const { data: campaigns, count, error } = await query;

  if (error) {
    console.error('Error fetching campaigns:', error);
  }

  return (
    <CampaignTable
      initialCampaigns={campaigns || []}
      count={count || 0}
      currentPage={page}
      pageSize={pageSize}
    />
  );
}
