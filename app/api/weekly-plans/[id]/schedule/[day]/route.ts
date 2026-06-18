import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string; day: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { id, day } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from('daily_schedules')
    .delete()
    .eq('weekly_plan_id', id)
    .eq('day_of_week', day);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
