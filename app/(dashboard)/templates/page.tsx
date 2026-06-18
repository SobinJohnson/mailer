import { createClient } from '@/lib/supabase/server';
import { TemplateTable } from '@/components/templates/TemplateTable';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const supabase = await createClient();
  
  const { data: templates, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching templates:', error);
  }

  return <TemplateTable initialTemplates={templates || []} />;
}
