-- ─── Update pg_cron to call the sync-imap Edge Function ──────────────────────
-- This makes IMAP reply detection fully server-side — the Next.js app does NOT
-- need to be running for replies to be detected and recorded.
--
-- The Edge Function URL never changes (it's your Supabase project URL), so it
-- works whether you're running locally, on Vercel, or not at all.

-- Reschedule the IMAP sync job to call the Edge Function directly.
-- The function uses the service role key for auth (stored in system_settings).
DO $$
DECLARE
  v_supabase_url TEXT;
  v_service_key  TEXT;
BEGIN
  -- Read the project URL we store on every app boot (matches NEXT_PUBLIC_SUPABASE_URL)
  SELECT value INTO v_supabase_url FROM public.system_settings WHERE key = 'supabase_url';
  SELECT value INTO v_service_key  FROM public.system_settings WHERE key = 'supabase_service_key';

  -- Unschedule old job
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-imap-replies-job') THEN
    PERFORM cron.unschedule('sync-imap-replies-job');
  END IF;

  -- Only reschedule if we have the values
  IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL THEN
    PERFORM cron.schedule(
      'sync-imap-replies-job',
      '*/5 * * * *',
      format(
        $$SELECT net.http_post(
            url := %L || '/functions/v1/sync-imap',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || %L
            ),
            body := '{}'::jsonb
        );$$,
        v_supabase_url,
        v_service_key
      )
    );
    RAISE NOTICE 'sync-imap-replies-job rescheduled to Edge Function';
  ELSE
    -- Fallback: keep hitting the app URL (original behaviour)
    PERFORM cron.schedule(
      'sync-imap-replies-job',
      '*/5 * * * *',
      'SELECT public.trigger_imap_sync();'
    );
    RAISE NOTICE 'sync-imap-replies-job kept on app URL (supabase_url/service_key not yet set)';
  END IF;
END $$;
