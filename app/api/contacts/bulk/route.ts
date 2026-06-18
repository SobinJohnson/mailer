import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  
  try {
    const { contacts } = await request.json();

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }

    // First fetch all companies to map company_name to company_id
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name');

    if (companiesError) throw companiesError;

    const companyMap = new Map();
    companies.forEach(c => companyMap.set(c.name.toLowerCase().trim(), c.id));

    const payload = [];
    let skipped = 0;

    for (const row of contacts) {
      const companyName = row.company_name ? String(row.company_name).trim() : '';
      const companyId = companyMap.get(companyName.toLowerCase());

      if (!companyId || !row.first_name || !row.email) {
        skipped++;
        continue;
      }

      payload.push({
        company_id: companyId,
        first_name: String(row.first_name).trim(),
        last_name: row.last_name ? String(row.last_name).trim() : null,
        email: String(row.email).trim().toLowerCase(),
        designation: row.designation ? String(row.designation).trim() : null,
        phone: row.phone ? String(row.phone).trim() : null,
        linkedin_url: row.linkedin_url ? String(row.linkedin_url).trim() : null,
        notes: row.notes ? String(row.notes).trim() : null,
        is_primary: String(row.is_primary).toLowerCase() === 'true' || row.is_primary === true,
      });
    }

    if (payload.length === 0) {
      return NextResponse.json({ error: `Failed to match any rows. Skipped ${skipped} rows due to missing required fields or unmatched company names.` }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert(payload);

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'One or more contacts already exist with the same email.' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ 
      success: true, 
      inserted: payload.length,
      skipped
    }, { status: 201 });

  } catch (error: any) {
    console.error('Bulk insert error:', error);
    return NextResponse.json({ error: error.message || 'Failed to import contacts' }, { status: 500 });
  }
}
