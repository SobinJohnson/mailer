import { createClient } from '@/lib/supabase/server';
import { LogsTable } from '@/components/logs/LogsTable';

export const dynamic = 'force-dynamic';

export default async function LogsPage() {
  const supabase = await createClient();
  
  const { data: logs, error } = await supabase
    .from('campaign_recipients')
    .select(`
      id, status, scheduled_send, sent_at, error_message, email_snapshot,
      contact:contacts(first_name, last_name, email),
      campaign:campaigns(name, from_email, smtp_config:smtp_configs(label))
    `)
    .in('status', ['sent', 'failed', 'replied', 'skipped'])
    .order('sent_at', { ascending: false, nullsFirst: false })
    .limit(1000);

  if (error) {
    console.error('Error fetching logs:', error);
  }

  return (
    <div className="max-w-5xl mx-auto py-4">
      <LogsTable logs={logs || []} />
    </div>
  );
}
