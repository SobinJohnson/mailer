import { NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export const maxDuration = 300; // 5 minutes max duration for this endpoint

export async function POST(request: Request) {
  // Validate cron secret to prevent unauthorized IMAP access
  const authHeader = request.headers.get('authorization');
  let isAuthorized = false;
  let orgIds: string[] = [];

  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    isAuthorized = true;
  } else {
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (user) {
      isAuthorized = true;
      const { data: orgs } = await supabaseAuth.from('organizations').select('id');
      if (orgs) {
        orgIds = orgs.map(o => o.id);
      }
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // If user-authenticated but has no organizations, return empty results
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && orgIds.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const supabase = createServiceClient();

  // Get all active SMTP configs with IMAP credentials
  let query = supabase
    .from('smtp_configs')
    .select('*')
    .not('imap_host', 'is', null);

  if (orgIds.length > 0) {
    query = query.in('organization_id', orgIds);
  }

  const { data: configs, error: configError } = await query;

  if (configError || !configs) {
    return NextResponse.json({ error: 'Failed to fetch IMAP configs' }, { status: 500 });
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
        pass: config.imap_password
      },
      logger: false
    });

    let processed = 0;
    let matches = 0;

    try {
      await client.connect();
      
      const lock = await client.getMailboxLock('INBOX');
      try {
        // Fetch emails from the last 3 days to ensure we don't miss read replies
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        for await (const message of client.fetch({ since: threeDaysAgo }, { source: true, envelope: true })) {
          processed++;
          
          if (!message.source) continue;
          const parsed = (await simpleParser(message.source)) as any;
          const inReplyTo = parsed.inReplyTo;
          let references = parsed.references;
          
          if (typeof references === 'string') references = [references];
          
          const targetMessageIds = [];
          if (inReplyTo) targetMessageIds.push(inReplyTo);
          if (references && Array.isArray(references)) targetMessageIds.push(...references);

          if (targetMessageIds.length > 0) {
            // Include both with and without brackets to ensure matching
            const searchIds = targetMessageIds.flatMap(id => {
              const clean = id.replace(/[<>]/g, '');
              return [clean, `<${clean}>`];
            });
            
            // Check if we sent this
            const { data: matchedRecipients } = await supabase
              .from('campaign_recipients')
              .select('id, contact_id, campaign_id')
              .in('message_id', searchIds)
              .limit(1);

            if (matchedRecipients && matchedRecipients.length > 0) {
              matches++;
              const original = matchedRecipients[0];

              // Mark the original email as replied
              const replySnapshot = {
                message_id: parsed.messageId,
                from: parsed.from?.text || '',
                subject: parsed.subject,
                body_text: parsed.text,
                body_html: parsed.html,
                date: parsed.date?.toISOString(),
              };

              const { data: updateData, error: updateError } = await supabase
                .from('campaign_recipients')
                .update({ 
                  status: 'replied', 
                  replied_at: new Date().toISOString(),
                  reply_snapshot: replySnapshot
                })
                .eq('id', original.id)
                .select();

              if (updateError) {
                console.error('Failed to update recipient to replied:', updateError);
              } else {
                console.log('Successfully updated to replied:', updateData);
              }

              // Skip any pending follow-ups for this contact in this campaign
              await supabase
                .from('campaign_recipients')
                .update({ status: 'skipped', error_message: 'Contact replied' })
                .eq('contact_id', original.contact_id)
                .eq('campaign_id', original.campaign_id)
                .in('status', ['queued', 'pending']);
                
              // NOTE: If you want to notify the user, you can insert a row into a `notifications` table here
            }
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
      results.push({ email: config.imap_username, processed, matches, status: 'success' });
    } catch (err: any) {
      console.error(`IMAP error for ${config.imap_username}:`, err);
      results.push({ email: config.imap_username, error: err.message, status: 'failed' });
    }
  }

  return NextResponse.json({ results });
}
