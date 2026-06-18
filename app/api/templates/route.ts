import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const templateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  subject: z.string().optional().nullable().or(z.literal('')),
  body_html: z.string().min(1, 'HTML body is required'),
  body_text: z.string().optional(),
  variables: z.array(z.string()).optional(),
  category: z.enum(['intro', 'follow_up', 'product', 'event']).optional().nullable(),
  attachments: z.array(z.any()).optional(),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const search = searchParams.get('search');
  const category = searchParams.get('category');
  
  let query = supabase.from('email_templates').select('*', { count: 'exact' });

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }
  
  if (category) {
    query = query.eq('category', category);
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
    const validatedData = templateSchema.parse(body);

    const { data, error } = await supabase
      .from('email_templates')
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
