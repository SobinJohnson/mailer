import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Authenticated proxy for send process.
 * The actual /api/send/process route requires CRON_SECRET (for automated calls).
 * This route lets authenticated users (or the background worker) trigger processing from the UI.
 */
export async function POST() {
  // Verify user is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Forward to the actual process route with the cron secret
  const processUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/send/process`;
  
  try {
    const res = await fetch(processUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
