import { describe, it, expect, vi, beforeEach } from 'vitest';
import dns from 'dns';
import net from 'net';
import { EventEmitter } from 'events';

// Mock the supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  ensureSystemSettings: vi.fn().mockResolvedValue(undefined),
}));

import { createClient } from '@/lib/supabase/server';
import { POST } from '@/app/api/contacts/validate/route';

// Mock dns
vi.mock('dns', () => {
  return {
    default: {
      promises: {
        resolveMx: vi.fn(),
      },
    },
  };
});

// Mock net
vi.mock('net', () => {
  return {
    default: {
      createConnection: vi.fn(),
    },
  };
});

// Helper to make Request objects
function makeRequest(body: Record<string, any>): Request {
  return new Request('http://localhost:3500/api/contacts/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

class MockSocket extends EventEmitter {
  setTimeout = vi.fn();
  write = vi.fn();
  end = vi.fn();
}

describe('POST /api/contacts/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock to return an authenticated user session
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user1' } }, error: null }),
      },
    } as any);
  });

  it('returns 401 Unauthorized for unauthenticated requests', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as any);

    const req = makeRequest({ email: 'test@deliverable.com' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('fails immediately for invalid syntax (no @)', async () => {
    const req = makeRequest({ email: 'invalid-email' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.valid).toBe(false);
    expect(json.status).toBe('invalid_syntax');
    expect(json.error).toContain('format is invalid');
  });

  it('fails if DNS lookup resolves with no MX records', async () => {
    vi.mocked(dns.promises.resolveMx).mockResolvedValue([]);

    const req = makeRequest({ email: 'test@invalid-domain.com' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.valid).toBe(false);
    expect(json.status).toBe('no_mx_records');
    expect(json.error).toContain('No MX (Mail Exchange) records found');
  });

  it('fails if DNS lookup throws an error', async () => {
    vi.mocked(dns.promises.resolveMx).mockRejectedValue(new Error('ENOTFOUND'));

    const req = makeRequest({ email: 'test@invalid-domain.com' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.valid).toBe(false);
    expect(json.status).toBe('dns_failed');
    expect(json.error).toContain('DNS lookup failed');
  });

  it('succeeds for a deliverable mailbox', async () => {
    vi.mocked(dns.promises.resolveMx).mockResolvedValue([
      { exchange: 'mail.deliverable.com', priority: 10 },
    ]);

    const mockSocket = new MockSocket();
    vi.mocked(net.createConnection).mockReturnValue(mockSocket as any);

    mockSocket.write.mockImplementation((data: string) => {
      if (data.startsWith('QUIT')) return;

      process.nextTick(() => {
        if (data.startsWith('EHLO')) {
          mockSocket.emit('data', Buffer.from('250 Hello deliverable.com\r\n'));
        } else if (data.startsWith('MAIL FROM')) {
          mockSocket.emit('data', Buffer.from('250 Sender OK\r\n'));
        } else if (data.startsWith('RCPT TO')) {
          mockSocket.emit('data', Buffer.from('250 2.1.5 Recipient OK\r\n'));
        }
      });
    });

    // Auto-connect greeting
    process.nextTick(() => {
      mockSocket.emit('connect');
      mockSocket.emit('data', Buffer.from('220 mail.deliverable.com ESMTP Postfix\r\n'));
    });

    const req = makeRequest({ email: 'good-user@deliverable.com' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.valid).toBe(true);
    expect(json.status).toBe('deliverable');
    expect(json.details).toContain('deliverable');
  });

  it('fails for an undeliverable mailbox (SMTP 550)', async () => {
    vi.mocked(dns.promises.resolveMx).mockResolvedValue([
      { exchange: 'mail.bouncing.com', priority: 10 },
    ]);

    const mockSocket = new MockSocket();
    vi.mocked(net.createConnection).mockReturnValue(mockSocket as any);

    mockSocket.write.mockImplementation((data: string) => {
      if (data.startsWith('QUIT')) return;

      process.nextTick(() => {
        if (data.startsWith('EHLO')) {
          mockSocket.emit('data', Buffer.from('250 Hello bouncing.com\r\n'));
        } else if (data.startsWith('MAIL FROM')) {
          mockSocket.emit('data', Buffer.from('250 Sender OK\r\n'));
        } else if (data.startsWith('RCPT TO')) {
          mockSocket.emit('data', Buffer.from('550 5.1.1 User unknown\r\n'));
        }
      });
    });

    process.nextTick(() => {
      mockSocket.emit('connect');
      mockSocket.emit('data', Buffer.from('220 mail.bouncing.com ESMTP Postfix\r\n'));
    });

    const req = makeRequest({ email: 'missing-user@bouncing.com' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.valid).toBe(false);
    expect(json.status).toBe('undeliverable');
    expect(json.error).toContain('SMTP response: 550');
  });

  it('falls back to mx_valid on socket connection timeouts (Port 25 block)', async () => {
    vi.mocked(dns.promises.resolveMx).mockResolvedValue([
      { exchange: 'mail.blocked-port.com', priority: 10 },
    ]);

    const mockSocket = new MockSocket();
    vi.mocked(net.createConnection).mockImplementation(() => {
      process.nextTick(() => {
        mockSocket.emit('timeout');
      });
      return mockSocket as any;
    });

    const req = makeRequest({ email: 'user@blocked-port.com' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.valid).toBe(true);
    expect(json.status).toBe('mx_valid');
    expect(json.details).toContain('SMTP handshake timed out');
  });

  it('falls back to mx_valid on socket connection errors (e.g. ECONNREFUSED)', async () => {
    vi.mocked(dns.promises.resolveMx).mockResolvedValue([
      { exchange: 'mail.blocked-port.com', priority: 10 },
    ]);

    const mockSocket = new MockSocket();
    vi.mocked(net.createConnection).mockImplementation(() => {
      process.nextTick(() => {
        const err = new Error('Connection refused');
        (err as any).code = 'ECONNREFUSED';
        mockSocket.emit('error', err);
      });
      return mockSocket as any;
    });

    const req = makeRequest({ email: 'user@blocked-port.com' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.valid).toBe(true);
    expect(json.status).toBe('mx_valid');
    expect(json.details).toContain('Port 25 block detected');
  });
});
