import { NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { renderTemplate } from '@/lib/mailer/renderer';
import { sendMail } from '@/lib/mailer/sender';
import { getCleanErrorMessage } from '@/lib/utils';
import * as XLSX from 'xlsx';

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

  // Fetch due recipients
  let query = supabase
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
    .eq('status', 'queued')
    .lte('scheduled_send', now);

  if (orgIds.length > 0) {
    query = query.in('organization_id', orgIds);
  }

  const { data: due, error: fetchError } = await query.limit(10);

  if (fetchError) {
    console.error('Queue fetch error:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
  }

  if (!due || due.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let sent = 0, failed = 0;

  for (const recipient of due) {
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

    // Check if campaign is fully completed
    const { count: remainingCount } = await supabase
      .from('campaign_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', recipient.campaign_id)
      .in('status', ['pending', 'queued']);

    if (remainingCount === 0 && recipient.campaigns.status !== 'completed') {
      // Mark campaign as completed
      await supabase.from('campaigns').update({ status: 'completed' }).eq('id', recipient.campaign_id);
      
      // Fetch summary for report
      const { data: stats } = await supabase
        .from('campaign_recipients')
        .select(`
          status,
          sent_at,
          replied_at,
          error_message,
          scheduled_send,
          contact:contacts(
            *,
            company:companies(*)
          )
        `)
        .eq('campaign_id', recipient.campaign_id);

      const totalSent = stats?.filter((r: any) => r.status === 'sent').length || 0;
      const totalFailed = stats?.filter((r: any) => r.status === 'failed').length || 0;
      const totalReplied = stats?.filter((r: any) => r.status === 'replied').length || 0;
      const totalSkipped = stats?.filter((r: any) => r.status === 'skipped').length || 0;
      const totalSelected = stats?.length || 0;

      // 1. Fetch Weekly Plan Name if it exists
      let weeklyPlanName = null;
      if (recipient.campaigns.weekly_plan_id) {
        const { data: wp } = await supabase
          .from('weekly_plans')
          .select('name')
          .eq('id', recipient.campaigns.weekly_plan_id)
          .single();
        if (wp) {
          weeklyPlanName = wp.name;
        }
      }

      // 2. Fetch Templates and Campaign details
      const { data: campaignDetails } = await supabase
        .from('campaigns')
        .select(`
          *,
          email_templates!campaigns_template_id_fkey(*),
          smtp_configs(*)
        `)
        .eq('id', recipient.campaign_id)
        .single();

      const followups = campaignDetails?.followups || [];
      const followupTemplateIds = followups.map((f: any) => f.template_id).filter(Boolean);
      let followupTemplates: any[] = [];
      if (followupTemplateIds.length > 0) {
        const { data: ft } = await supabase
          .from('email_templates')
          .select('*')
          .in('id', followupTemplateIds);
        followupTemplates = ft || [];
      }

      // 3. Compile Template HTML preview
      const initialTemplate = campaignDetails?.email_templates;
      let templatesHtml = '';

      if (initialTemplate) {
        templatesHtml += `
          <div style="margin-top: 15px; border-left: 3px solid #e4e4e7; padding-left: 15px; padding-bottom: 5px;">
            <h4 style="margin: 0 0 5px 0; color: #18181b;">Step 1: Initial Email</h4>
            <p style="margin: 0 0 5px 0; font-size: 13px;"><strong>Subject:</strong> ${initialTemplate.subject || '—'}</p>
            <div style="font-size: 12px; color: #52525b; max-height: 120px; overflow-y: auto; background: #fafafa; padding: 10px; border: 1px solid #e4e4e7; border-radius: 4px; white-space: pre-wrap;">${initialTemplate.body_text || initialTemplate.body_html || ''}</div>
          </div>
        `;
      }

      followups.forEach((f: any, idx: number) => {
        const t = followupTemplates.find((temp: any) => temp.id === f.template_id);
        if (t) {
          templatesHtml += `
            <div style="margin-top: 15px; border-left: 3px solid #e4e4e7; padding-left: 15px; padding-bottom: 5px;">
              <h4 style="margin: 0 0 5px 0; color: #18181b;">Step ${idx + 2}: Followup (${f.gap_days} days delay)</h4>
              <p style="margin: 0 0 5px 0; font-size: 13px;"><strong>Subject:</strong> ${t.subject || '—'}</p>
              <div style="font-size: 12px; color: #52525b; max-height: 120px; overflow-y: auto; background: #fafafa; padding: 10px; border: 1px solid #e4e4e7; border-radius: 4px; white-space: pre-wrap;">${t.body_text || t.body_html || ''}</div>
            </div>
          `;
        }
      });

      // 4. Construct Excel outcomes buffer
      const excelRows = (stats || []).map((r: any) => {
        const contact = (r.contact || {}) as any;
        const company = (contact.company || {}) as any;
        
        return {
          'First Name': contact.first_name || '',
          'Last Name': contact.last_name || '',
          'Email': contact.email || '',
          'Company Name': company.name || '',
          'Company Website': company.website || '',
          'Company Industry': company.industry || '',
          'Designation': contact.designation || '',
          'Phone': contact.phone || '',
          'LinkedIn URL': contact.linkedin_url || '',
          'Notes': contact.notes || '',
          'Delivery Status': r.status || '',
          'Action Time': r.replied_at 
            ? new Date(r.replied_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) 
            : r.sent_at 
              ? new Date(r.sent_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
              : r.scheduled_send
                ? new Date(r.scheduled_send).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
                : '',
          'Error Message': r.error_message || '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Campaign Outcomes");
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const usernameClean = recipient.campaigns.smtp_configs.from_email.replace(/[^a-zA-Z0-9.@_-]/g, '');
      const campaignNameClean = recipient.campaigns.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const kolkataDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
      const kolkataTime = new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'Asia/Kolkata' }).replace(/:/g, '-'); // HH-mm-ss
      const excelFilename = `${usernameClean}_report_${campaignNameClean}_${kolkataDate}_${kolkataTime}.xlsx`;

      const reportHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; color: #18181b; line-height: 1.5; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="background: #18181b; padding: 24px; color: #ffffff;">
            <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #a1a1aa; display: block; margin-bottom: 4px;">Automation Complete</span>
            <h2 style="margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.5px;">${recipient.campaigns.name}</h2>
          </div>
          
          <div style="padding: 24px; background: #ffffff;">
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #71717a;">
              The outbound automation sequence has finished mailing all target contacts. Below is the final outcomes overview and campaign configurations.
            </p>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr>
                <td style="padding: 8px 0; font-size: 13px; color: #71717a; border-bottom: 1px solid #f4f4f5; width: 40%;"><strong>Outbound Mailbox:</strong></td>
                <td style="padding: 8px 0; font-size: 13px; font-weight: 500; border-bottom: 1px solid #f4f4f5;">${recipient.campaigns.from_email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 13px; color: #71717a; border-bottom: 1px solid #f4f4f5;"><strong>Weekly Planner Context:</strong></td>
                <td style="padding: 8px 0; font-size: 13px; font-weight: 500; border-bottom: 1px solid #f4f4f5; color: ${weeklyPlanName ? '#18181b' : '#71717a'}">
                  ${weeklyPlanName ? `Yes (${weeklyPlanName})` : 'No (Manual launch)'}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 13px; color: #71717a; border-bottom: 1px solid #f4f4f5;"><strong>Total Selected Contacts:</strong></td>
                <td style="padding: 8px 0; font-size: 13px; font-weight: 500; border-bottom: 1px solid #f4f4f5;">${totalSelected}</td>
              </tr>
            </table>

            <h3 style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px 0; color: #71717a;">Final Outcomes Overview</h3>
            <div style="display: table; width: 100%; border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
              <div style="display: table-cell; width: 25%; text-align: center; padding: 12px 8px; border-right: 1px solid #e4e4e7;">
                <span style="font-size: 20px; font-weight: 700; color: #18181b; display: block;">${totalSent}</span>
                <span style="font-size: 9px; font-weight: 600; text-transform: uppercase; color: #71717a; display: block; margin-top: 2px;">Sent</span>
              </div>
              <div style="display: table-cell; width: 25%; text-align: center; padding: 12px 8px; border-right: 1px solid #e4e4e7;">
                <span style="font-size: 20px; font-weight: 700; color: #059669; display: block;">${totalReplied}</span>
                <span style="font-size: 9px; font-weight: 600; text-transform: uppercase; color: #059669; display: block; margin-top: 2px;">Replied</span>
              </div>
              <div style="display: table-cell; width: 25%; text-align: center; padding: 12px 8px; border-right: 1px solid #e4e4e7;">
                <span style="font-size: 20px; font-weight: 700; color: #dc2626; display: block;">${totalFailed}</span>
                <span style="font-size: 9px; font-weight: 600; text-transform: uppercase; color: #dc2626; display: block; margin-top: 2px;">Failed</span>
              </div>
              <div style="display: table-cell; width: 25%; text-align: center; padding: 12px 8px;">
                <span style="font-size: 20px; font-weight: 700; color: #71717a; display: block;">${totalSkipped}</span>
                <span style="font-size: 9px; font-weight: 600; text-transform: uppercase; color: #71717a; display: block; margin-top: 2px;">Skipped</span>
              </div>
            </div>

            <h3 style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px 0; color: #71717a;">Campaign Sequences</h3>
            <div style="background: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
              ${templatesHtml}
            </div>

            <div style="border-top: 1px solid #e4e4e7; padding-top: 16px; margin-top: 24px; font-size: 12px; color: #71717a; text-align: center;">
              <p style="margin: 0 0 4px 0;">Attached is the structured Excel sheet containing the final delivery results.</p>
              <p style="margin: 0;">Filename: <code style="background: #f4f4f5; padding: 2px 4px; border-radius: 4px; font-family: monospace;">${excelFilename}</code></p>
            </div>
          </div>
        </div>
      `;

      try {
        await sendMail({
          smtpConfig: recipient.campaigns.smtp_configs,
          to: recipient.campaigns.from_email,
          subject: `Campaign Completed: ${recipient.campaigns.name}`,
          html: reportHtml,
          customAttachments: [
            {
              filename: excelFilename,
              content: excelBuffer
            }
          ]
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
