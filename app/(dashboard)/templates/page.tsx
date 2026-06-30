import { createClient } from '@/lib/supabase/server';
import { TemplateTable } from '@/components/templates/TemplateTable';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const supabase = await createClient();
  
  const { data: templates, error } = await supabase
    .from('email_templates')
    .select('id, name, subject, body_html, body_text, category, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .range(0, 99);

  if (error) {
    console.error('Error fetching templates:', error);
  }

  return <TemplateTable initialTemplates={(templates as any[]) || []} />;
}
