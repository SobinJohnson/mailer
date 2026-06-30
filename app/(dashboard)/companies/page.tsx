import { createClient } from '@/lib/supabase/server';
import { CompanyTable } from '@/components/companies/CompanyTable';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    sortBy?: string;
    sortDirection?: string;
  }>;
};

export default async function CompaniesPage({ searchParams }: Props) {
  console.time('companies-page:total');
  
  console.time('companies-page:searchParams');
  const params = await searchParams;
  console.timeEnd('companies-page:searchParams');

  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const search = params.search || '';
  const sortBy = params.sortBy || 'created_at';
  const sortDirection = params.sortDirection === 'asc' ? 'asc' : 'desc';

  const pageSize = 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  console.time('companies-page:createClient');
  const supabase = await createClient();
  console.timeEnd('companies-page:createClient');
  
  let query = supabase
    .from('companies')
    .select('id, name, industry, city, state, website, linkedin_url, notes, tags, status, created_at, updated_at', { count: 'exact' });

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  query = query
    .order(sortBy, { ascending: sortDirection === 'asc' })
    .range(from, to);

  console.time('companies-page:query');
  const { data: companies, count, error } = await query;
  console.timeEnd('companies-page:query');

  if (error) {
    console.error('Error fetching companies:', error);
  }

  const table = (
    <CompanyTable 
      initialCompanies={companies || []} 
      count={count || 0}
      currentPage={page}
      pageSize={pageSize}
    />
  );

  console.timeEnd('companies-page:total');
  return table;
}
