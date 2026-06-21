import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { calculateSendTimes } from '@/lib/mailer/scheduler';

const launchSchema = z.object({
  recipientIds: z.array(z.string().uuid()),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { recipientIds } = launchSchema.parse(body);

    if (recipientIds.length === 0) {
      return NextResponse.json({ error: 'No recipients selected' }, { status: 400 });
    }

    // Get campaign details for scheduling
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('send_gap_minutes, gap_jitter_pct, status, scheduled_at, active_days, start_date, end_date, send_time, organization_id')
      .eq('id', id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.status === 'running' || campaign.status === 'completed') {
      return NextResponse.json({ error: 'Campaign is already running or completed' }, { status: 400 });
    }

    let startAt: Date;
    if (campaign.start_date) {
      // campaign.send_time might be "10:00" or "10:00:00". Safely extract HH:mm.
      const timeParts = (campaign.send_time || '09:00').split(':');
      const hourStr = timeParts[0] || '09';
      const minStr = timeParts[1] || '00';
      startAt = new Date(`${campaign.start_date}T${hourStr}:${minStr}:00+05:30`);
    } else {
      startAt = campaign.scheduled_at ? new Date(campaign.scheduled_at) : new Date();
    }

    const endAt = campaign.end_date 
      ? new Date(`${campaign.end_date}T23:59:59+05:30`) 
      : null;

    // Calculate spread out times
    const sendTimes = calculateSendTimes(
      recipientIds.length,
      startAt,
      campaign.send_gap_minutes,
      campaign.gap_jitter_pct,
      campaign.send_time,
      endAt
    );

    // Insert recipients into queue
    const inserts = recipientIds.map((contactId, i) => ({
      campaign_id: id,
      contact_id: contactId,
      organization_id: campaign.organization_id,
      status: 'queued',
      scheduled_send: sendTimes[i].toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('campaign_recipients')
      .insert(inserts);

    if (insertError) throw insertError;

    // Update campaign status
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ 
        status: 'running',
        scheduled_at: startAt.toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, count: recipientIds.length });
  } catch (error: any) {
    console.error('Launch Error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
