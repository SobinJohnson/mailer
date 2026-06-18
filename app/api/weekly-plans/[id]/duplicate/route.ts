import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch source plan with all daily schedules
  const { data: source, error: srcErr } = await supabase
    .from('weekly_plans')
    .select('*, daily_schedules(*)')
    .eq('id', id)
    .single();

  if (srcErr || !source) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

  // Compute next week's Monday
  const srcDate = new Date(source.start_date + 'T00:00:00');
  srcDate.setDate(srcDate.getDate() + 7);
  const nextStartDate = srcDate.toISOString().split('T')[0];

  // Create the new plan
  const { data: newPlan, error: planErr } = await supabase
    .from('weekly_plans')
    .insert([{ name: source.name, start_date: nextStartDate, status: 'draft' }])
    .select()
    .single();

  if (planErr || !newPlan) return NextResponse.json({ error: planErr?.message || 'Failed to create plan' }, { status: 500 });

  // Copy daily schedules
  if (source.daily_schedules?.length) {
    const copies = source.daily_schedules.map(({ id: _id, created_at: _ca, updated_at: _ua, weekly_plan_id: _wp, ...rest }: any) => ({
      ...rest,
      weekly_plan_id: newPlan.id,
    }));

    const { error: dsErr } = await supabase.from('daily_schedules').insert(copies);
    if (dsErr) return NextResponse.json({ error: dsErr.message }, { status: 500 });
  }

  return NextResponse.json({ data: newPlan }, { status: 201 });
}
