import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const companySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  industry: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  linkedin_url: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive', 'do_not_contact']).optional(),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  
  let query = supabase.from('companies').select('*', { count: 'exact' });

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }
  
  if (status) {
    query = query.eq('status', status);
  }

  query = query.order('created_at', { ascending: false });

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
    const validatedData = companySchema.parse(body);

    const { data, error } = await supabase
      .from('companies')
      .insert([validatedData])
      .select()
      .single();

    if (error) throw error;

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
