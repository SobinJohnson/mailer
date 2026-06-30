import { createClient } from '@/lib/supabase/server';
import { ContactTable } from '@/components/contacts/ContactTable';

export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
  const supabase = await createClient();

  const [{ data: contacts, error }, { data: companies }] = await Promise.all([
    supabase
      .from('contacts')
      .select(`
        id, company_id, first_name, last_name, email, designation, phone,
        is_primary, notes, linkedin_url, is_general_mailbox,
        verification_status, is_active, created_at,
        company:companies(id, name)
      `)
      .order('created_at', { ascending: false })
      .range(0, 199),
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
    />
  );
}
