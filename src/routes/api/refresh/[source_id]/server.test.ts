import { describe, expect, it, vi } from 'vitest';
import { POST } from './+server';

vi.mock('$lib/sources/registry', () => ({
  getSource: (sourceId: string) => (sourceId === 'source-a' ? { id: 'source-a' } : undefined)
}));

describe('POST /api/refresh/[source_id]', () => {
  it('returns 404 for unknown source IDs', async () => {
    await expect(
      POST({ params: { source_id: 'missing' }, platform: { env: { FETCHER_QUEUE: { send: vi.fn() } } } } as never)
    ).rejects.toMatchObject({ status: 404 });
  });

  it('queues a forced refresh for known source IDs', async () => {
    const send = vi.fn().mockResolvedValue(undefined);

    const response = await POST({
      params: { source_id: 'source-a' },
      platform: { env: { FETCHER_QUEUE: { send } } }
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ queued: true });
    expect(send).toHaveBeenCalledWith({ source_id: 'source-a', dispatch_ts: expect.any(Number), force: true });
  });
});
