import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  ensureSystemSettings: vi.fn().mockResolvedValue(undefined),
}));

import { createClient } from '@/lib/supabase/server';
import { createSupabaseMock } from '../helpers/mock-supabase';
import { GET, POST } from '@/app/api/templates/route';
import { GET as GET_BY_ID, PUT, DELETE } from '@/app/api/templates/[id]/route';

function makeRequest(method: string, url: string, body?: Record<string, any>): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Templates API Routes', () => {
  const { supabase, configure } = createSupabaseMock();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(supabase as any);
  });

  describe('GET /api/templates', () => {
    it('returns lists of templates with search and category filters', async () => {
      configure({ data: [{ id: 'temp1', name: 'Intro Email', category: 'intro' }], error: null });
      const req = makeRequest('GET', 'http://localhost:3500/api/templates?search=intro&category=intro');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].name).toBe('Intro Email');
    });
  });

  describe('POST /api/templates', () => {
    it('creates new email template', async () => {
      configure({ data: { id: 'temp1', name: 'Intro Email', body_html: '<h1>Hello</h1>' }, error: null });
      const req = makeRequest('POST', 'http://localhost:3500/api/templates', {
        name: 'Intro Email',
        body_html: '<h1>Hello</h1>',
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.name).toBe('Intro Email');
    });

    it('returns 400 on missing body_html validation', async () => {
      const req = makeRequest('POST', 'http://localhost:3500/api/templates', {
        name: 'Intro Email',
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/templates/[id]', () => {
    it('returns template details when found', async () => {
      configure({ data: { id: 'temp1', name: 'Intro Email' }, error: null });
      const req = makeRequest('GET', 'http://localhost:3500/api/templates/temp1');
      const res = await GET_BY_ID(req, { params: Promise.resolve({ id: 'temp1' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.name).toBe('Intro Email');
    });

    it('returns 404 if missing', async () => {
      configure({ data: null, error: null });
      const req = makeRequest('GET', 'http://localhost:3500/api/templates/missing');
      const res = await GET_BY_ID(req, { params: Promise.resolve({ id: 'missing' }) });
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/templates/[id]', () => {
    it('updates templates successfully', async () => {
      configure({ data: { id: 'temp1', name: 'Intro Updated' }, error: null });
      const req = makeRequest('PUT', 'http://localhost:3500/api/templates/temp1', {
        name: 'Intro Updated',
      });
      const res = await PUT(req, { params: Promise.resolve({ id: 'temp1' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.name).toBe('Intro Updated');
    });
  });

  describe('DELETE /api/templates/[id]', () => {
    it('deletes templates successfully', async () => {
      configure({ data: null, error: null });
      const req = makeRequest('DELETE', 'http://localhost:3500/api/templates/temp1');
      const res = await DELETE(req, { params: Promise.resolve({ id: 'temp1' }) });
      expect(res.status).toBe(200);
    });
  });
});
