import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const groupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  color: z.string().optional().default('#6366f1'),
  contact_ids: z.array(z.string().uuid()).default([]),
});

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('contact_groups')
    .select(`
      *,
      members:contact_group_members(
        contact:contacts(id, first_name, last_name, email, company_id,
          company:companies(name))
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
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
