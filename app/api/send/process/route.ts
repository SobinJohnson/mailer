import { NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { renderTemplate } from '@/lib/mailer/renderer';
import { sendMail } from '@/lib/mailer/sender';
import { getCleanErrorMessage } from '@/lib/utils';

export async function POST(request: Request) {
  // Validate cron secret to prevent unauthorized trigger
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
    return NextResponse.json({ processed: 0 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // Atomically claim due recipients using row-level locking (FOR UPDATE SKIP LOCKED)
  const { data: claimedIds, error: claimError } = await supabase.rpc(
    'claim_queued_recipients',
    {
      limit_val: 10,
      org_ids: orgIds.length > 0 ? orgIds : null
    }
  );

  if (claimError) {
    console.error('Queue claim error:', claimError);
    return NextResponse.json({ error: 'Failed to claim sending queue' }, { status: 500 });
  }

  if (!claimedIds || claimedIds.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const recipientIds = claimedIds.map((row: any) => row.id);

  // Fetch full details of the claimed recipients
  const { data: due, error: fetchError } = await supabase
    .from('campaign_recipients')
    .select(`
      *,
      contacts(
        *,
        companies(*)
      ),
      campaigns(
        *,
        email_templates!campaigns_template_id_fkey(*),
        followup_template:email_templates!campaigns_followup_template_id_fkey(*),
        smtp_configs(*)
      )
    `)
    .in('id', recipientIds);

  if (fetchError) {
    console.error('Queue fetch error:', fetchError);
    // Reset status back to queued if we couldn't fetch details to prevent them from getting stuck in 'sending'
    await supabase.from('campaign_recipients').update({ status: 'queued' }).in('id', recipientIds);
    return NextResponse.json({ error: 'Failed to fetch queue details' }, { status: 500 });
  }


  if (!due || due.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let sent = 0, failed = 0;
  const campaignsToCheck = new Set<string>();

  // Helper function for bounded concurrency execution
  async function runWithConcurrencyLimit<T>(
    concurrencyLimit: number,
    items: T[],
    fn: (item: T) => Promise<void>
  ): Promise<void> {
    const executing = new Set<Promise<void>>();
    for (const item of items) {
      const p = Promise.resolve().then(() => fn(item));
      executing.add(p);
      const clean = () => executing.delete(p);
      p.then(clean, clean);
      if (executing.size >= concurrencyLimit) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);
  }

  // Process due emails concurrently (limit to 3 concurrent sends to respect SMTP connections)
  await runWithConcurrencyLimit(3, due, async (recipient) => {
    campaignsToCheck.add(recipient.campaign_id);
    try {
      const contact = recipient.contacts;
      const company = contact?.companies;
      const campaign = recipient.campaigns;
      
      const isFollowUp = recipient.step > 1;
      let template;

      if (!isFollowUp) {
        template = campaign.email_templates;
      } else {
        const fIndex = recipient.step - 2;
        const fConfig = campaign.followups?.[fIndex];
        if (fConfig?.template_id) {
          const { data: t } = await supabase.from('email_templates').select('*').eq('id', fConfig.template_id).single();
          template = t;
        }
      }

      if (!template) {
        throw new Error(`Missing template for step ${recipient.step}`);
      }
      
      const context = {
        first_name: contact?.first_name || '',
        last_name: contact?.last_name || '',
        company_name: company?.name || '',
        designation: contact?.designation || '',
        city: company?.city || '',
        sender_name: campaign.from_name,
        sender_email: campaign.from_email,
        signature: campaign.smtp_configs?.signature_html || '',
      };

      const subject = renderTemplate(template.subject || '', context);
      const html = renderTemplate(template.body_html || '', context);
      const text = renderTemplate(template.body_text || '', context);

      // We maintain the same root subject across the thread if possible
      const finalSubject = isFollowUp && !subject ? `Re: ${recipient.email_snapshot?.subject || ''}` : subject;

      const combinedAttachments = [
        ...(campaign.attachments || []),
        ...(template.attachments || [])
      ];

      const smtpResponse = await sendMail({
        smtpConfig: campaign.smtp_configs,
        to: contact.email,
        subject: finalSubject,
        html,
        text,
        attachments: combinedAttachments,
        inReplyTo: isFollowUp && recipient.parent_message_id ? recipient.parent_message_id : undefined,
        references: isFollowUp && recipient.parent_message_id ? recipient.parent_message_id : undefined,
      });

      const messageId = smtpResponse.messageId;

      await supabase
        .from('campaign_recipients')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString(),
          message_id: messageId,
          email_snapshot: { subject: finalSubject, body_html: html, body_text: text, message_id: messageId }
        })
        .eq('id', recipient.id);

      await supabase.from('send_log').insert({
        recipient_id: recipient.id,
        campaign_id: recipient.campaign_id,
        contact_email: contact.email,
        status: 'sent',
        smtp_response: smtpResponse.response,
      });

      // Schedule next step if applicable
      const nextStepIndex = recipient.step - 1;
      const nextFollowup = campaign.followups?.[nextStepIndex];

      if (nextFollowup) {
        const scheduledSend = new Date();
        scheduledSend.setDate(scheduledSend.getDate() + nextFollowup.gap_days);
        
        await supabase.from('campaign_recipients').insert({
          campaign_id: campaign.id,
          contact_id: contact.id,
          company_id: company?.id || null,
          status: 'queued',
          scheduled_send: scheduledSend.toISOString(),
          step: recipient.step + 1,
          parent_message_id: messageId, // Chain to the email we just sent
          email_snapshot: { subject: finalSubject } // Store the subject to keep Re: clean
        });
      }

      sent++;
    } catch (err: any) {
      console.error(`Failed to send recipient ${recipient.id}:`, err);
      
      const cleanMsg = getCleanErrorMessage(err.message);
      await supabase
        .from('campaign_recipients')
        .update({ status: 'failed', error_message: cleanMsg })
        .eq('id', recipient.id);

      await supabase.from('send_log').insert({
        recipient_id: recipient.id,
        campaign_id: recipient.campaign_id,
        contact_email: recipient.contacts.email,
        status: 'failed',
        smtp_response: cleanMsg,
      });
      
      failed++;
    }
  });

  // After all sends in the batch complete, check campaign completions
  for (const campaignId of campaignsToCheck) {
    const { count: remainingCount } = await supabase
      .from('campaign_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'queued', 'sending']);

    const sampleRecipient = due.find(r => r.campaign_id === campaignId);

    if (remainingCount === 0 && sampleRecipient && sampleRecipient.campaigns.status !== 'completed') {
      // Mark campaign as completed
      await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaignId);
      
      // Fetch summary for report
      const { data: stats } = await supabase
        .from('campaign_recipients')
        .select('status')
        .eq('campaign_id', campaignId);
        
      const totalSent = stats?.filter((r: any) => r.status === 'sent').length || 0;
      const totalFailed = stats?.filter((r: any) => r.status === 'failed').length || 0;
      const totalReplied = stats?.filter((r: any) => r.status === 'replied').length || 0;

      const reportHtml = `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
          <h2>Campaign Completed: ${sampleRecipient.campaigns.name}</h2>
          <p>Your campaign has finished processing all scheduled emails.</p>
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin-top: 20px;">
            <h3>Final Statistics</h3>
            <ul>
              <li><strong>Successfully Sent:</strong> ${totalSent}</li>
              <li><strong>Replies Received:</strong> ${totalReplied}</li>
              <li><strong>Failed to Send:</strong> ${totalFailed}</li>
            </ul>
          </div>
          <p style="margin-top: 20px; font-size: 12px; color: #71717a;">
            Log in to Mailer CRM to view detailed delivery and reply logs.
          </p>
        </div>
      `;

      try {
        await sendMail({
          smtpConfig: sampleRecipient.campaigns.smtp_configs,
          to: sampleRecipient.campaigns.from_email,
          subject: `Campaign Completed: ${sampleRecipient.campaigns.name}`,
          html: reportHtml
        });
      } catch (reportErr) {
        console.error('Failed to send completion report:', reportErr);
      }
    }
  }

  return NextResponse.json({ processed: due.length, sent, failed });
}

export async function GET(request: Request) {
  return POST(request);
}
