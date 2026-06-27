import { NextResponse } from 'next/server';
import { checkEmailReachability } from '@/lib/email-validator';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email field is required and must be a string' },
        { status: 400 }
      );
    }

    const result = await checkEmailReachability(email.trim());
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in email validation route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown server error' },
      { status: 500 }
    );
  }
}
