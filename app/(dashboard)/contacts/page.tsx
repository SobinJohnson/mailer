import { createClient } from '@/lib/supabase/server';
import { ContactTable } from '@/components/contacts/ContactTable';

export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
  const supabase = await createClient();

  const [{ data: contacts, error }, { data: companies }] = await Promise.all([
    supabase
      .from('contacts')
      .select(`*, company:companies (id, name)`)
      .order('created_at', { ascending: false }),
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
      initialContacts={contacts || []}
      companies={companies || []}
    />
  );
}
