import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Authenticated proxy for IMAP sync.
 * The actual /api/sync/imap route requires CRON_SECRET (for automated calls).
 * This route lets authenticated users trigger a sync from the UI.
 */
export async function POST() {
  // Verify user is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Forward to the actual sync route with the cron secret
  const syncUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sync/imap`;
  
  const res = await fetch(syncUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
