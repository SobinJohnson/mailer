import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

export async function GET(request: Request) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10) || 0);
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? '50', 10) || 50);
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('weekly_plans')
    .select(`
      id, name, start_date, status, created_at,
      daily_schedules(
        id, day_of_week, send_time,
        group:contact_groups(id, name, color),
        template:email_templates(id, name),
        smtp_config:smtp_configs(id, label)
      )
    `, { count: 'exact' })
    .order('start_date', { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count, page, pageSize });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { name, start_date } = createSchema.parse(body);

    const { data, error } = await supabase
      .from('weekly_plans')
      .insert([{ name, start_date, status: 'draft' }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 });
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
