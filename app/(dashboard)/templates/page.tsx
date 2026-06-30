import { createClient } from '@/lib/supabase/server';
import { TemplateTable } from '@/components/templates/TemplateTable';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    sortBy?: string;
    sortDirection?: string;
  }>;
};

export default async function TemplatesPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const search = params.search || '';
  const sortBy = params.sortBy || 'updated_at';
  const sortDirection = params.sortDirection === 'asc' ? 'asc' : 'desc';

  const pageSize = 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  
  let query = supabase
    .from('email_templates')
    .select('id, name, subject, body_html, body_text, category, created_at, updated_at', { count: 'exact' });

  if (search) {
    query = query.or(`name.ilike.%${search}%,subject.ilike.%${search}%`);
  }

  query = query
    .order(sortBy, { ascending: sortDirection === 'asc' })
    .range(from, to);

  const { data: templates, count, error } = await query;

  if (error) {
    console.error('Error fetching templates:', error);
  }

  return (
    <TemplateTable
      initialTemplates={(templates as any[]) || []}
      count={count || 0}
      currentPage={page}
      pageSize={pageSize}
    />
  );
}
