// Supabase Edge Function: sync-imap
// Runs entirely on Supabase's infrastructure — no Next.js app needs to be open.
// pg_cron calls this URL directly every 5 minutes.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { ImapFlow } from 'npm:imapflow@1';
import { simpleParser } from 'npm:mailparser@3';

function decodeJwt(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  try {
    // Auth: accept either the anon/service key (via apikey header) or a CRON_SECRET bearer token
    const authHeader = req.headers.get('authorization') ?? '';
    const apiKeyHeader = req.headers.get('apikey') ?? '';
    const cronSecret = Deno.env.get('CRON_SECRET');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const decoded = decodeJwt(bearerToken);
    const isServiceRoleJwt = decoded?.role === 'service_role';

    const isServiceKey = isServiceRoleJwt || bearerToken === supabaseServiceKey || apiKeyHeader === supabaseServiceKey;
    const isCronSecret = cronSecret && bearerToken === cronSecret;
    const isAnonKey = bearerToken === Deno.env.get('SUPABASE_ANON_KEY') ||
                     apiKeyHeader === Deno.env.get('SUPABASE_ANON_KEY');

    if (!isServiceKey && !isCronSecret && !isAnonKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase configuration' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all SMTP configs with IMAP credentials
    const { data: configs, error: configError } = await supabase
      .from('smtp_configs')
      .select('*')
      .not('imap_host', 'is', null);

    if (configError || !configs) {
      return new Response(JSON.stringify({ error: 'Failed to fetch IMAP configs' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    for (const config of configs) {
      if (!config.imap_host || !config.imap_username || !config.imap_password) continue;

      const client = new ImapFlow({
        host: config.imap_host,
        port: config.imap_port || 993,
        secure: config.imap_secure ?? true,
        auth: {
          user: config.imap_username,
          pass: config.imap_password,
        },
        logger: false,
      });

      let processed = 0;
      let matches = 0;

      try {
        await client.connect();

        const lock = await client.getMailboxLock('INBOX');
        try {
          // Fetch emails from the last 3 days to catch any missed replies
          const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
          const searchResults = await client.search({ since: threeDaysAgo });
          if (searchResults && searchResults.length > 0) {
            for await (const message of client.fetch(searchResults, { source: true, envelope: true })) {
              processed++;

              if (!message.source) continue;
              const parsed = await simpleParser(message.source) as any;

              // Detect bounces
              const fromEmail = parsed.from?.value?.[0]?.address || '';
              const fromText = parsed.from?.text || '';
              const subjectText = parsed.subject || '';
              const isSystemSender = /^(mailer-daemon|postmaster|mail-daemon|daemon|noreply|no-reply)@/i.test(fromEmail) ||
                                     /mailer-daemon|postmaster/i.test(fromText);
              const hasBounceSubject = /bounce|undeliver|delivery status|returned mail|failure notice|non-delivery/i.test(subjectText);
              let isReport = parsed.contentType?.value === 'multipart/report';
              const contentTypeHeader = parsed.headers?.get('content-type');
              if (contentTypeHeader) {
                if (typeof contentTypeHeader === 'object' && contentTypeHeader !== null) {
                  const val = contentTypeHeader.value || '';
                  const params = contentTypeHeader.params || {};
                  if (val === 'multipart/report' || params['report-type'] === 'delivery-status') {
                    isReport = true;
                  }
                } else if (typeof contentTypeHeader === 'string') {
                  if (contentTypeHeader.includes('report-type=delivery-status')) {
                    isReport = true;
                  }
                }
              }
              const isBounce = isSystemSender && (hasBounceSubject || isReport);

              const inReplyTo = parsed.inReplyTo;
              let references = parsed.references;
              if (typeof references === 'string') references = [references];

              const targetMessageIds: string[] = [];
              if (inReplyTo) targetMessageIds.push(inReplyTo);
              if (references && Array.isArray(references)) targetMessageIds.push(...references);

              // For bounces, also try scanning body for Message-ID
              let originalMessageId = null;
              if (isBounce) {
                if (targetMessageIds.length > 0) {
                  originalMessageId = targetMessageIds[0];
                } else {
                  const textContent = parsed.text || '';
                  const htmlContent = parsed.html || '';
                  const bodyToScan = textContent + '\n' + htmlContent;
                  const match = bodyToScan.match(/Message-ID:\s*(<[^>\s]+>)/i) ||
                                bodyToScan.match(/Message-Id:\s*(<[^>\s]+>)/i);
                  if (match) originalMessageId = match[1];
                }
              }

              // Build search IDs set
              const searchIds: string[] = [];
              if (originalMessageId) {
                const clean = originalMessageId.replace(/[<>]/g, '');
                searchIds.push(clean, `<${clean}>`);
              }
              targetMessageIds.forEach(id => {
                const clean = id.replace(/[<>]/g, '');
                searchIds.push(clean, `<${clean}>`);
              });

              // 1st: Match by Message-ID
              let original = null;
              if (searchIds.length > 0) {
                const { data: matchedRecipients } = await supabase
                  .from('campaign_recipients')
                  .select('id, contact_id, campaign_id')
                  .in('message_id', searchIds)
                  .limit(1);

                if (matchedRecipients && matchedRecipients.length > 0) {
                  original = matchedRecipients[0];
                }
              }

              // 2nd fallback: Match by sender email address for this SMTP config
              if (!original && fromEmail && !isBounce) {
                const { data: contacts } = await supabase
                  .from('contacts')
                  .select('id')
                  .eq('email', fromEmail);

                if (contacts && contacts.length > 0) {
                  const contactIds = contacts.map((c: any) => c.id);

                  const { data: campaignsUsingSmtp } = await supabase
                    .from('campaigns')
                    .select('id')
                    .eq('smtp_config_id', config.id);

                  if (campaignsUsingSmtp && campaignsUsingSmtp.length > 0) {
                    const campaignIds = campaignsUsingSmtp.map((c: any) => c.id);

                    const { data: fallbackRecipients } = await supabase
                      .from('campaign_recipients')
                      .select('id, contact_id, campaign_id')
                      .in('contact_id', contactIds)
                      .in('campaign_id', campaignIds)
                      .eq('status', 'sent')
                      .order('sent_at', { ascending: false })
                      .limit(1);

                    if (fallbackRecipients && fallbackRecipients.length > 0) {
                      original = fallbackRecipients[0];
                      console.log(`[sync-imap] Matched reply by email fallback for ${fromEmail}`);
                    }
                  }
                }
              }

              if (original) {
                matches++;

                if (isBounce) {
                  await supabase
                    .from('campaign_recipients')
                    .update({
                      status: 'failed',
                      error_message: `Recipient mailbox bounced: ${parsed.subject || 'Delivery failure'}`,
                    })
                    .eq('id', original.id);

                  if (original.contact_id) {
                    await supabase
                      .from('contacts')
                      .update({ verification_status: 'failed' })
                      .eq('id', original.contact_id);
                  }

                  await supabase
                    .from('send_log')
                    .update({
                      status: 'bounced',
                      smtp_response: `Bounce detected in IMAP inbox sync: ${parsed.subject}`,
                    })
                    .eq('recipient_id', original.id);
                } else {
                  const replySnapshot = {
                    message_id: parsed.messageId,
                    from: parsed.from?.text || '',
                    subject: parsed.subject,
                    body_text: parsed.text,
                    body_html: parsed.html,
                    date: parsed.date?.toISOString(),
                  };

                  const { error: updateError } = await supabase
                    .from('campaign_recipients')
                    .update({
                      status: 'replied',
                      replied_at: new Date().toISOString(),
                      reply_snapshot: replySnapshot,
                      reply_read: false,
                    })
                    .eq('id', original.id);

                  if (updateError) {
                    console.error('[sync-imap] Failed to mark as replied:', updateError);
                  } else {
                    console.log('[sync-imap] Marked as replied:', original.id);
                  }

                  if (original.contact_id) {
                    await supabase
                      .from('contacts')
                      .update({ is_active: false })
                      .eq('id', original.contact_id);
                  }

                  // Skip pending follow-ups for this contact in this campaign
                  await supabase
                    .from('campaign_recipients')
                    .update({ status: 'skipped', error_message: 'Contact replied' })
                    .eq('contact_id', original.contact_id)
                    .eq('campaign_id', original.campaign_id)
                    .in('status', ['queued', 'pending']);
                }
              }
            }
          }
        } finally {
          lock.release();
        }

        await client.logout();
        results.push({ email: config.imap_username, processed, matches, status: 'success' });
      } catch (err: any) {
        console.error(`[sync-imap] IMAP error for ${config.imap_username}:`, err);
        results.push({ email: config.imap_username, error: err.message, status: 'failed' });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[sync-imap] Unexpected error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
