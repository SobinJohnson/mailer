import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase client with the service role key.
 * Use this for server-side operations that need to bypass RLS.
 * NEVER expose this on the client side.
 */
export function createServiceClient() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

/**
 * Ensures system settings (app_url and cron_secret) are updated in the database
 * to allow pg_cron + pg_net to trigger scheduled processing.
 */
export async function ensureSystemSettings() {
  try {
    const headersList = await headers();
    const host = headersList.get('host');
    if (!host) return;

    const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
    const appUrl = `${protocol}://${host}`;
    const cronSecret = process.env.CRON_SECRET;
    const vercelBypassToken = process.env.VERCEL_BYPASS_TOKEN || process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

    if (!cronSecret) return;

    const supabase = createServiceClient();
    
    // Upsert key/value system settings
    const upserts = [
      supabase.from('system_settings').upsert({ key: 'app_url', value: appUrl }),
      supabase.from('system_settings').upsert({ key: 'cron_secret', value: cronSecret })
    ];

    if (vercelBypassToken) {
      upserts.push(
        supabase.from('system_settings').upsert({ key: 'vercel_bypass_token', value: vercelBypassToken })
      );
    }

    await Promise.all(upserts);
  } catch (err) {
    console.error('Failed to ensure system settings:', err);
  }
}
