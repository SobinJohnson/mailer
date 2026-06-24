import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockVerify = vi.fn().mockResolvedValue(true);
const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-id' });

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      verify: mockVerify,
      sendMail: mockSendMail,
    })),
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  ensureSystemSettings: vi.fn().mockResolvedValue(undefined),
}));

import { createClient } from '@/lib/supabase/server';
import { createSupabaseMock } from '../helpers/mock-supabase';
import nodemailer from 'nodemailer';
import { GET, POST } from '@/app/api/smtp/route';
import { PUT, DELETE } from '@/app/api/smtp/[id]/route';
import { POST as POST_TEST } from '@/app/api/smtp/test/route';

function makeRequest(method: string, url: string, body?: Record<string, any>): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('SMTP API Routes', () => {
  const { supabase, configure } = createSupabaseMock();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(supabase as any);
  });

  describe('GET /api/smtp', () => {
    it('returns lists of SMTP configurations', async () => {
      configure({ data: [{ id: 'smtp1', label: 'Gmail SMTP' }], error: null });
      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
    });
  });

  describe('POST /api/smtp', () => {
    it('creates new SMTP configuration', async () => {
      configure({ data: { id: 'smtp1', label: 'Gmail SMTP' }, error: null });
      const req = makeRequest('POST', 'http://localhost:3500/api/smtp', {
        label: 'Gmail SMTP',
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        username: 'john@gmail.com',
        password: 'password123',
        from_email: 'john@gmail.com',
        from_name: 'John',
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
    });
  });

  describe('PUT /api/smtp/[id]', () => {
    it('updates SMTP configurations', async () => {
      configure({ data: { id: 'smtp1', label: 'Outlook SMTP' }, error: null });
      const req = makeRequest('PUT', 'http://localhost:3500/api/smtp/smtp1', {
        label: 'Outlook SMTP',
      });
      const res = await PUT(req, { params: Promise.resolve({ id: 'smtp1' }) });
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/smtp/[id]', () => {
    it('deletes SMTP configurations successfully', async () => {
      configure({ data: null, error: null });
      const req = makeRequest('DELETE', 'http://localhost:3500/api/smtp/smtp1');
      const res = await DELETE(req, { params: Promise.resolve({ id: 'smtp1' }) });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/smtp/test', () => {
    it('succeeds when SMTP credentials are valid', async () => {
      mockVerify.mockResolvedValue(true);
      mockSendMail.mockResolvedValue({ messageId: 'test-id' });

      const req = makeRequest('POST', 'http://localhost:3500/api/smtp/test', {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        username: 'john@gmail.com',
        password: 'password123',
        from_email: 'john@gmail.com',
        from_name: 'John',
      });
      const res = await POST_TEST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('fails connection test when verification fails', async () => {
      mockVerify.mockRejectedValue(new Error('Invalid login: 535'));

      const req = makeRequest('POST', 'http://localhost:3500/api/smtp/test', {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        username: 'john@gmail.com',
        password: 'wrongpassword',
        from_email: 'john@gmail.com',
        from_name: 'John',
      });
      const res = await POST_TEST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.toLowerCase()).toContain('authentication failed');
    });
  });
});
