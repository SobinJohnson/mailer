import { createClient } from '@/lib/supabase/server';
import { ContactForm } from '@/components/contacts/ContactForm';

export const dynamic = 'force-dynamic';

export default async function NewContactPage() {
  const supabase = await createClient();
  
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name')
    .order('name');

  if (error) {
    console.error('Error fetching companies:', error);
  }

  return <ContactForm companies={companies || []} />;
}
