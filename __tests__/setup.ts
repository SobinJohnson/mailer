/**
 * Global test setup file.
 * Runs before every test file.
 */

import { vi } from 'vitest';

// ─── Mock next/headers (used in ensureSystemSettings) ─────────────────────────
vi.mock('next/headers', () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: vi.fn((key: string) => {
        if (key === 'host') return 'localhost:3000';
        return null;
      }),
    })
  ),
  cookies: vi.fn(() =>
    Promise.resolve({
      getAll: vi.fn(() => []),
      set: vi.fn(),
    })
  ),
}));

// ─── Silence console.error in tests unless DEBUG=1 ────────────────────────────
if (!process.env.DEBUG) {
  vi.spyOn(console, 'error').mockImplementation(() => {});
}
