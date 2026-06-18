import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  color: z.string().optional(),
  contact_ids: z.array(z.string().uuid()).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServiceClient();
  const { id } = await params;

  const { data, error } = await supabase
    .from('contact_groups')
    .select(`
      *,
      members:contact_group_members(
        contact:contacts(id, first_name, last_name, email, company_id,
          company:companies(name))
      )
    `)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServiceClient();
  const { id } = await params;

  try {
    const body = await request.json();
    const { contact_ids, ...groupData } = updateGroupSchema.parse(body);

    // Update group metadata
    const { data: group, error: groupError } = await supabase
      .from('contact_groups')
      .update(groupData)
      .eq('id', id)
      .select()
      .single();

    if (groupError) throw groupError;

    // If contact_ids provided, replace all members
    if (contact_ids !== undefined) {
      // Delete existing
      await supabase.from('contact_group_members').delete().eq('group_id', id);

      // Re-insert
      if (contact_ids.length > 0) {
        const members = contact_ids.map(contact_id => ({ group_id: id, contact_id }));
        const { error: membersError } = await supabase
          .from('contact_group_members')
          .insert(members);
        if (membersError) throw membersError;
      }
    }

    return NextResponse.json({ data: group });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServiceClient();
  const { id } = await params;

  const { error } = await supabase.from('contact_groups').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
