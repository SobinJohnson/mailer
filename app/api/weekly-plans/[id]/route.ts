import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['draft', 'active', 'completed']).optional(),
});

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('weekly_plans')
    .select(`
      *,
      daily_schedules(
        *,
        group:contact_groups(id, name, color, members:contact_group_members(count)),
        template:email_templates(id, name, subject),
        smtp_config:smtp_configs(id, label, from_email, from_name)
      )
    `)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const body = await request.json();
    const updates = patchSchema.parse(body);

    const { data, error } = await supabase
      .from('weekly_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues }, { status: 400 });
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase.from('weekly_plans').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
