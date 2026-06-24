import { vi } from 'vitest';

/**
 * Creates a chainable Supabase mock that can be configured per-test.
 *
 * Usage:
 *   const { supabase, configure } = createSupabaseMock();
 *   configure({ data: [{ id: '1', name: 'Test' }], error: null });
 *   vi.mocked(createClient).mockResolvedValue(supabase as any);
 */

export interface MockResult {
  data?: any;
  error?: any;
  count?: number | null;
}

export function createSupabaseMock(defaultResult: MockResult = { data: null, error: null }) {
  let result = defaultResult;

  const configure = (newResult: MockResult) => {
    result = newResult;
  };

  // Build a chainable proxy — each method returns itself or a terminal promise
  const terminal = () => Promise.resolve(result);

  const chain: any = new Proxy(
    {},
    {
      get(_target, prop) {
        // Terminal async methods
        if (['single', 'maybeSingle'].includes(prop as string)) {
          return () => Promise.resolve({ ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data });
        }
        if (prop === 'then') return undefined; // Not a Promise itself
        // All other methods return the chain for further chaining
        return (..._args: any[]) => chain;
      },
    }
  );

  // Override terminal points
  const from = vi.fn((_table: string) => ({
    select: vi.fn((..._args: any[]) => ({
      eq: vi.fn((..._args: any[]) => ({
        single: vi.fn(() => Promise.resolve({ data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: result.error })),
        maybeSingle: vi.fn(() => Promise.resolve({ data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: result.error })),
        in: vi.fn((..._args: any[]) => ({
          limit: vi.fn(() => Promise.resolve(result)),
          order: vi.fn(() => Promise.resolve(result)),
          lte: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve(result)) })),
        })),
        order: vi.fn(() => Promise.resolve(result)),
        limit: vi.fn(() => Promise.resolve(result)),
        lte: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve(result)), in: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve(result)) })) })),
      })),
      or: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve(result)),
        eq: vi.fn(() => ({ order: vi.fn(() => Promise.resolve(result)) })),
      })),
      ilike: vi.fn(() => ({ order: vi.fn(() => Promise.resolve(result)) })),
      in: vi.fn(() => ({ order: vi.fn(() => Promise.resolve(result)), limit: vi.fn(() => Promise.resolve(result)), lte: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve(result)) })) })),
      limit: vi.fn(() => Promise.resolve(result)),
      order: vi.fn(() => Promise.resolve(result)),
      lte: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve(result)), in: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve(result)) })) })),
      not: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve(result)) })),
      single: vi.fn(() => Promise.resolve({ data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: result.error })),
    })),
    insert: vi.fn((_data: any) => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: result.error })),
      })),
      then: (resolve: any) => resolve({ data: result.data, error: result.error }),
    })),
    update: vi.fn((_data: any) => ({
      eq: vi.fn(() => Promise.resolve(result)),
    })),
    upsert: vi.fn((_data: any) => Promise.resolve(result)),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve(result)),
    })),
  }));

  const auth = {
    getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
  };

  const supabase = { from, auth };

  return { supabase, configure };
}
