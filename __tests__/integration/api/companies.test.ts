import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  ensureSystemSettings: vi.fn().mockResolvedValue(undefined),
}));

import { createClient } from '@/lib/supabase/server';
import { createSupabaseMock } from '../helpers/mock-supabase';
import { GET, POST } from '@/app/api/companies/route';
import { GET as GET_BY_ID, PUT, DELETE } from '@/app/api/companies/[id]/route';
import { POST as POST_BULK } from '@/app/api/companies/bulk/route';

function makeRequest(method: string, url: string, body?: Record<string, any>): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Companies API Routes', () => {
  const { supabase, configure } = createSupabaseMock();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(supabase as any);
  });

  describe('GET /api/companies', () => {
    it('returns lists of companies', async () => {
      configure({ data: [{ id: 'comp1', name: 'Cyberdyne' }], error: null });
      const req = makeRequest('GET', 'http://localhost:3500/api/companies?search=cyber&status=active');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].name).toBe('Cyberdyne');
    });

    it('returns 500 on database error', async () => {
      configure({ data: null, error: { message: 'Database failure' } });
      const req = makeRequest('GET', 'http://localhost:3500/api/companies');
      const res = await GET(req);
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/companies', () => {
    it('inserts a company with valid schema', async () => {
      configure({ data: [{ id: 'comp1', name: 'Cyberdyne' }], error: null });
      const req = makeRequest('POST', 'http://localhost:3500/api/companies', {
        name: 'Cyberdyne',
        website: 'https://cyberdyne.com',
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.name).toBe('Cyberdyne');
    });

    it('returns 400 on Zod schema error', async () => {
      const req = makeRequest('POST', 'http://localhost:3500/api/companies', {
        website: 'not-a-url',
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/companies/[id]', () => {
    it('returns company details by ID', async () => {
      configure({ data: [{ id: 'comp1', name: 'Cyberdyne' }], error: null });
      const req = makeRequest('GET', 'http://localhost:3500/api/companies/comp1');
      const res = await GET_BY_ID(req, { params: Promise.resolve({ id: 'comp1' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.name).toBe('Cyberdyne');
    });

    it('returns 404 if company is missing', async () => {
      configure({ data: null, error: null });
      const req = makeRequest('GET', 'http://localhost:3500/api/companies/missing');
      const res = await GET_BY_ID(req, { params: Promise.resolve({ id: 'missing' }) });
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/companies/[id]', () => {
    it('updates company details', async () => {
      configure({ data: [{ id: 'comp1', name: 'Cyberdyne Systems' }], error: null });
      const req = makeRequest('PUT', 'http://localhost:3500/api/companies/comp1', {
        name: 'Cyberdyne Systems',
      });
      const res = await PUT(req, { params: Promise.resolve({ id: 'comp1' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.name).toBe('Cyberdyne Systems');
    });
  });

  describe('DELETE /api/companies/[id]', () => {
    it('removes company record', async () => {
      configure({ data: null, error: null });
      const req = makeRequest('DELETE', 'http://localhost:3500/api/companies/comp1');
      const res = await DELETE(req, { params: Promise.resolve({ id: 'comp1' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe('POST /api/companies/bulk', () => {
    it('imports multiple companies', async () => {
      configure({ data: [], error: null });
      const req = makeRequest('POST', 'http://localhost:3500/api/companies/bulk', {
        companies: [
          { name: 'Company A', industry: 'Tech' },
          { name: 'Company B', industry: 'Finance' },
        ],
      });
      const res = await POST_BULK(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.inserted).toBe(2);
    });

    it('returns 400 on empty list input', async () => {
      const req = makeRequest('POST', 'http://localhost:3500/api/companies/bulk', {
        companies: [],
      });
      const res = await POST_BULK(req);
      expect(res.status).toBe(400);
    });
  });
});
