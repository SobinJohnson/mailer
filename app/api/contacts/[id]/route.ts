import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const contactSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  linkedin_url: z.string().url().optional().or(z.literal('')).nullable(),
  notes: z.string().optional().nullable(),
  company_id: z.string().uuid().optional().nullable(),
  status: z.enum(['active', 'bounced', 'unsubscribed', 'do_not_contact']).optional(),
  tags: z.array(z.string()).optional(),
  is_general_mailbox: z.boolean().optional(),
  verification_status: z.enum(['verified', 'risky', 'failed', 'unverified']).optional(),
  is_active: z.boolean().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('contacts')
    .select('id, company_id, first_name, last_name, email, designation, phone, is_primary, notes, linkedin_url, is_general_mailbox, verification_status, is_active, created_at, companies(id, name, industry, city, state, website, linkedin_url, notes, tags, status)')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const body = await request.json();
    const validatedData = contactSchema.parse(body);

    const { data, error } = await supabase
      .from('contacts')
      .update(validatedData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
