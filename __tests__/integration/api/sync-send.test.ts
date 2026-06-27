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
      if (table === 'contacts') {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: [], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
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

    });

    it('detects replies, marks recipient replied, reply_read as false, and sets contact is_active to false', async () => {
      const updatedCampaignRecipient = vi.fn().mockReturnThis();
      const updatedContact = vi.fn().mockReturnThis();

      const mockSupa = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'smtp_configs') {
            return {
              select: vi.fn().mockReturnThis(),
              not: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              then: (resolve: any) => resolve({ data: [{ id: 'smtp1', imap_host: 'imap.test.com', imap_username: 'test', imap_password: 'pwd' }], error: null }),
            };
          }
          if (table === 'campaign_recipients') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              update: updatedCampaignRecipient,
              eq: vi.fn().mockReturnThis(),
              then: (resolve: any) => resolve({ data: [{ id: 'rec1', contact_id: 'c1', campaign_id: 'camp1' }], error: null }),
            };
          }
          if (table === 'contacts') {
            return {
              update: updatedContact,
              eq: vi.fn().mockReturnThis(),
              then: (resolve: any) => resolve({ data: [], error: null }),
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

      vi.mocked(createClient).mockResolvedValue(mockSupa as any);
      vi.mocked(createServiceClient).mockReturnValue(mockSupa as any);

      const req = makeRequest('POST', 'http://localhost:3500/api/sync/imap', {
        'Authorization': `Bearer test-cron-secret-12345`,
        'Content-Type': 'application/json',
      });
      const prevSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = 'test-cron-secret-12345';

      const res = await POST_IMAP(req);
      expect(res.status).toBe(200);

      expect(updatedCampaignRecipient).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'replied',
          reply_read: false
        })
      );

      expect(updatedContact).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false
        })
      );

      process.env.CRON_SECRET = prevSecret;
    });

    it('detects bounces and marks recipients as failed and logs as bounced', async () => {
      const { simpleParser } = await import('mailparser');
      vi.mocked(simpleParser).mockResolvedValueOnce({
        inReplyTo: 'original-message-id',
        references: ['ref-message-id'],
        messageId: 'bounce-message-id',
        from: { text: 'mailer-daemon@googlemail.com' },
        subject: 'Delivery Status Notification (Failure)',
        text: 'Message-ID: <original-message-id>\nDelivery to the following recipient failed permanently...',
        html: '<p>Delivery failed</p>',
        date: new Date(),
      } as any);

      const updatedCampaignRecipient = vi.fn().mockReturnThis();
      const updatedSendLog = vi.fn().mockReturnThis();
      const updatedContact = vi.fn().mockReturnThis();

      const mockSupa = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'smtp_configs') {
            return {
              select: vi.fn().mockReturnThis(),
              not: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              then: (resolve: any) => resolve({ data: [{ id: 'smtp1', imap_host: 'imap.test.com', imap_username: 'test', imap_password: 'pwd' }], error: null }),
            };
          }
          if (table === 'campaign_recipients') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              update: updatedCampaignRecipient,
              eq: vi.fn().mockReturnThis(),
              then: (resolve: any) => resolve({ data: [{ id: 'rec1', contact_id: 'c1', campaign_id: 'camp1' }], error: null }),
            };
          }
          if (table === 'send_log') {
            return {
              update: updatedSendLog,
              eq: vi.fn().mockReturnThis(),
              then: (resolve: any) => resolve({ data: [], error: null }),
            };
          }
          if (table === 'contacts') {
            return {
              update: updatedContact,
              eq: vi.fn().mockReturnThis(),
              then: (resolve: any) => resolve({ data: [], error: null }),
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

      vi.mocked(createClient).mockResolvedValue(mockSupa as any);
      vi.mocked(createServiceClient).mockReturnValue(mockSupa as any);

      const req = makeRequest('POST', 'http://localhost:3500/api/sync/imap', {
        'Authorization': `Bearer test-cron-secret-12345`,
        'Content-Type': 'application/json',
      });
      const prevSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = 'test-cron-secret-12345';

      const res = await POST_IMAP(req);
      expect(res.status).toBe(200);

      expect(updatedCampaignRecipient).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: expect.stringContaining('bounced')
        })
      );

      expect(updatedSendLog).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'bounced',
          smtp_response: expect.stringContaining('Bounce detected')
        })
      );

      expect(updatedContact).toHaveBeenCalledWith(
        expect.objectContaining({
          verification_status: 'failed'
        })
      );

      process.env.CRON_SECRET = prevSecret;
    });

    it('detects bounces by parsing Message-ID from text body when headers are missing', async () => {
      const { simpleParser } = await import('mailparser');
      vi.mocked(simpleParser).mockResolvedValueOnce({
        inReplyTo: undefined,
        references: undefined,
        messageId: 'bounce-message-id',
        from: { text: 'mailer-daemon@googlemail.com' },
        subject: 'Delivery Status Notification (Failure)',
        text: 'The original message was sent with Message-ID: <original-message-id-from-body>\nDelivery failed...',
        html: '<p>Delivery failed</p>',
        date: new Date(),
      } as any);

      const updatedCampaignRecipient = vi.fn().mockReturnThis();
      const updatedSendLog = vi.fn().mockReturnThis();
      const updatedContact = vi.fn().mockReturnThis();

      const mockSupa = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'smtp_configs') {
            return {
              select: vi.fn().mockReturnThis(),
              not: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              then: (resolve: any) => resolve({ data: [{ id: 'smtp1', imap_host: 'imap.test.com', imap_username: 'test', imap_password: 'pwd' }], error: null }),
            };
          }
          if (table === 'campaign_recipients') {
            return {
              select: vi.fn().mockImplementation((fields: string) => {
                return {
                  in: vi.fn().mockImplementation((field: string, values: any[]) => {
                    expect(values).toContain('original-message-id-from-body');
                    return {
                      limit: vi.fn().mockReturnThis(),
                      then: (resolve: any) => resolve({ data: [{ id: 'rec1', contact_id: 'c1', campaign_id: 'camp1' }], error: null }),
                    };
                  }),
                };
              }),
              update: updatedCampaignRecipient,
              eq: vi.fn().mockReturnThis(),
            };
          }
          if (table === 'send_log') {
            return {
              update: updatedSendLog,
              eq: vi.fn().mockReturnThis(),
              then: (resolve: any) => resolve({ data: [], error: null }),
            };
          }
          if (table === 'contacts') {
            return {
              update: updatedContact,
              eq: vi.fn().mockReturnThis(),
              then: (resolve: any) => resolve({ data: [], error: null }),
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

      vi.mocked(createClient).mockResolvedValue(mockSupa as any);
      vi.mocked(createServiceClient).mockReturnValue(mockSupa as any);

      const req = makeRequest('POST', 'http://localhost:3500/api/sync/imap', {
        'Authorization': `Bearer test-cron-secret-12345`,
        'Content-Type': 'application/json',
      });
      const prevSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = 'test-cron-secret-12345';

      const res = await POST_IMAP(req);
      expect(res.status).toBe(200);

      expect(updatedCampaignRecipient).toHaveBeenCalled();
      expect(updatedContact).toHaveBeenCalledWith(
        expect.objectContaining({
          verification_status: 'failed'
        })
      );

    });

    it('detects replies matching by sender email address fallback when message-id fails', async () => {
      const { simpleParser } = await import('mailparser');
      vi.mocked(simpleParser).mockResolvedValueOnce({
        inReplyTo: 'non-matching-id',
        references: [],
        messageId: 'reply-message-id',
        from: { value: [{ address: 'sender@reply.com' }], text: 'sender@reply.com' },
        subject: 'Re: Subject',
        text: 'This is a reply text body',
        html: '<p>This is a reply html body</p>',
        date: new Date(),
      } as any);

      const updatedCampaignRecipient = vi.fn().mockReturnThis();

      const mockSupa = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'smtp_configs') {
            return {
              select: vi.fn().mockReturnThis(),
              not: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              then: (resolve: any) => resolve({ data: [{ id: 'smtp1', imap_host: 'imap.test.com', imap_username: 'test', imap_password: 'pwd' }], error: null }),
            };
          }
          if (table === 'campaign_recipients') {
            return {
              select: vi.fn().mockImplementation(() => {
                return {
                  in: vi.fn().mockImplementation((field: string, values: any[]) => {
                    if (field === 'message_id') {
                      // Return no match for Message-ID
                      return {
                        limit: vi.fn().mockReturnThis(),
                        then: (resolve: any) => resolve({ data: [], error: null }),
                      };
                    }
                    if (field === 'contact_id') {
                      // Return fallback match
                      return {
                        in: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        order: vi.fn().mockReturnThis(),
                        limit: vi.fn().mockReturnThis(),
                        then: (resolve: any) => resolve({ data: [{ id: 'rec1', contact_id: 'c1', campaign_id: 'camp1' }], error: null }),
                      };
                    }
                    return { limit: vi.fn().mockReturnThis(), then: (resolve: any) => resolve({ data: [], error: null }) };
                  }),
                };
              }),
              update: updatedCampaignRecipient,
              eq: vi.fn().mockReturnThis(),
              then: (resolve: any) => resolve({ data: [], error: null }),
            };
          }
          if (table === 'contacts') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                then: (resolve: any) => resolve({ data: [{ id: 'c1' }], error: null }),
              }),
            };
          }
          if (table === 'campaigns') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                then: (resolve: any) => resolve({ data: [{ id: 'camp1' }], error: null }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) => resolve({ data: [], error: null }),
          };
        }),
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user1' } }, error: null }),
        },
      };

      vi.mocked(createClient).mockResolvedValue(mockSupa as any);
      vi.mocked(createServiceClient).mockReturnValue(mockSupa as any);

      const req = makeRequest('POST', 'http://localhost:3500/api/sync/imap', {
        'Authorization': `Bearer test-cron-secret-12345`,
        'Content-Type': 'application/json',
      });
      const prevSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = 'test-cron-secret-12345';

      const res = await POST_IMAP(req);
      expect(res.status).toBe(200);

      expect(updatedCampaignRecipient).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'replied',
          reply_read: false
        })
      );

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
