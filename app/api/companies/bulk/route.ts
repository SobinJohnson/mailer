import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  
  try {
    const { companies } = await request.json();

    if (!Array.isArray(companies) || companies.length === 0) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }

    const payload = companies.map(row => ({
      name: row.name ? String(row.name).trim() : 'Unknown Company',
      industry: row.industry ? String(row.industry).trim() : null,
      city: row.city ? String(row.city).trim() : null,
      state: row.state ? String(row.state).trim() : null,
      website: row.website ? String(row.website).trim() : null,
      linkedin_url: row.linkedin_url ? String(row.linkedin_url).trim() : null,
      notes: row.notes ? String(row.notes).trim() : null,
      status: row.status && ['active', 'inactive', 'prospect', 'do_not_contact'].includes(String(row.status).toLowerCase()) 
        ? String(row.status).toLowerCase() 
        : 'active',
      tags: row.tags ? String(row.tags).split(',').map(t => t.trim()).filter(Boolean) : [],
    }));

    const { data, error } = await supabase
      .from('companies')
      .insert(payload);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, inserted: payload.length }, { status: 201 });
  } catch (error: any) {
    console.error('Bulk insert error:', error);
    return NextResponse.json({ error: error.message || 'Failed to import companies' }, { status: 500 });
  }
}
