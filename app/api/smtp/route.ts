import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const smtpSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  host: z.string().min(1, 'Host is required'),
  port: z.number().int().positive(),
  secure: z.boolean(),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  from_email: z.string().email('Invalid from email'),
  from_name: z.string().optional().nullable(),
  imap_host: z.string().optional().nullable(),
  imap_port: z.number().int().optional().nullable(),
  imap_secure: z.boolean().optional().nullable(),
  imap_username: z.string().optional().nullable(),
  imap_password: z.string().optional().nullable(),
  is_default: z.boolean().optional().default(false),
  signature_html: z.string().optional().nullable(),
});

export async function GET() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('smtp_configs')
    .select('id, label, host, port, secure, username, from_email, from_name, imap_host, imap_port, imap_secure, imap_username, is_default, signature_html, created_at')
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
    const validatedData = smtpSchema.parse(body);

    // If this is set as default, unset other defaults
    if (validatedData.is_default) {
      await supabase
        .from('smtp_configs')
        .update({ is_default: false })
        .eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('smtp_configs')
      .insert([validatedData])
      .select('id, label, host, port, secure, username, from_email, from_name, imap_host, imap_port, imap_secure, imap_username, is_default, signature_html, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error('SMTP Save Error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    const message = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
    return NextResponse.json(
      { error: message || 'Unknown error' },
      { status: 500 }
    );
  }
}
