import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ContactDetailView } from '@/components/contacts/ContactDetailView';

export const dynamic = 'force-dynamic';

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contact, error } = await supabase
    .from('contacts')
    .select(`
      *,
      company:companies (*)
    `)
    .eq('id', id)
    .single();

  if (error || !contact) {
    notFound();
  }

  // Fetch campaign participations
  const { data: campaignRecipients } = await supabase
    .from('campaign_recipients')
    .select(`
      id,
      status,
      created_at,
      campaign:campaigns (
        id,
        name,
        status
      )
    `)
    .eq('contact_id', id);

  const normalizedCampaigns = (campaignRecipients || []).map((cr: any) => ({
    id: cr.id,
    status: cr.status,
    created_at: cr.created_at,
    campaign: Array.isArray(cr.campaign) ? cr.campaign[0] : cr.campaign,
  }));

  return (
    <ContactDetailView 
      initialContact={contact} 
      campaigns={normalizedCampaigns} 
    />
  );
}
