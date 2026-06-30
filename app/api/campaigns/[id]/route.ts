import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      id, name, description, status, from_name, from_email, reply_to,
      send_gap_minutes, gap_jitter_pct, scheduled_at, start_date, end_date,
      send_time, active_days, followups, followup_template_id, followup_gap_days,
      template_id, smtp_config_id, weekly_plan_id, attachments, created_at, updated_at,
      template:email_templates!campaigns_template_id_fkey(name),
      smtp_config:smtp_configs(label),
      recipients:campaign_recipients(
        id, status, scheduled_send, sent_at, error_message,
        contact:contacts(id, first_name, last_name, email, company:companies(name))
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // First delete from send_log to clear recipient constraints
  const { error: sendLogError } = await supabase
    .from('send_log')
    .delete()
    .eq('campaign_id', id);

  if (sendLogError) {
    return NextResponse.json({ error: sendLogError.message }, { status: 500 });
  }

  // Next delete associated campaign_recipients
  const { error: recipientsError } = await supabase
    .from('campaign_recipients')
    .delete()
    .eq('campaign_id', id);

  if (recipientsError) {
    return NextResponse.json({ error: recipientsError.message }, { status: 500 });
  }

  // Finally delete the campaign
  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
