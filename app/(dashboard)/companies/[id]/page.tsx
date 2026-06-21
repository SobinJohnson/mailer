import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { CompanyDetailView } from '@/components/companies/CompanyDetailView';

export const dynamic = 'force-dynamic';

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: company, error } = await supabase
    .from('companies')
    .select(`
      *,
      contacts (*)
    `)
    .eq('id', id)
    .single();

  if (error || !company) {
    notFound();
  }

  // Sort contacts so primary contact is always at the top
  if (company.contacts) {
    company.contacts.sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
  }

  return (
    <CompanyDetailView initialCompany={company} />
  );
}
