import { describe, it, expect } from 'vitest';
import { getCleanErrorMessage, cn } from '@/lib/utils';

describe('getCleanErrorMessage', () => {
  it('returns fallback message for empty string', () => {
    expect(getCleanErrorMessage('')).toBe('Failed to connect or send mail');
  });

  it('returns fallback message for falsy input', () => {
    expect(getCleanErrorMessage(null as any)).toBe('Failed to connect or send mail');
    expect(getCleanErrorMessage(undefined as any)).toBe('Failed to connect or send mail');
  });

  it('parses 535 auth failure errors', () => {
    const msg = getCleanErrorMessage('Invalid login: 535 5.7.8 Error: authentication failed: (reason unavailable)');
    expect(msg).toContain('Authentication failed');
    expect(msg).toContain('App Password');
  });

  it('parses authentication failed errors (case insensitive)', () => {
    const msg = getCleanErrorMessage('AUTHENTICATION FAILED: bad credentials');
    expect(msg).toContain('Authentication failed');
  });

  it('parses ENOTFOUND DNS errors', () => {
    const msg = getCleanErrorMessage('Error: getaddrinfo ENOTFOUND smtp.wronghost.com');
    expect(msg).toContain('Server not found');
    expect(msg).toContain('SMTP host');
  });

  it('parses ETIMEDOUT connection timeout errors', () => {
    const msg = getCleanErrorMessage('connect ETIMEDOUT 1.2.3.4:587');
    expect(msg).toContain('timed out');
  });

  it('parses connection timeout keyword', () => {
    const msg = getCleanErrorMessage('Connection timeout after 5000ms');
    expect(msg).toContain('timed out');
  });

  it('parses ECONNREFUSED errors', () => {
    const msg = getCleanErrorMessage('connect ECONNREFUSED 127.0.0.1:465');
    expect(msg).toContain('Connection refused');
  });

  it('parses self-signed certificate errors', () => {
    const msg = getCleanErrorMessage('self-signed certificate in certificate chain');
    expect(msg).toContain('SSL/TLS Error');
    expect(msg).toContain('self-signed');
  });

  it('parses depth zero self signed errors', () => {
    const msg = getCleanErrorMessage('depth zero self signed cert');
    expect(msg).toContain('SSL/TLS Error');
  });

  it('strips "(reason unavailable)" from unknown errors', () => {
    const msg = getCleanErrorMessage('Some unknown SMTP error (reason unavailable)');
    expect(msg).not.toContain('(reason unavailable)');
    expect(msg.trim()).toBe('Some unknown SMTP error');
  });

  it('passes through unrecognized errors unchanged (minus reason unavailable)', () => {
    const msg = getCleanErrorMessage('Something completely different');
    expect(msg).toBe('Something completely different');
  });
});

describe('cn (className merge utility)', () => {
  it('merges simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('removes falsy class names', () => {
    expect(cn('foo', false && 'bar', null, undefined, 'baz')).toBe('foo baz');
  });

  it('resolves Tailwind conflicts (last wins)', () => {
    // tailwind-merge: p-4 overrides p-2
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('handles conditional classes with boolean', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });

  it('handles conditional classes when false', () => {
    const isActive = false;
    expect(cn('base', isActive && 'active')).toBe('base');
  });
});
