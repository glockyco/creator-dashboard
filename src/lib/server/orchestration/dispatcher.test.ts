import { describe, expect, it, vi } from 'vitest';
import { dispatchDueSources } from './dispatcher';

vi.mock('$lib/sources/registry', () => ({
  sources: [
    { id: 'source-a', name: 'A', identity: 'glockyco', category: 'platform', cadenceHours: 1, fetcher: async () => ({ metric_points: [], events: [] }), config: {} },
    { id: 'source-b', name: 'B', identity: 'WoW_Much', category: 'analytics', cadenceHours: 24, fetcher: async () => ({ metric_points: [], events: [] }), config: {} }
  ]
}));

describe('dispatchDueSources', () => {
  it('sends one queue message per configured source', async () => {
    const sendBatch = vi.fn().mockResolvedValue(undefined);
    const env = { FETCHER_QUEUE: { sendBatch } } as unknown as Env;

    await expect(dispatchDueSources(env, 1714838400000)).resolves.toBe(2);

    expect(sendBatch).toHaveBeenCalledWith([
      { body: { source_id: 'source-a', dispatch_ts: 1714838400000, force: false } },
      { body: { source_id: 'source-b', dispatch_ts: 1714838400000, force: false } }
    ]);
  });

  it('can dispatch only selected sources for smoke verification', async () => {
    const sendBatch = vi.fn().mockResolvedValue(undefined);
    const env = { FETCHER_QUEUE: { sendBatch } } as unknown as Env;

    const count = await dispatchDueSources(env, 123, { sourceIds: ['source-b'] });

    expect(count).toBe(1);
    expect(sendBatch).toHaveBeenCalledWith([{ body: { source_id: 'source-b', dispatch_ts: 123, force: false } }]);
  });
});
