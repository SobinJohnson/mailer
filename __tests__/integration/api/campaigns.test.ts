import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  ensureSystemSettings: vi.fn().mockResolvedValue(undefined),
}));

import { createClient } from '@/lib/supabase/server';
import { createSupabaseMock } from '../helpers/mock-supabase';
import { GET, POST } from '@/app/api/campaigns/route';
import { GET as GET_BY_ID, DELETE } from '@/app/api/campaigns/[id]/route';
import { POST as POST_LAUNCH } from '@/app/api/campaigns/[id]/launch/route';

function makeRequest(method: string, url: string, body?: Record<string, any>): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Campaigns API Routes', () => {
  const { supabase, configure } = createSupabaseMock();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(supabase as any);
  });

  describe('GET /api/campaigns', () => {
    it('returns lists of campaigns', async () => {
      configure({ data: [{ id: 'camp1', name: 'Intro Campaign' }], error: null });
      const req = makeRequest('GET', 'http://localhost:3500/api/campaigns');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].name).toBe('Intro Campaign');
    });
  });

  describe('POST /api/campaigns', () => {
    it('creates new draft campaign', async () => {
      configure({ data: { id: 'camp1', name: 'Intro Campaign' }, error: null });
      const req = makeRequest('POST', 'http://localhost:3500/api/campaigns', {
        name: 'Intro Campaign',
        from_name: 'John',
        from_email: 'john@cyberdyne.com',
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.name).toBe('Intro Campaign');
    });

    it('fails Zod validation on missing from_name', async () => {
      const req = makeRequest('POST', 'http://localhost:3500/api/campaigns', {
        name: 'Intro Campaign',
        from_email: 'john@cyberdyne.com',
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/campaigns/[id]', () => {
    it('returns detailed campaign information', async () => {
      configure({ data: { id: 'camp1', name: 'Intro Campaign' }, error: null });
      const req = makeRequest('GET', 'http://localhost:3500/api/campaigns/camp1');
      const res = await GET_BY_ID(req, { params: Promise.resolve({ id: 'camp1' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.name).toBe('Intro Campaign');
    });
  });

  describe('DELETE /api/campaigns/[id]', () => {
    it('removes campaign record and dependent logs/recipients', async () => {
      configure({ data: null, error: null });
      const req = makeRequest('DELETE', 'http://localhost:3500/api/campaigns/camp1');
      const res = await DELETE(req, { params: Promise.resolve({ id: 'camp1' }) });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/campaigns/[id]/launch', () => {
    it('creates campaign recipients queue rows and sets status running', async () => {
      const mockCampaign = {
        id: 'camp1',
        send_gap_minutes: 2,
        gap_jitter_pct: 10,
        status: 'draft',
        scheduled_at: null,
        active_days: ['Monday'],
        start_date: null,
        end_date: null,
        send_time: null,
        organization_id: 'org1',
      };

      // Mock database responses: first read campaign, then insert recipients, then update status
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'contacts') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: '00000000-0000-4000-a000-000000000001' },
                  { id: '00000000-0000-4000-a000-000000000002' },
                ],
                error: null,
              }),
            };
          }
          if (table === 'campaigns') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockCampaign, error: null }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === 'campaign_recipients') {
            return {
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = makeRequest('POST', 'http://localhost:3500/api/campaigns/camp1/launch', {
        recipientIds: ['00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002'],
      });
      const res = await POST_LAUNCH(req, { params: Promise.resolve({ id: 'camp1' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.count).toBe(2);
    });

    it('rejects if campaign is already running', async () => {
      const mockCampaign = {
        id: 'camp1',
        status: 'running',
      };
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'contacts') {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: [{ id: '00000000-0000-4000-a000-000000000001' }],
                error: null,
              }),
            };
          }
          if (table === 'campaigns') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockCampaign, error: null }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = makeRequest('POST', 'http://localhost:3500/api/campaigns/camp1/launch', {
        recipientIds: ['00000000-0000-4000-a000-000000000001'],
      });
      const res = await POST_LAUNCH(req, { params: Promise.resolve({ id: 'camp1' }) });
      expect(res.status).toBe(400);
    });
  });
});
