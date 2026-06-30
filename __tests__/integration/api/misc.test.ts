import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  ensureSystemSettings: vi.fn().mockResolvedValue(undefined),
}));

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { createSupabaseMock } from '../helpers/mock-supabase';
import { GET as GET_SEARCH } from '@/app/api/search/route';
import { GET as GET_ATTACHMENTS, POST as POST_ATTACHMENTS } from '@/app/api/attachments/route';
import { POST as POST_UPLOAD } from '@/app/api/upload/route';
import { GET as GET_GROUPS, POST as POST_GROUPS } from '@/app/api/groups/route';
import { GET as GET_GROUP_BY_ID, PUT as PUT_GROUP, DELETE as DELETE_GROUP } from '@/app/api/groups/[id]/route';

function makeRequest(method: string, url: string, body?: any): Request {
  return new Request(url, {
    method,
    headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
}

describe('Misc API Routes', () => {
  const { supabase, configure } = createSupabaseMock();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(supabase as any);
    vi.mocked(createServiceClient).mockReturnValue(supabase as any);
  });

  describe('GET /api/search', () => {
    it('performs global search across tables', async () => {
      // Mock Promise.all returns for companies, contacts, templates, campaigns
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => ({
          select: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: table === 'companies' ? [{ id: '1', name: 'Cyberdyne' }] : [],
                error: null,
              }),
            }),
            or: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        })),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = makeRequest('GET', 'http://localhost:3500/api/search?q=cyber');
      const res = await GET_SEARCH(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.results).toHaveLength(1);
      expect(json.results[0].title).toBe('Cyberdyne');
    });
  });

  describe('Attachments & Uploads Storage APIs', () => {
    it('saves attachment metadata and uploads file', async () => {
      const mockAttachment = { id: 'att1', filename: 'test.txt', size_bytes: 13 };
      const mockSupabase = {
        storage: {
          from: vi.fn().mockReturnValue({
            upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
            createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://test-signed-url' }, error: null }),
          }),
        },
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockAttachment, error: null }),
            }),
          }),
        }),
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user1' } }, error: null }),
        },
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const formData = new FormData();
      const mockFile = new File(['dummy-content'], 'test.txt', { type: 'text/plain' });
      formData.append('file', mockFile);

      const req = makeRequest('POST', 'http://localhost:3500/api/attachments', formData);
      const res = await POST_ATTACHMENTS(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.filename).toBe('test.txt');
    });

    it('uploads files via authenticated upload API endpoint', async () => {
      const mockSupabase = {
        storage: {
          from: vi.fn().mockReturnValue({
            upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
            createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://test-signed-url' }, error: null }),
          }),
        },
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user1' } }, error: null }),
        },
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
      vi.mocked(createServiceClient).mockReturnValue(mockSupabase as any);

      const formData = new FormData();
      const mockFile = new File(['dummy-content'], 'test.txt', { type: 'text/plain' });
      formData.append('file', mockFile);

      const req = makeRequest('POST', 'http://localhost:3500/api/upload', formData);
      const res = await POST_UPLOAD(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.url).toBe('https://test-signed-url');
    });
  });

  describe('Groups APIs', () => {
    it('returns lists of contact groups', async () => {
      configure({ data: [{ id: 'group1', name: 'Leads' }], error: null });
      const req = makeRequest('GET', 'http://localhost:3500/api/groups');
      const res = await GET_GROUPS(req);
      expect(res.status).toBe(200);
    });

    it('creates new contact group', async () => {
      configure({ data: { id: 'group1', name: 'Leads' }, error: null });
      const req = makeRequest('POST', 'http://localhost:3500/api/groups', { name: 'Leads' });
      const res = await POST_GROUPS(req);
      expect(res.status).toBe(201);
    });

    it('gets group details by ID', async () => {
      configure({ data: { id: 'group1', name: 'Leads' }, error: null });
      const req = makeRequest('GET', 'http://localhost:3500/api/groups/group1');
      const res = await GET_GROUP_BY_ID(req, { params: Promise.resolve({ id: 'group1' }) });
      expect(res.status).toBe(200);
    });

    it('updates contact group', async () => {
      configure({ data: { id: 'group1', name: 'Leads Updated' }, error: null });
      const req = makeRequest('PUT', 'http://localhost:3500/api/groups/group1', { name: 'Leads Updated' });
      const res = await PUT_GROUP(req, { params: Promise.resolve({ id: 'group1' }) });
      expect(res.status).toBe(200);
    });

    it('deletes contact group', async () => {
      configure({ data: null, error: null });
      const req = makeRequest('DELETE', 'http://localhost:3500/api/groups/group1');
      const res = await DELETE_GROUP(req, { params: Promise.resolve({ id: 'group1' }) });
      expect(res.status).toBe(200);
    });
  });
});
