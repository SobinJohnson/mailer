import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { TemplateEditor } from '@/components/templates/TemplateEditor';

export const dynamic = 'force-dynamic';

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  if (id === 'new') {
    return null; // Handled by new/page.tsx
  }

  const supabase = await createClient();

  const { data: template, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !template) {
    notFound();
  }

  return <TemplateEditor template={template} isNew={false} />;
}
