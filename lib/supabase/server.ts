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
let lastRegisteredSettings: { appUrl: string; cronSecret: string } | null = null;

export async function ensureSystemSettings() {
  try {
    const headersList = await headers();
    const host = headersList.get('host');
    if (!host) return;

    const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
    const appUrl = `${protocol}://${host}`;
    const cronSecret = process.env.CRON_SECRET || '';

    // 1. In-memory cache short-circuit (fast path for warm container instances)
    if (
      lastRegisteredSettings &&
      lastRegisteredSettings.appUrl === appUrl &&
      lastRegisteredSettings.cronSecret === cronSecret
    ) {
      return;
    }

    if (!cronSecret) return;

    const vercelBypassToken = process.env.VERCEL_BYPASS_TOKEN || process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '';
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

    const supabase = createServiceClient();

    // 2. Fetch existing settings from DB (guarded check for cold starts)
    const { data: existing, error: selectError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['app_url', 'cron_secret', 'supabase_url', 'supabase_service_key', 'vercel_bypass_token']);

    if (selectError) {
      throw selectError;
    }

    const existingMap = new Map((existing || []).map((row: any) => [row.key, row.value]));

    // 3. Compare and determine which settings actually need to be updated
    const pendingUpserts: Array<{ key: string; value: string }> = [];

    const checkAndPush = (key: string, currentValue: string) => {
      if (existingMap.get(key) !== currentValue) {
        pendingUpserts.push({ key, value: currentValue });
      }
    };

    checkAndPush('app_url', appUrl);
    checkAndPush('cron_secret', cronSecret);
    checkAndPush('supabase_url', supabaseUrl);
    checkAndPush('supabase_service_key', supabaseServiceKey);
    if (vercelBypassToken) {
      checkAndPush('vercel_bypass_token', vercelBypassToken);
    }

    // 4. Run upserts ONLY for changed/missing keys
    if (pendingUpserts.length > 0) {
      const { error: upsertError } = await supabase
        .from('system_settings')
        .upsert(pendingUpserts);

      if (upsertError) {
        throw upsertError;
      }
    }

    // 5. Update in-memory cache
    lastRegisteredSettings = { appUrl, cronSecret };
  } catch (err) {
    console.error('Failed to ensure system settings:', err);
  }
}
