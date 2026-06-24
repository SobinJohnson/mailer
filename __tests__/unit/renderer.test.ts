import { describe, it, expect } from 'vitest';
import { renderTemplate, type RenderContext } from '@/lib/mailer/renderer';

const baseContext: RenderContext = {
  first_name: 'Alice',
  last_name: 'Smith',
  company_name: 'Acme Corp',
  designation: 'CTO',
  city: 'Bangalore',
  sender_name: 'Bob Jones',
  sender_email: 'bob@example.com',
  signature: '<p>Bob Jones | Sales</p>',
};

describe('renderTemplate', () => {
  it('replaces all known template variables', () => {
    const template = 'Hi {{first_name}} {{last_name}} from {{company_name}}!';
    expect(renderTemplate(template, baseContext)).toBe('Hi Alice Smith from Acme Corp!');
  });

  it('replaces sender variables', () => {
    const template = 'From: {{sender_name}} <{{sender_email}}>';
    expect(renderTemplate(template, baseContext)).toBe('From: Bob Jones <bob@example.com>');
  });

  it('preserves unknown variables as-is', () => {
    const template = 'Hello {{first_name}}, your code is {{unknown_var}}';
    expect(renderTemplate(template, baseContext)).toBe('Hello Alice, your code is {{unknown_var}}');
  });

  it('returns empty string for empty template', () => {
    expect(renderTemplate('', baseContext)).toBe('');
  });

  it('returns empty string for falsy template', () => {
    expect(renderTemplate(null as any, baseContext)).toBe('');
    expect(renderTemplate(undefined as any, baseContext)).toBe('');
  });

  it('handles template with no variables', () => {
    const template = 'Hello there! This is a plain email.';
    expect(renderTemplate(template, baseContext)).toBe('Hello there! This is a plain email.');
  });

  it('handles null/undefined context values by preserving placeholder', () => {
    const ctxWithNull: RenderContext = { ...baseContext, last_name: null };
    const template = 'Hi {{first_name}} {{last_name}}';
    // null/undefined → preserve placeholder
    expect(renderTemplate(template, ctxWithNull)).toBe('Hi Alice {{last_name}}');
  });

  it('handles multiple occurrences of the same variable', () => {
    const template = '{{first_name}} is great. Yes, {{first_name}}!';
    expect(renderTemplate(template, baseContext)).toBe('Alice is great. Yes, Alice!');
  });

  it('handles HTML in context values without double-encoding', () => {
    const ctxWithHtml: RenderContext = { ...baseContext, signature: '<b>Bold</b>' };
    const template = '{{signature}}';
    expect(renderTemplate(template, ctxWithHtml)).toBe('<b>Bold</b>');
  });
});
