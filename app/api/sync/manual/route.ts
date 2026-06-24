import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { POST as imapPost } from '../imap/route';

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

  try {
    // Invoke imapPost directly with a mock Request to bypass the cron secret check
    const mockRequest = new Request('http://localhost/api/sync/imap', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    return await imapPost(mockRequest);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
