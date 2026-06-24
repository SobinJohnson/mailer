/**
 * Integration tests for the Send Queue Processor API.
 * POST /api/send/process
 *
 * Tests the authentication guard (CRON_SECRET vs user session),
 * the empty-queue fast path, and basic send flow with mocks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock supabase modules ────────────────────────────────────────────────────
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  ensureSystemSettings: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock the email sender — we never want real emails in tests ──────────────
vi.mock('@/lib/mailer/sender', () => ({
  sendMail: vi.fn().mockResolvedValue({
    messageId: '<test-message-id@test.example>',
    response: '250 OK',
  }),
}));

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { sendMail } from '@/lib/mailer/sender';
import { POST } from '@/app/api/send/process/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CRON_SECRET = 'test-cron-secret-12345';

function makeRequest(authHeader?: string): Request {
  return new Request('http://localhost:3500/api/send/process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: '{}',
  });
}

function buildServiceMock(queueItems: any[] = []) {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: queueItems.map(item => ({ id: item.id })),
      error: null
    }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: queueItems, error: null }),
        eq: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: queueItems, error: null }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('POST /api/send/process — Authentication', () => {
  const originalEnv = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalEnv;
  });

  it('returns 401 when no auth header and no user session', async () => {
    // createClient returns a mock with no authenticated user
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as any);
    vi.mocked(createServiceClient).mockReturnValue(buildServiceMock() as any);

    const req = makeRequest(); // No Authorization header
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 401 when wrong CRON_SECRET is provided', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as any);
    vi.mocked(createServiceClient).mockReturnValue(buildServiceMock() as any);

    const req = makeRequest('Bearer wrong-secret');
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 200 with correct CRON_SECRET and empty queue', async () => {
    vi.mocked(createServiceClient).mockReturnValue(buildServiceMock([]) as any);

    const req = makeRequest(`Bearer ${CRON_SECRET}`);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ processed: 0 });
  });
});

describe('POST /api/send/process — Empty Queue', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
    vi.clearAllMocks();
  });

  it('returns processed:0 when no items are due', async () => {
    vi.mocked(createServiceClient).mockReturnValue(buildServiceMock([]) as any);

    const req = makeRequest(`Bearer ${CRON_SECRET}`);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.processed).toBe(0);
    // sendMail should NOT have been called
    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
  });
});

describe('POST /api/send/process — Send Flow', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
    vi.clearAllMocks();
  });

  it('processes a queued recipient and calls sendMail', async () => {
    const queueItem = {
      id: 'r1',
      campaign_id: 'camp1',
      step: 1,
      parent_message_id: null,
      email_snapshot: null,
      contacts: {
        id: 'contact1',
        email: 'alice@test.com',
        first_name: 'Alice',
        last_name: 'Test',
        designation: 'CEO',
        companies: { id: 'comp1', name: 'TestCo', city: 'NY' },
      },
      campaigns: {
        id: 'camp1',
        name: 'Test Campaign',
        from_name: 'Bob',
        from_email: 'bob@sender.com',
        followups: [],
        attachments: [],
        status: 'running',
        email_templates: {
          id: 'tmpl1',
          subject: 'Hi {{first_name}}',
          body_html: '<p>Hello {{first_name}}</p>',
          body_text: 'Hello {{first_name}}',
          attachments: [],
        },
        followup_template: null,
        smtp_configs: {
          id: 'smtp1',
          host: 'smtp.test.com',
          port: 587,
          secure: false,
          username: 'user',
          password: 'pass',
          from_email: 'bob@sender.com',
          from_name: 'Bob',
          label: 'Test SMTP',
          signature_html: null,
        },
      },
    };

    // Build a more specific mock for this test
    const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) });
    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const countMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ count: 0, error: null }) }),
    });

    vi.mocked(createServiceClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: [{ id: 'r1' }], error: null }),
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'campaign_recipients') {
          return {
            select: vi.fn().mockImplementation((fields: any, opts: any) => {
              if (opts?.count === 'exact' && opts?.head === true) {
                return {
                  eq: vi.fn().mockReturnValue({
                    in: vi.fn().mockResolvedValue({ count: 0, error: null }),
                  }),
                };
              }
              return {
                in: vi.fn().mockResolvedValue({ data: [queueItem], error: null }),
                eq: vi.fn().mockResolvedValue({ data: [{ status: 'sent' }], error: null }),
              };
            }),
            update: updateMock,
            insert: insertMock,
          };
        }
        if (table === 'send_log') {
          return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
        }
        if (table === 'campaigns') {
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) };
        }
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ lte: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }) };
      }),
    } as any);

    const req = makeRequest(`Bearer ${CRON_SECRET}`);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.processed).toBe(1);
    expect(json.sent).toBe(1);
    expect(json.failed).toBe(0);

    // Verify sendMail was called with rendered subject
    expect(vi.mocked(sendMail)).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'alice@test.com',
        subject: 'Hi Alice', // Template rendered
      })
    );
  });
});
