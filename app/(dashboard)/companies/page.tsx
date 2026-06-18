import { createClient } from '@/lib/supabase/server';
import { CompanyTable } from '@/components/companies/CompanyTable';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  const supabase = await createClient();
  
  const { data: companies, error } = await supabase
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching companies:', error);
  }

  return <CompanyTable initialCompanies={companies || []} />;
}
