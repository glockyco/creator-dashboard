import { describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

vi.mock('$lib/sources/registry', () => ({
  getSource: (sourceId: string) => (sourceId === 'source-a' ? { id: 'source-a' } : undefined)
}));

vi.mock('$lib/server/source-detail', () => ({
  getSourceEvents: vi.fn(async (_db, sourceId, options) => ({
    items: [
      {
        source_id: sourceId,
        external_id: 'evt-1',
        ts: 1000,
        kind: options.kind ?? 'event',
        author: null,
        title: 'Event',
        body: null,
        url: null,
        metadata: null
      }
    ],
    nextCursor: null
  }))
}));

describe('GET /api/sources/[source_id]/events', () => {
  it('returns 404 for unknown source IDs', async () => {
    await expect(
      GET({
        params: { source_id: 'missing' },
        platform: { env: { DB: {} } },
        url: new URL('https://dashboard.test/api/sources/missing/events')
      } as never)
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns paginated events for known sources', async () => {
    const response = await GET({
      params: { source_id: 'source-a' },
      platform: { env: { DB: {} } },
      url: new URL('https://dashboard.test/api/sources/source-a/events?cursor=2000&kind=review')
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [
        {
          source_id: 'source-a',
          external_id: 'evt-1',
          ts: 1000,
          kind: 'review',
          author: null,
          title: 'Event',
          body: null,
          url: null,
          metadata: null
        }
      ],
      nextCursor: null
    });
  });
});
