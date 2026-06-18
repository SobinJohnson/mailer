import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { url, anonKey, serviceKey } = await request.json();

    if (!url || !anonKey) {
      return NextResponse.json({ success: false, error: 'URL and Anon Key are required.' });
    }

    // Test with the service key if provided, otherwise anon key
    const testKey = serviceKey || anonKey;
    const supabase = createClient(url, testKey);

    // Test 1: Check if we can reach the database
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    if (error) {
      // If organizations table doesn't exist, the schema hasn't been applied
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({
          success: false,
          error: 'Connection works but the schema is missing. Run the init.sql script first.',
        });
      }
      return NextResponse.json({ success: false, error: `Database error: ${error.message}` });
    }

    // Test 2: Verify key tables exist
    const tables = ['companies', 'contacts', 'campaigns', 'email_templates', 'smtp_configs'];
    for (const table of tables) {
      const { error: tableError } = await supabase.from(table).select('id').limit(1);
      if (tableError && (tableError.message.includes('does not exist') || tableError.code === '42P01')) {
        return NextResponse.json({
          success: false,
          error: `Table "${table}" is missing. Run the init.sql script to create all tables.`,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: `Connection failed: ${err.message}`,
    });
  }
}
