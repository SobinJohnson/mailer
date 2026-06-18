import { createClient } from '@/lib/supabase/server';
import { ContactForm } from '@/components/contacts/ContactForm';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  
  const [ { data: contact, error }, { data: companies } ] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', id).single(),
    supabase.from('companies').select('id, name').order('name')
  ]);

  if (error || !contact) {
    notFound();
  }

  return <ContactForm initialData={contact} companies={companies || []} />;
}
