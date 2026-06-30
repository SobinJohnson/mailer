import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const groupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  color: z.string().optional().default('#6366f1'),
  contact_ids: z.array(z.string().uuid()).default([]),
});

export async function GET(request: Request) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10) || 0);
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50', 10) || 50);
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('contact_groups')
    .select(`
      id, name, description, color, created_at,
      members:contact_group_members(
        contact:contacts(id, first_name, last_name, email, company_id,
          company:companies(name))
      )
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
    const { contact_ids, ...groupData } = groupSchema.parse(body);

    // Create the group
    const { data: group, error: groupError } = await supabase
      .from('contact_groups')
      .insert([groupData])
      .select()
      .single();

    if (groupError) throw groupError;

    // Add members if provided
    if (contact_ids.length > 0) {
      const members = contact_ids.map(contact_id => ({
        group_id: group.id,
        contact_id,
      }));
      const { error: membersError } = await supabase
        .from('contact_group_members')
        .insert(members);
      if (membersError) throw membersError;
    }

    return NextResponse.json({ data: group }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}
