import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const contactSchema = z.object({
  company_id: z.string().uuid('Invalid company ID'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional(),
  email: z.string().email('Invalid email address'),
  designation: z.string().optional(),
  phone: z.string().optional(),
  is_primary: z.boolean().optional().default(false),
  notes: z.string().optional(),
  linkedin_url: z.string().url().optional().or(z.literal('')),
  is_general_mailbox: z.boolean().optional().default(false),
  verification_status: z.enum(['verified', 'risky', 'failed', 'unverified']).optional().default('unverified'),
  is_active: z.boolean().optional().default(true),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const search = searchParams.get('search');
  const company_id = searchParams.get('company_id');
  const activeParam = searchParams.get('is_active');
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10) || 0);
  const pageSize = Math.min(200, parseInt(searchParams.get('pageSize') ?? '200', 10) || 200);
  const from = page * pageSize;
  const to = from + pageSize - 1;
  
  let query = supabase.from('contacts').select(`
    id, company_id, first_name, last_name, email, designation, phone,
    is_primary, notes, linkedin_url, is_general_mailbox,
    verification_status, is_active, created_at,
    company:companies(id, name)
  `, { count: 'exact' });

  if (search) {
    const escaped = search.replace(/[\\\"]/g, '\\$&');
    const pattern = `"%${escaped}%"`;
    query = query.or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`);
  }
  
  if (company_id) {
    query = query.eq('company_id', company_id);
  }

  if (activeParam === 'true') {
    query = query.eq('is_active', true);
  } else if (activeParam === 'false') {
    query = query.eq('is_active', false);
  }

  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, count });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  
  try {
    const body = await request.json();
    const validatedData = contactSchema.parse(body);

    const { data, error } = await supabase
      .from('contacts')
      .insert([validatedData])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return NextResponse.json({ error: 'A contact with this email already exists.' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ data }, { status: 201 });
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
