export interface RenderContext {
  first_name: string;
  last_name?: string | null;
  company_name: string;
  designation?: string | null;
  city?: string | null;
  sender_name: string;
  sender_email: string;
  signature?: string | null;
}

export function renderTemplate(
  template: string,
  context: RenderContext
): string {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return (context as any)[key] ?? `{{${key}}}`;
  });
}
