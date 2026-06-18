import { createClient } from '@/lib/supabase/server';
import { CompanyForm } from '@/components/companies/CompanyForm';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !company) {
    notFound();
  }

  return <CompanyForm initialData={company} />;
}
