import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const pattern = `%${q}%`;

  const [companiesRes, contactsRes, templatesRes, campaignsRes] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name, industry, city, status')
      .ilike('name', pattern)
      .limit(5),

    supabase
      .from('contacts')
      .select('id, first_name, last_name, email, company_id, company:companies(name)')
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(5),

    supabase
      .from('email_templates')
      .select('id, name, subject, category')
      .or(`name.ilike.${pattern},subject.ilike.${pattern}`)
      .limit(4),

    supabase
      .from('campaigns')
      .select('id, name, status')
      .ilike('name', pattern)
      .limit(4),
  ]);

  const results = [
    ...(companiesRes.data || []).map(c => ({
      type: 'company' as const,
      id: c.id,
      title: c.name,
      subtitle: [c.industry, c.city].filter(Boolean).join(' · ') || 'Company',
      href: `/companies/${c.id}`,
      status: c.status,
    })),
    ...(contactsRes.data || []).map(c => ({
      type: 'contact' as const,
      id: c.id,
      title: `${c.first_name} ${c.last_name ?? ''}`.trim(),
      subtitle: c.email,
      meta: (c as any).company?.name,
      href: `/contacts`,
    })),
    ...(templatesRes.data || []).map(t => ({
      type: 'template' as const,
      id: t.id,
      title: t.name,
      subtitle: t.subject,
      href: `/templates/${t.id}`,
    })),
    ...(campaignsRes.data || []).map(c => ({
      type: 'campaign' as const,
      id: c.id,
      title: c.name,
      subtitle: c.status,
      href: `/campaigns/${c.id}`,
    })),
  ];

  return NextResponse.json({ results });
}
