/**
 * Integration tests for the Contacts API routes.
 *
 * These tests mock the Supabase client to simulate database behaviour
 * without requiring a live Supabase connection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock the supabase server module BEFORE importing route handlers ──────────
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  ensureSystemSettings: vi.fn().mockResolvedValue(undefined),
}));

import { createClient } from '@/lib/supabase/server';
import { GET, POST } from '@/app/api/contacts/route';
import { GET as GET_BY_ID, PUT, DELETE } from '@/app/api/contacts/[id]/route';
import { POST as POST_BULK } from '@/app/api/contacts/bulk/route';

// ─── Helper: build a Request object ──────────────────────────────────────────
function makeRequest(method: string, url: string, body?: Record<string, any>): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ─── Mock builders ────────────────────────────────────────────────────────────

/**
 * Build a mock Supabase client suitable for GET requests (select chain).
 * Supports: .from().select().or().order(), .from().select().order()
 */
function buildSelectMock(result: { data: any; error: any; count?: number | null }) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue(result),
        }),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue(result),
        }),
        order: vi.fn().mockResolvedValue(result),
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

/**
 * Build a mock Supabase client suitable for POST requests (insert chain).
 * Supports: .from().insert([]).select().single()
 */
function buildInsertMock(result: { data: any; error: any }) {
  const resolvedData = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: resolvedData, error: result.error }),
        }),
      }),
    }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with data array when no filters', async () => {
    const contacts = [{ id: 'c1', first_name: 'Alice', email: 'alice@test.com' }];
    vi.mocked(createClient).mockResolvedValue(buildSelectMock({ data: contacts, error: null, count: 1 }) as any);

    const req = makeRequest('GET', 'http://localhost:3500/api/contacts');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('data');
  });

  it('returns 500 when Supabase returns an error', async () => {
    vi.mocked(createClient).mockResolvedValue(buildSelectMock({
      data: null,
      error: { message: 'DB connection refused' },
    }) as any);

    const req = makeRequest('GET', 'http://localhost:3500/api/contacts');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('DB connection refused');
  });
});

describe('POST /api/contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validContact = {
    company_id: '00000000-0000-4000-a000-000000000001',
    first_name: 'Bob',
    email: 'bob@example.com',
  };

  it('returns 201 with created contact on valid input', async () => {
    const createdContact = { id: 'c2', ...validContact };
    vi.mocked(createClient).mockResolvedValue(buildInsertMock({ data: createdContact, error: null }) as any);

    const req = makeRequest('POST', 'http://localhost:3500/api/contacts', validContact);
    const res = await POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data).toMatchObject({ first_name: 'Bob' });
  });

  it('returns 400 when email is invalid (Zod validation)', async () => {
    vi.mocked(createClient).mockResolvedValue(buildInsertMock({ data: null, error: null }) as any);

    const req = makeRequest('POST', 'http://localhost:3500/api/contacts', {
      ...validContact,
      email: 'not-an-email',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(Array.isArray(json.error)).toBe(true); // Zod issues array
  });

  it('returns 400 when first_name is missing', async () => {
    vi.mocked(createClient).mockResolvedValue(buildInsertMock({ data: null, error: null }) as any);

    const req = makeRequest('POST', 'http://localhost:3500/api/contacts', {
      company_id: '00000000-0000-4000-a000-000000000001',
      email: 'test@example.com',
      // first_name omitted
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 409 when email already exists (unique violation)', async () => {
    vi.mocked(createClient).mockResolvedValue(buildInsertMock({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    }) as any);

    const req = makeRequest('POST', 'http://localhost:3500/api/contacts', validContact);
    const res = await POST(req);

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain('already exists');
  });

  it('returns 400 when company_id is not a valid UUID', async () => {
    vi.mocked(createClient).mockResolvedValue(buildInsertMock({ data: null, error: null }) as any);

    const req = makeRequest('POST', 'http://localhost:3500/api/contacts', {
      ...validContact,
      company_id: 'not-a-uuid',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});

describe('GET /api/contacts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with contact detail when found', async () => {
    const contact = { id: 'c2', first_name: 'Bob', email: 'bob@example.com' };
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: contact, error: null }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const req = makeRequest('GET', 'http://localhost:3500/api/contacts/c2');
    const res = await GET_BY_ID(req, { params: Promise.resolve({ id: 'c2' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.first_name).toBe('Bob');
  });

  it('returns 404 when contact is not found', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const req = makeRequest('GET', 'http://localhost:3500/api/contacts/c2');
    const res = await GET_BY_ID(req, { params: Promise.resolve({ id: 'c2' }) });
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/contacts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates contact successfully', async () => {
    const contact = { id: 'c2', first_name: 'Bobby', email: 'bob@example.com' };
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: contact, error: null }),
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const req = makeRequest('PUT', 'http://localhost:3500/api/contacts/c2', { first_name: 'Bobby' });
    const res = await PUT(req, { params: Promise.resolve({ id: 'c2' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.first_name).toBe('Bobby');
  });
});

describe('DELETE /api/contacts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes contact successfully', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const req = makeRequest('DELETE', 'http://localhost:3500/api/contacts/c2');
    const res = await DELETE(req, { params: Promise.resolve({ id: 'c2' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});

describe('POST /api/contacts/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports bulk contacts and maps companies', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [{ id: 'comp-uuid', name: 'Cyberdyne' }],
          error: null,
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const req = makeRequest('POST', 'http://localhost:3500/api/contacts/bulk', {
      contacts: [
        { first_name: 'John', email: 'john@cyberdyne.com', company_name: 'Cyberdyne' },
      ],
    });
    const res = await POST_BULK(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.inserted).toBe(1);
  });
});
