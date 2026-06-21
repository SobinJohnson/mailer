import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { getCleanErrorMessage } from '@/lib/utils';

const testSchema = z.object({
  id: z.string().optional(),
  host: z.string().min(1),
  port: z.number().int().positive(),
  secure: z.boolean(),
  username: z.string().min(1),
  password: z.string().optional(),
  from_email: z.string().email(),
  from_name: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config = testSchema.parse(body);

    let passwordToUse = config.password;

    if (!passwordToUse && config.id) {
      const supabase = await createClient();
      const { data } = await supabase
        .from('smtp_configs')
        .select('password')
        .eq('id', config.id)
        .single();
      
      if (data?.password) {
        passwordToUse = data.password;
      }
    }

    if (!passwordToUse) {
      throw new Error('Password is required for testing connection');
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: passwordToUse,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // 1. Verify connection
    await transporter.verify();

    // 2. Send test email to the from_email address itself
    await transporter.sendMail({
      from: `"${config.from_name}" <${config.from_email}>`,
      to: config.from_email, // send it to themselves
      subject: 'Success! Your CRM SMTP Connection Works',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
          <h2 style="color: #333;">Connection Successful 🚀</h2>
          <p>If you are reading this email, your SMTP configuration is correct and working perfectly.</p>
          <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
          <p style="font-size: 13px; color: #666;">
            <strong>Host:</strong> ${config.host}<br />
            <strong>Port:</strong> ${config.port}<br />
            <strong>Username:</strong> ${config.username}
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: 'Connection successful & Test email sent!' });
  } catch (error: any) {
    console.error('SMTP Test Error:', error);
    return NextResponse.json(
      { success: false, error: getCleanErrorMessage(error.message) },
      { status: 400 }
    );
  }
}
