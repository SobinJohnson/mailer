import { createClient } from '@/lib/supabase/server';
import { RepliesTable } from '@/components/replies/RepliesTable';

export const dynamic = 'force-dynamic';

export default async function RepliesPage() {
  const supabase = await createClient();
  
  const { data: replies, error } = await supabase
    .from('campaign_recipients')
    .select(`
      id, status, replied_at, email_snapshot, reply_snapshot,
      contact:contacts(first_name, last_name, email),
      campaign:campaigns(name)
    `)
    .eq('status', 'replied')
    .order('replied_at', { ascending: false, nullsFirst: false })
    .limit(1000);

  if (error) {
    console.error('Error fetching replies:', error);
  }

  return (
    <div className="max-w-5xl mx-auto py-4">
      <RepliesTable replies={replies || []} />
    </div>
  );
}
