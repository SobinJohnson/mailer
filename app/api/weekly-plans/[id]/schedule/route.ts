import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const nullableUuid = z.preprocess(
  (val) => (val === '' || val === undefined ? null : val),
  z.string().uuid().nullable()
);

const upsertSchema = z.object({
  day_of_week: z.enum(DAYS),
  group_id: nullableUuid,
  template_id: nullableUuid,
  smtp_config_id: nullableUuid,
  send_time: z.string().default('09:00'),
  send_gap_minutes: z.number().int().min(1).default(2),
  gap_jitter_pct: z.number().int().min(0).max(100).default(20),
  attachments: z.array(z.any()).default([]),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: weekly_plan_id } = await params;
  const supabase = await createClient();

  try {
    const body = await request.json();
    const values = upsertSchema.parse(body);

    const { data, error } = await supabase
      .from('daily_schedules')
      .upsert(
        { ...values, weekly_plan_id },
        { onConflict: 'weekly_plan_id,day_of_week' }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 });
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
