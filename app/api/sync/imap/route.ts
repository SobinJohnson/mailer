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
        const searchResults = await client.search({ since: threeDaysAgo });
        if (searchResults && searchResults.length > 0) {
          for await (const message of client.fetch(searchResults, { source: true, envelope: true })) {
            processed++;
            
            if (!message.source) continue;
            const parsed = (await simpleParser(message.source)) as any;
            
            // Check if this is a bounce (Delivery Status Notification / Undeliverable)
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

            // If it's a bounce and we don't have standard reply headers, try scanning the body text for Message-ID: <...>
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
                if (match) {
                  originalMessageId = match[1];
                }
              }
            }

            // Build a set of search IDs
            const searchIds: string[] = [];
            if (originalMessageId) {
              const clean = originalMessageId.replace(/[<>]/g, '');
              searchIds.push(clean, `<${clean}>`);
            }
            if (targetMessageIds.length > 0) {
              targetMessageIds.forEach(id => {
                const clean = id.replace(/[<>]/g, '');
                searchIds.push(clean, `<${clean}>`);
              });
            }

            let original = null;

            if (searchIds.length > 0) {
              // Check if we sent this message by Message-ID
              const { data: matchedRecipients } = await supabase
                .from('campaign_recipients')
                .select('id, contact_id, campaign_id')
                .in('message_id', searchIds)
                .eq('status', 'sent')
                .limit(1);

              if (matchedRecipients && matchedRecipients.length > 0) {
                original = matchedRecipients[0];
              }
            }

            // Fallback: If no match found by Message-ID, search by sender email address
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
                    console.log(`Matched reply by fallback email search for ${fromEmail}`);
                  }
                }
              }
            }

            if (original) {
              matches++;

                if (isBounce) {
                  // Update recipient status to 'failed' (since 'bounced' isn't allowed in constraint)
                  const { error: updateError } = await supabase
                    .from('campaign_recipients')
                    .update({ 
                      status: 'failed', 
                      error_message: `Recipient mailbox bounced: ${parsed.subject || 'Delivery failure'}`
                    })
                    .eq('id', original.id);

                  if (updateError) {
                    console.error('Failed to update recipient to failed on bounce:', updateError);
                  } else {
                    console.log('Successfully marked recipient as failed on bounce:', original.id);
                  }

                  // Update contact verification_status in contacts table to 'failed'
                  if (original.contact_id) {
                    const { error: contactError } = await supabase
                      .from('contacts')
                      .update({ verification_status: 'failed' })
                      .eq('id', original.contact_id);
                    
                    if (contactError) {
                      console.error('Failed to update contact verification_status on bounce:', contactError);
                    } else {
                      console.log('Successfully set contact verification_status to failed:', original.contact_id);
                    }
                  }

                  // Update send_log to 'bounced' (which is allowed)
                  const { error: logError } = await supabase
                    .from('send_log')
                    .update({ 
                      status: 'bounced', 
                      smtp_response: `Bounce detected in IMAP inbox sync: ${parsed.subject}` 
                    })
                    .eq('recipient_id', original.id);

                  if (logError) {
                    console.error('Failed to update send_log to bounced:', logError);
                  }
                } else {
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
                      reply_snapshot: replySnapshot,
                      reply_read: false
                    })
                    .eq('id', original.id)
                    .select();

                  if (updateError) {
                    console.error('Failed to update recipient to replied:', updateError);
                  } else {
                    console.log('Successfully updated to replied:', updateData);
                  }

                  if (original.contact_id) {
                    const { error: contactError } = await supabase
                      .from('contacts')
                      .update({ is_active: false })
                      .eq('id', original.contact_id);
                    if (contactError) {
                      console.error('Failed to set contact is_active to false on reply:', contactError);
                    } else {
                      console.log('Successfully set contact is_active to false on reply:', original.contact_id);
                    }
                  }

                  // Skip any pending follow-ups for this contact in this campaign
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
      console.error(`IMAP error for ${config.imap_username}:`, err);
      results.push({ email: config.imap_username, error: err.message, status: 'failed' });
    }
  }

  return NextResponse.json({ results });
}

export async function GET(request: Request) {
  return POST(request);
}
