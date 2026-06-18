import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { SmtpConfig, CampaignAttachment } from '@/types';

interface SendMailOptions {
  smtpConfig: SmtpConfig;
  to: string;
  subject: string;
  html: string;
  text?: string | null;
  attachments?: CampaignAttachment[];
  inReplyTo?: string;
  references?: string;
}

export async function sendMail({
  smtpConfig,
  to,
  subject,
  html,
  text,
  attachments = [],
  inReplyTo,
  references,
}: SendMailOptions) {
  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.username,
      pass: smtpConfig.password,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  // Fetch attachment buffers from Supabase Storage
  const resolvedAttachments = await Promise.all(
    attachments.map(async (att) => {
      // Use service key to bypass RLS since the bucket is private
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );
      
      const { data, error } = await supabase.storage
        .from('campaign-attachments')
        .download(att.storage_path);

      if (error || !data) {
        console.error(`Failed to download attachment ${att.filename}:`, error);
        throw new Error(`Failed to download attachment ${att.filename}`);
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      return { filename: att.filename, content: buffer };
    })
  );

  const result = await transporter.sendMail({
    from: `"${smtpConfig.from_name || smtpConfig.label}" <${smtpConfig.from_email}>`,
    to,
    subject,
    html,
    text: text || undefined,
    attachments: resolvedAttachments,
    inReplyTo,
    references,
  });

  return result;
}
