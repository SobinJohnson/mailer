import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const campaignSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  template_id: z.string().uuid().optional().nullable(),
  smtp_config_id: z.string().uuid().optional().nullable(),
  from_name: z.string().min(1, 'From Name is required'),
  from_email: z.string().email('Valid from email required'),
  reply_to: z.string().email().optional().or(z.literal('')),
  send_gap_minutes: z.number().int().min(1).default(2),
  gap_jitter_pct: z.number().int().min(0).max(100).default(20),
  scheduled_at: z.string().datetime().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  send_time: z.string().optional().nullable(),
  active_days: z.array(z.string()).default(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
  followups: z.array(z.object({
    template_id: z.string().uuid(),
    gap_days: z.number().int().min(1)
  })).default([]),
  followup_template_id: z.string().uuid().optional().nullable(),
  followup_gap_days: z.number().int().min(1).optional().nullable(),
});

export async function GET(request: Request) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10) || 0);
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50', 10) || 50);
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('campaigns')
    .select(`
      id, name, description, status, from_name, from_email, reply_to,
      send_gap_minutes, gap_jitter_pct, scheduled_at, start_date, end_date,
      send_time, active_days, followups, followup_template_id, followup_gap_days,
      template_id, smtp_config_id, weekly_plan_id, created_at, updated_at,
      template:email_templates!campaigns_template_id_fkey(name),
      smtp_config:smtp_configs(label),
      recipients:campaign_recipients(count)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, count, page, pageSize });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  
  try {
    const body = await request.json();
    const validatedData = campaignSchema.parse(body);

    const { data, error } = await supabase
      .from('campaigns')
      .insert([{ ...validatedData, status: 'draft' }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error('API Error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: error?.message || 'Unknown error' },
      { status: error?.code ? 400 : 500 }
    );
  }
}
