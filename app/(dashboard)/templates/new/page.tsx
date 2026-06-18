import { TemplateEditor } from '@/components/templates/TemplateEditor';

export default function NewTemplatePage() {
  const emptyTemplate = {
    id: 'new',
    name: 'Untitled Template',
    subject: '',
    body_html: '<p>Hi {{first_name}},</p><p></p><p>Best,</p><p>{{sender_name}}</p>',
    body_text: '',
    variables: ['first_name', 'sender_name', 'signature'],
    category: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return <TemplateEditor template={emptyTemplate} isNew={true} />;
}
