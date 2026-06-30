import { createClient } from '@/lib/supabase/server';
import { ContactTable } from '@/components/contacts/ContactTable';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string; // 'all' | 'active' | 'inactive'
    sortBy?: string;
    sortDirection?: string;
  }>;
};

export default async function ContactsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const search = params.search || '';
  const status = params.status || 'all';
  const sortBy = params.sortBy || 'created_at';
  const sortDirection = params.sortDirection === 'asc' ? 'asc' : 'desc';

  const pageSize = 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let query = supabase
    .from('contacts')
    .select(`
      id, company_id, first_name, last_name, email, designation, phone,
      is_primary, notes, linkedin_url, is_general_mailbox,
      verification_status, is_active, created_at,
      company:companies(id, name)
    `, { count: 'exact' });

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  if (status === 'active') {
    query = query.or('is_active.eq.true,is_active.is.null');
  } else if (status === 'inactive') {
    query = query.eq('is_active', false);
  }

  query = query
    .order(sortBy, { ascending: sortDirection === 'asc' })
    .range(from, to);

  const [{ data: contacts, count, error }, { data: companies }] = await Promise.all([
    query,
    supabase
      .from('companies')
      .select('id, name')
      .eq('status', 'active')
      .order('name'),
  ]);

  if (error) {
    console.error('Error fetching contacts:', error);
  }

  return (
    <ContactTable
      initialContacts={(contacts as any[]) || []}
      companies={(companies as any[]) || []}
      count={count || 0}
      currentPage={page}
      pageSize={pageSize}
      status={status}
    />
  );
}
