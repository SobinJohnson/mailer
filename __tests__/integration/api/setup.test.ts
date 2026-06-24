import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ isDirectory: () => false }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({ data: [{ id: 'org1' }], error: null }),
      })),
    })),
  })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user1' } }, error: null }),
    },
  })),
  createServiceClient: vi.fn(),
  ensureSystemSettings: vi.fn().mockResolvedValue(undefined),
}));

import { POST as POST_SAVE } from '@/app/api/setup/save/route';
import { POST as POST_TEST } from '@/app/api/setup/test/route';
import { POST as POST_GENERATE_KEYS } from '@/app/api/setup/generate-keys/route';
import { GET as GET_DOWNLOAD_DOCKER } from '@/app/api/setup/download-docker/route';

function makeRequest(method: string, url: string, body?: Record<string, any>): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Setup API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/setup/save', () => {
    it('saves setup config values into .env.local file', async () => {
      const req = makeRequest('POST', 'http://localhost:3500/api/setup/save', {
        url: 'https://new-project.supabase.co',
        anonKey: 'anon-key-abc',
        serviceKey: 'service-key-xyz',
      });
      const res = await POST_SAVE(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe('POST /api/setup/test', () => {
    it('succeeds on successful schema table validation checks', async () => {
      const req = makeRequest('POST', 'http://localhost:3500/api/setup/test', {
        url: 'https://new-project.supabase.co',
        anonKey: 'anon-key-abc',
        serviceKey: 'service-key-xyz',
      });
      const res = await POST_TEST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe('POST /api/setup/generate-keys', () => {
    it('generates secure random secret and signed JWT key rings', async () => {
      const res = await POST_GENERATE_KEYS();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('jwtSecret');
      expect(json).toHaveProperty('anonKey');
      expect(json).toHaveProperty('serviceRoleKey');
    });
  });

  describe('GET /api/setup/download-docker', () => {
    it('compiles and downloads docker setup zip', async () => {
      const res = await GET_DOWNLOAD_DOCKER();
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/zip');
    });
  });
});
