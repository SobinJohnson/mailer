import { createClient } from '@/lib/supabase/server';
import { CompanyTable } from '@/components/companies/CompanyTable';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  const supabase = await createClient();
  
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, industry, city, state, website, linkedin_url, notes, tags, status, created_at, updated_at')
    .order('created_at', { ascending: false })
    .range(0, 99);

  if (error) {
    console.error('Error fetching companies:', error);
  }

  return <CompanyTable initialCompanies={companies || []} />;
}
