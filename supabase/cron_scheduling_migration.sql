-- Enable pg_net (for making HTTP API calls from Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Enable pg_cron (for job scheduling)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Enable RLS for security
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Create helper function to trigger sending queue
CREATE OR REPLACE FUNCTION public.trigger_cron_jobs()
RETURNS void AS $$
DECLARE
  v_app_url TEXT;
  v_cron_secret TEXT;
  v_bypass_token TEXT;
  v_headers JSONB;
BEGIN
  -- Fetch setting values
  SELECT value INTO v_app_url FROM public.system_settings WHERE key = 'app_url';
  SELECT value INTO v_cron_secret FROM public.system_settings WHERE key = 'cron_secret';
  SELECT value INTO v_bypass_token FROM public.system_settings WHERE key = 'vercel_bypass_token';
  
  IF v_app_url IS NOT NULL AND v_cron_secret IS NOT NULL THEN
    v_headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_cron_secret
    );
    
    IF v_bypass_token IS NOT NULL AND v_bypass_token <> '' THEN
      v_headers := v_headers || jsonb_build_object('x-vercel-protection-bypass', v_bypass_token);
    END IF;

    PERFORM net.http_post(
      url := v_app_url || '/api/send/process',
      headers := v_headers,
      body := '{}'::jsonb
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to trigger IMAP replies sync
CREATE OR REPLACE FUNCTION public.trigger_imap_sync()
RETURNS void AS $$
DECLARE
  v_app_url TEXT;
  v_cron_secret TEXT;
  v_bypass_token TEXT;
  v_headers JSONB;
BEGIN
  -- Fetch setting values
  SELECT value INTO v_app_url FROM public.system_settings WHERE key = 'app_url';
  SELECT value INTO v_cron_secret FROM public.system_settings WHERE key = 'cron_secret';
  SELECT value INTO v_bypass_token FROM public.system_settings WHERE key = 'vercel_bypass_token';
  
  IF v_app_url IS NOT NULL AND v_cron_secret IS NOT NULL THEN
    v_headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_cron_secret
    );
    
    IF v_bypass_token IS NOT NULL AND v_bypass_token <> '' THEN
      v_headers := v_headers || jsonb_build_object('x-vercel-protection-bypass', v_bypass_token);
    END IF;

    PERFORM net.http_post(
      url := v_app_url || '/api/sync/imap',
      headers := v_headers,
      body := '{}'::jsonb
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Setup the schedules safely by unscheduling first if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-send-queue-job') THEN
    PERFORM cron.unschedule('process-send-queue-job');
  END IF;
  
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-imap-replies-job') THEN
    PERFORM cron.unschedule('sync-imap-replies-job');
  END IF;
END $$;

-- Schedule job to run queue processor every 2 minutes
SELECT cron.schedule(
  'process-send-queue-job',
  '*/2 * * * *',
  'SELECT public.trigger_cron_jobs();'
);

-- Schedule job to sync IMAP replies every 5 minutes
SELECT cron.schedule(
  'sync-imap-replies-job',
  '*/5 * * * *',
  'SELECT public.trigger_imap_sync();'
);
