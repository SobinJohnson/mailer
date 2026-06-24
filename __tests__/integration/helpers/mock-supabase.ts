import { vi } from 'vitest';

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

  // The QueryBuilder Proxy handles all database builder method chaining (select, eq, order, limit, insert, update, delete, etc.)
  const queryBuilderHandler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      if (prop === 'then') {
        // When the query is directly awaited (e.g. const { data } = await query)
        return (resolve: any, reject: any) => {
          return Promise.resolve(result).then(resolve, reject);
        };
      }
      if (prop === 'single' || prop === 'maybeSingle') {
        // When terminated with .single() or .maybeSingle()
        return () => {
          const resolvedData = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
          return Promise.resolve({ data: resolvedData, error: result.error });
        };
      }
      // Every other database chain method returns a function returning the query builder itself
      return () => receiver;
    }
  };

  const queryBuilder = new Proxy({}, queryBuilderHandler);

  // The Client Proxy handles properties accessed directly on the client (from, auth, storage, etc.)
  const clientHandler: ProxyHandler<any> = {
    get(target, prop) {
      if (prop === 'then') {
        return undefined; // NOT thenable (prevents await createClient() from calling .then and resolving to data)
      }
      if (prop === 'auth') {
        return {
          getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'mock-user-id' } }, error: null })),
        };
      }
      if (prop === 'storage') {
        return {
          from: vi.fn(() => ({
            upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
            createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://test-signed-url' }, error: null }),
          })),
        };
      }
      // Any other method accessed on client (like .from()) returns a function returning the queryBuilder
      return () => queryBuilder;
    }
  };

  const supabase = new Proxy({}, clientHandler);

  return { supabase, configure };
}
