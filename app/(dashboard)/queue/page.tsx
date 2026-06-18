import { createClient } from '@/lib/supabase/server';
import { CampaignQueueTabs } from '@/components/campaigns/CampaignQueueTabs';

export const dynamic = 'force-dynamic';

export default async function QueuePage() {
  const supabase = await createClient();
  
  const { data: queue, error } = await supabase
    .from('campaign_recipients')
    .select(`
      id, status, scheduled_send, sent_at, error_message,
      contact:contacts(first_name, last_name, email, company:companies(name)),
      campaign:campaigns(name)
    `)
    .order('scheduled_send', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('Error fetching queue:', error);
  }

  const recipients = queue || [];

  const groupedRecipients = recipients.reduce((acc: any, r: any) => {
    const timestamp = r.scheduled_send || r.sent_at;
    if (!timestamp) return acc;
    const dateKey = new Date(timestamp).toLocaleDateString('en-CA');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-page-in">
      <div>
        <h1 className="text-[28px] font-semibold text-foreground tracking-[-0.6px]">Master Queue</h1>
        <p className="text-[14px] text-muted-foreground mt-1">
          Date-wise view of all queued, sent, and failed emails.
        </p>
      </div>
      <CampaignQueueTabs groupedRecipients={groupedRecipients} />
    </div>
  );
}
