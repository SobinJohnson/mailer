import { NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: Request) {
  try {
    // Security: Only allow if this is a first-run (no Supabase URL configured)
    // or if there's a valid session. Prevents remote .env overwrite attacks.
    const existingUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (existingUrl && existingUrl !== 'http://localhost:8000' && existingUrl !== '') {
      // App is already configured — require auth to change it
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return NextResponse.json({ error: 'Unauthorized. Log in to change database settings.' }, { status: 401 });
        }
      } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { url, anonKey, serviceKey } = await request.json();

    if (!url || !anonKey) {
      return NextResponse.json({ error: 'URL and Anon Key are required.' }, { status: 400 });
    }

    const envPath = join(process.cwd(), '.env.local');
    
    let envContent = '';
    try {
      envContent = await readFile(envPath, 'utf-8');
    } catch {
      // File doesn't exist yet, start fresh
    }

    // Helper to upsert an env variable
    const setEnvVar = (content: string, key: string, value: string) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        return content.replace(regex, `${key}=${value}`);
      }
      return content + (content.endsWith('\n') ? '' : '\n') + `${key}=${value}\n`;
    };

    envContent = setEnvVar(envContent, 'NEXT_PUBLIC_SUPABASE_URL', url);
    envContent = setEnvVar(envContent, 'NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey);
    if (serviceKey) {
      envContent = setEnvVar(envContent, 'SUPABASE_SERVICE_KEY', serviceKey);
    }

    await writeFile(envPath, envContent, 'utf-8');

    return NextResponse.json({ success: true, message: '.env.local updated. Restart the dev server to apply.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
