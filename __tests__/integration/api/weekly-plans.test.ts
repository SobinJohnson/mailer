import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  ensureSystemSettings: vi.fn().mockResolvedValue(undefined),
}));

import { createClient } from '@/lib/supabase/server';
import { createSupabaseMock } from '../helpers/mock-supabase';
import { GET, POST } from '@/app/api/weekly-plans/route';
import { GET as GET_BY_ID, PATCH, DELETE } from '@/app/api/weekly-plans/[id]/route';
import { POST as POST_DUPLICATE } from '@/app/api/weekly-plans/[id]/duplicate/route';
import { POST as POST_LAUNCH } from '@/app/api/weekly-plans/[id]/launch/route';
import { POST as POST_SCHEDULE } from '@/app/api/weekly-plans/[id]/schedule/route';
import { DELETE as DELETE_SCHEDULE_DAY } from '@/app/api/weekly-plans/[id]/schedule/[day]/route';

function makeRequest(method: string, url: string, body?: Record<string, any>): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Weekly Plans API Routes', () => {
  const { supabase, configure } = createSupabaseMock();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(supabase as any);
  });

  describe('GET /api/weekly-plans', () => {
    it('returns lists of weekly plans', async () => {
      configure({ data: [{ id: 'plan1', name: 'Q2 Mailings', start_date: '2026-06-01' }], error: null });
      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
    });
  });

  describe('POST /api/weekly-plans', () => {
    it('creates a new weekly plan in draft status', async () => {
      configure({ data: { id: 'plan1', name: 'Q2 Mailings', start_date: '2026-06-01' }, error: null });
      const req = makeRequest('POST', 'http://localhost:3500/api/weekly-plans', {
        name: 'Q2 Mailings',
        start_date: '2026-06-01',
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/weekly-plans/[id]', () => {
    it('returns plan details', async () => {
      configure({ data: { id: 'plan1', name: 'Q2 Mailings' }, error: null });
      const req = makeRequest('GET', 'http://localhost:3500/api/weekly-plans/plan1');
      const res = await GET_BY_ID(req, { params: Promise.resolve({ id: 'plan1' }) });
      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /api/weekly-plans/[id]', () => {
    it('updates plan details', async () => {
      configure({ data: { id: 'plan1', name: 'Q2 Mailings Updated' }, error: null });
      const req = makeRequest('PATCH', 'http://localhost:3500/api/weekly-plans/plan1', {
        name: 'Q2 Mailings Updated',
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: 'plan1' }) });
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/weekly-plans/[id]', () => {
    it('removes the plan', async () => {
      configure({ data: null, error: null });
      const req = makeRequest('DELETE', 'http://localhost:3500/api/weekly-plans/plan1');
      const res = await DELETE(req, { params: Promise.resolve({ id: 'plan1' }) });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/weekly-plans/[id]/duplicate', () => {
    it('duplicates the plan and shifts its start date by 7 days', async () => {
      const mockSourcePlan = {
        id: 'plan1',
        name: 'Q2 Mailings',
        start_date: '2026-06-01',
        daily_schedules: [{ id: 'ds1', day_of_week: 'Monday', send_time: '10:00' }],
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockSourcePlan, error: null }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'plan2', name: 'Q2 Mailings', start_date: '2026-06-08' }, error: null }),
            }),
          }),
        }),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = makeRequest('POST', 'http://localhost:3500/api/weekly-plans/plan1/duplicate');
      const res = await POST_DUPLICATE(req, { params: Promise.resolve({ id: 'plan1' }) });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.start_date).toBe('2026-06-08');
    });
  });

  describe('POST /api/weekly-plans/[id]/launch', () => {
    it('creates shadow campaigns and schedules recipients', async () => {
      const mockPlan = {
        id: 'plan1',
        name: 'Q2 Mailings',
        start_date: '2026-06-01',
        status: 'draft',
        daily_schedules: [{
          id: 'ds1',
          day_of_week: 'Monday',
          send_time: '09:00',
          group_id: 'group1',
          template_id: 'temp1',
          smtp_config_id: 'smtp1',
          send_gap_minutes: 2,
          gap_jitter_pct: 10,
        }],
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string) => {
              if (col === 'id') {
                return {
                  single: vi.fn().mockResolvedValue({ data: mockPlan, error: null }),
                };
              }
              return Promise.resolve({ data: [{ contact_id: 'c1' }], error: null });
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'camp1' }, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = makeRequest('POST', 'http://localhost:3500/api/weekly-plans/plan1/launch');
      const res = await POST_LAUNCH(req, { params: Promise.resolve({ id: 'plan1' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe('POST /api/weekly-plans/[id]/schedule', () => {
    it('upserts a daily schedule node', async () => {
      const mockSchedule = { id: 'ds1', day_of_week: 'Monday', send_time: '09:00' };
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockSchedule, error: null }),
            }),
          }),
        }),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = makeRequest('POST', 'http://localhost:3500/api/weekly-plans/plan1/schedule', {
        day_of_week: 'Monday',
        group_id: '00000000-0000-4000-a000-000000000001',
        template_id: '00000000-0000-4000-a000-000000000002',
        smtp_config_id: '00000000-0000-4000-a000-000000000003',
      });
      const res = await POST_SCHEDULE(req, { params: Promise.resolve({ id: 'plan1' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.day_of_week).toBe('Monday');
    });
  });

  describe('DELETE /api/weekly-plans/[id]/schedule/[day]', () => {
    it('removes a daily schedule node', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = makeRequest('DELETE', 'http://localhost:3500/api/weekly-plans/plan1/schedule/Monday');
      const res = await DELETE_SCHEDULE_DAY(req, { params: Promise.resolve({ id: 'plan1', day: 'Monday' }) });
      expect(res.status).toBe(200);
    });
  });
});
