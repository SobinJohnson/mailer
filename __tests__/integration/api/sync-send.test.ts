import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockGetMailboxLock = vi.fn().mockResolvedValue({ release: vi.fn() });
const mockFetch = vi.fn().mockReturnValue({
  [Symbol.asyncIterator]: async function* () {
    yield { source: 'raw-email-source', envelope: {} };
  },
});
const mockLogout = vi.fn().mockResolvedValue(undefined);

vi.mock('imapflow', () => ({
  ImapFlow: vi.fn().mockImplementation(function () {
    return {
      connect: mockConnect,
      getMailboxLock: mockGetMailboxLock,
      fetch: mockFetch,
      logout: mockLogout,
    };
  }),
}));

vi.mock('mailparser', () => ({
  simpleParser: vi.fn().mockResolvedValue({
    inReplyTo: 'original-message-id',
    references: ['ref-message-id'],
    messageId: 'reply-message-id',
    from: { text: 'sender@reply.com' },
    subject: 'Re: Subject',
    text: 'This is a reply text body',
    html: '<p>This is a reply html body</p>',
    date: new Date(),
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  ensureSystemSettings: vi.fn().mockResolvedValue(undefined),
}));

import { createClient, createServiceClient } from '@/lib/supabase/server';

// We also mock the fetch global function since /api/sync/manual fetches sync/imap
const mockFetchGlobal = vi.fn().mockResolvedValue({
  status: 200,
  json: () => Promise.resolve({ results: [{ email: 'test', processed: 1, matches: 1, status: 'success' }] }),
});
vi.stubGlobal('fetch', mockFetchGlobal);

// Mocking the process endpoint since it imports other files
vi.mock('@/app/api/send/process/route', () => ({
  POST: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
}));

import { POST as POST_IMAP } from '@/app/api/sync/imap/route';
import { POST as POST_MANUAL_SYNC } from '@/app/api/sync/manual/route';
import { POST as POST_MANUAL_SEND } from '@/app/api/send/manual/route';

function makeRequest(method: string, url: string, headers?: Record<string, string>): Request {
  return new Request(url, {
    method,
    headers: headers || { 'Content-Type': 'application/json' },
  });
}

function buildMockSupabase(configs: any[], matchedRecipients: any[]) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'smtp_configs') {
        return {
          select: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: configs, error: null }),
        };
      }
      if (table === 'campaign_recipients') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: matchedRecipients, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: [], error: null }),
      };
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user1' } }, error: null }),
    },
  };
}

describe('Sync & Send API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockSupa = buildMockSupabase(
      [{ id: 'smtp1', imap_host: 'imap.test.com', imap_username: 'test', imap_password: 'pwd' }],
      [{ id: 'rec1', contact_id: 'c1', campaign_id: 'camp1' }]
    );
    vi.mocked(createClient).mockResolvedValue(mockSupa as any);
    vi.mocked(createServiceClient).mockReturnValue(mockSupa as any);
  });

  describe('POST /api/sync/imap', () => {
    it('returns 401 when request is unauthorized', async () => {
      const req = makeRequest('POST', 'http://localhost:3500/api/sync/imap');
      // Pass null mock auth
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      } as any);

      const res = await POST_IMAP(req);
      expect(res.status).toBe(401);
    });

    it('succeeds and updates database replies on valid request', async () => {
      const req = makeRequest('POST', 'http://localhost:3500/api/sync/imap', {
        'Authorization': `Bearer test-cron-secret-12345`,
        'Content-Type': 'application/json',
      });
      // Set the env secret temporarily
      const prevSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = 'test-cron-secret-12345';

      const res = await POST_IMAP(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.results).toHaveLength(1);
      expect(json.results[0].status).toBe('success');

      process.env.CRON_SECRET = prevSecret;
    });
  });

  describe('POST /api/sync/manual', () => {
    it('proxies request to IMAP sync with CRON_SECRET authorization', async () => {
      const res = await POST_MANUAL_SYNC();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.results[0].processed).toBe(1);
    });
  });

  describe('POST /api/send/manual', () => {
    it('executes manual send trigger successfully', async () => {
      const res = await POST_MANUAL_SEND();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });
});
