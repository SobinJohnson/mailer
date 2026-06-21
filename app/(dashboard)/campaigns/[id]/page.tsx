import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CampaignDetailActions } from '@/components/campaigns/CampaignDetailActions';
import { CampaignQueueTabs } from '@/components/campaigns/CampaignQueueTabs';

export const dynamic = 'force-dynamic';

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      template:email_templates!campaigns_template_id_fkey(name),
      smtp_config:smtp_configs(label),
      recipients:campaign_recipients(
        id, status, scheduled_send, sent_at, error_message, email_snapshot,
        contact:contacts(id, first_name, last_name, email, company:companies(name))
      )
    `)
    .eq('id', id)
    .single();

  if (error || !campaign) {
    notFound();
  }

  const recipients = (campaign.recipients || []).map((r: any) => ({
    ...r,
    campaign: {
      name: campaign.name,
      from_email: campaign.from_email,
      smtp_config: campaign.smtp_config
    }
  }));
  const sent = recipients.filter((r: any) => r.status === 'sent').length;
  const failed = recipients.filter((r: any) => r.status === 'failed').length;
  const pending = recipients.filter((r: any) => r.status === 'pending' || r.status === 'queued').length;

  const groupedRecipients = recipients.reduce((acc: any, r: any) => {
    const timestamp = r.scheduled_send || r.sent_at;
    if (!timestamp) return acc;
    const dateKey = new Date(timestamp).toLocaleDateString('en-CA');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(r);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[28px] sm:text-[34px] font-semibold tracking-[-0.374px] text-foreground">{campaign.name}</h1>
            <Badge variant="outline" className={`font-normal rounded-full ${
              campaign.status === 'running' ? 'bg-primary/10 text-primary border-primary/20' :
              campaign.status === 'completed' ? 'bg-green-500/10 text-green-700 border-green-500/20' :
              'bg-muted text-muted-foreground'
            }`}>
              {campaign.status}
            </Badge>
          </div>
          <p className="text-[15px] sm:text-[17px] text-muted-foreground mt-1">
            {campaign.description || 'No description provided.'}
          </p>
        </div>
        <CampaignDetailActions campaignId={campaign.id} status={campaign.status} />
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-6">
        <div className="bg-background border border-border rounded-[18px] p-6 shadow-sm">
          <p className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Sent</p>
          <p className="text-[34px] font-semibold text-foreground tracking-[-0.374px]">{sent}</p>
        </div>
        <div className="bg-background border border-border rounded-[18px] p-6 shadow-sm">
          <p className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Pending</p>
          <p className="text-[34px] font-semibold text-foreground tracking-[-0.374px]">{pending}</p>
        </div>
        <div className="bg-background border border-border rounded-[18px] p-6 shadow-sm">
          <p className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Failed</p>
          <p className="text-[34px] font-semibold text-red-500 tracking-[-0.374px]">{failed}</p>
        </div>
      </div>

      <div className="space-y-8">
        <h2 className="text-[20px] font-semibold text-foreground">Recipient Queue</h2>
        <CampaignQueueTabs groupedRecipients={groupedRecipients} />
      </div>
    </div>
  );
}
