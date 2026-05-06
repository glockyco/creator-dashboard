import { describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

vi.mock('$lib/sources/registry', () => ({
  getSource: (sourceId: string) => (sourceId === 'source-a' ? { id: 'source-a' } : undefined)
}));

describe('GET /api/sources/[source_id]/status', () => {
  it('returns 404 for unknown source IDs', async () => {
    await expect(GET({ params: { source_id: 'missing' }, platform: { env: { DB: { prepare: vi.fn() } } } } as never)).rejects.toMatchObject({ status: 404 });
  });

  it('returns the fetcher status for known sources', async () => {
    const first = vi.fn().mockResolvedValue({ last_run_at: 1000, last_success_at: 900, last_status: 'success', last_error: null, consecutive_failures: 0 });
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn((sql: string) => ({ bind }));

    const response = await GET({ params: { source_id: 'source-a' }, platform: { env: { DB: { prepare } } } } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ last_run_at: 1000, last_success_at: 900, last_status: 'success', last_error: null, consecutive_failures: 0 });
    expect(prepare.mock.calls[0][0]).toContain('FROM fetcher_runs');
    expect(bind).toHaveBeenCalledWith('source-a');
  });

  it('returns empty status when the source has not run yet', async () => {
    const first = vi.fn().mockResolvedValue(null);
    const prepare = vi.fn((_sql: string) => ({ bind: vi.fn(() => ({ first })) }));

    const response = await GET({ params: { source_id: 'source-a' }, platform: { env: { DB: { prepare } } } } as never);

    await expect(response.json()).resolves.toEqual({ last_run_at: null, last_success_at: null, last_status: null, last_error: null, consecutive_failures: 0 });
  });
});
