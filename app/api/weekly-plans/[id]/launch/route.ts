import { NextResponse } from 'next/server';
import { createClient, ensureSystemSettings } from '@/lib/supabase/server';
import { calculateSendTimes } from '@/lib/mailer/scheduler';

const DAY_OFFSETS: Record<string, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
  Friday: 4, Saturday: 5, Sunday: 6,
};

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  
  // Ensure system settings are updated with the current domain/secret
  await ensureSystemSettings();

  const supabase = await createClient();

  // Fetch the plan
  const { data: plan, error: planErr } = await supabase
    .from('weekly_plans')
    .select('*, daily_schedules(*)')
    .eq('id', id)
    .single();

  if (planErr || !plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  if (plan.status === 'active') return NextResponse.json({ error: 'Plan is already active' }, { status: 400 });
  if (!plan.daily_schedules?.length) return NextResponse.json({ error: 'No days configured' }, { status: 400 });

  const results: { day: string; campaign_id: string; recipients: number }[] = [];
  const errors: { day: string; error: string }[] = [];

  for (const schedule of plan.daily_schedules) {
    try {
      if (!schedule.group_id || !schedule.template_id || !schedule.smtp_config_id) {
        errors.push({ day: schedule.day_of_week, error: 'Missing group, template, or SMTP config' });
        continue;
      }

      // Fetch SMTP config for sender details
      const { data: smtp } = await supabase
        .from('smtp_configs')
        .select('from_email, from_name, label')
        .eq('id', schedule.smtp_config_id)
        .single();

      if (!smtp) {
        errors.push({ day: schedule.day_of_week, error: 'SMTP config not found' });
        continue;
      }

      // Fetch contacts in this group
      const { data: members } = await supabase
        .from('contact_group_members')
        .select('contact_id, contact:contacts(is_active)')
        .eq('group_id', schedule.group_id);

      const contactIds = members
        ? members
            .filter(m => (m as any).contact?.is_active !== false)
            .map(m => m.contact_id)
        : [];

      if (contactIds.length === 0) {
        errors.push({ day: schedule.day_of_week, error: 'Group has no active contacts' });
        continue;
      }

      // Resolve the Monday of the week containing plan.start_date
      const [yr, mo, dy] = plan.start_date.split('-').map(Number);
      const baseDate = new Date(Date.UTC(yr, mo - 1, dy));
      const day = baseDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
      const diffToMonday = day === 0 ? -6 : 1 - day;
      baseDate.setUTCDate(baseDate.getUTCDate() + diffToMonday);

      // Resolve the concrete date for this day_of_week
      const offset = DAY_OFFSETS[schedule.day_of_week] ?? 0;
      baseDate.setUTCDate(baseDate.getUTCDate() + offset);
      const targetDateStr = baseDate.toISOString().split('T')[0];

      const [hStr, mStr] = (schedule.send_time || '09:00').split(':');
      const startAt = new Date(`${targetDateStr}T${hStr || '09'}:${mStr || '00'}:00+05:30`);

      // Calculate staggered send times
      const sendTimes = calculateSendTimes(
        contactIds.length,
        startAt,
        schedule.send_gap_minutes,
        schedule.gap_jitter_pct,
        schedule.send_time,
        null
      );

      // Create a shadow campaign for this day
      const { data: campaign, error: campErr } = await supabase
        .from('campaigns')
        .insert([{
          name: `${plan.name} — ${schedule.day_of_week}`,
          template_id: schedule.template_id,
          smtp_config_id: schedule.smtp_config_id,
          from_name: smtp.from_name || smtp.label,
          from_email: smtp.from_email,
          send_gap_minutes: schedule.send_gap_minutes,
          gap_jitter_pct: schedule.gap_jitter_pct,
          send_time: schedule.send_time,
          active_days: [schedule.day_of_week],
          attachments: schedule.attachments || [],
          weekly_plan_id: id,
          status: 'running',
          scheduled_at: startAt.toISOString(),
          followups: [],
        }])
        .select()
        .single();

      if (campErr || !campaign) throw new Error(campErr?.message || 'Campaign creation failed');

      // Queue all recipients
      const inserts = contactIds.map((contactId, i) => ({
        campaign_id: campaign.id,
        contact_id: contactId,
        status: 'queued',
        scheduled_send: sendTimes[i].toISOString(),
        step: 1,
      }));

      const { error: recErr } = await supabase.from('campaign_recipients').insert(inserts);
      if (recErr) throw new Error(recErr.message);

      results.push({ day: schedule.day_of_week, campaign_id: campaign.id, recipients: contactIds.length });
    } catch (err: any) {
      errors.push({ day: schedule.day_of_week, error: err.message });
    }
  }

  // Mark plan as active
  await supabase.from('weekly_plans').update({ status: 'active' }).eq('id', id);

  return NextResponse.json({ success: true, results, errors });
}
