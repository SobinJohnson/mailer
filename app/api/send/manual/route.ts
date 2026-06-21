import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { POST as processPost } from '../process/route';

/**
 * Authenticated proxy for send process.
 * The actual /api/send/process route requires CRON_SECRET (for automated calls).
 * This route lets authenticated users trigger processing from the UI directly and safely.
 */
export async function POST() {
  // Verify user is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Invoke processPost directly with a mock Request to bypass the cron secret check
    const mockRequest = new Request('http://localhost/api/send/process', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    return await processPost(mockRequest);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
