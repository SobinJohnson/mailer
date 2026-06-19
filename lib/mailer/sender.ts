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

  // Fetch attachment buffers from Supabase Storage or resolve URLs
  const resolvedAttachments = await Promise.all(
    attachments.map(async (att) => {
      const storagePath = att.storage_path || att.storagePath;

      if (!storagePath) {
        // If there's no storage path but there is a signed/public URL path, let Nodemailer fetch it directly.
        const pathVal = att.path;
        if (pathVal && (pathVal.startsWith('http://') || pathVal.startsWith('https://'))) {
          return { filename: att.filename, path: pathVal };
        }
        console.error(`Attachment ${att.filename} has no storage path or valid URL path:`, att);
        throw new Error(`Invalid attachment path for ${att.filename}`);
      }

      // Use service key to bypass RLS since the bucket is private
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );
      
      const { data, error } = await supabase.storage
        .from('campaign-attachments')
        .download(storagePath);

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
