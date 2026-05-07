import { describe, expect, it, vi } from 'vitest';
import { getTimeline } from './timeline';

const { fetcher } = vi.hoisted(() => ({ fetcher: vi.fn() }));

vi.mock('$lib/sources/registry', () => ({
  sources: [
    { id: 'github-glockyco', identity: 'glockyco', name: 'GitHub @glockyco', category: 'platform', cadenceHours: 1, fetcher, config: {} },
    { id: 'steam-reviews-erenshor', identity: 'WoW_Much', name: 'Steam Reviews: Erenshor', category: 'event_feed', cadenceHours: 1, fetcher, config: { appid: '2382520' } }
  ]
}));

vi.mock('$lib/sources/metrics', () => ({
  sourceMetrics: {
    'github-glockyco': { primary: ['followers'], sparkline: 'followers' },
    'steam-reviews-erenshor': { primary: ['review_total'], sparkline: 'review_total', eventKind: 'review' }
  }
}));

type Call = { sql: string; params: unknown[] };

function timelineDb() {
  const calls: Call[] = [];
  const prepare = vi.fn((sql: string) => ({
    bind: (...params: unknown[]) => {
      calls.push({ sql, params });
      return { all: async () => ({ results: rowsFor(sql) }) };
    }
  }));
  return { db: { prepare } as unknown as D1Database, calls };
}

function rowsFor(sql: string) {
  if (sql.includes('FROM metric_points')) {
    return [
      { source_id: 'github-glockyco', metric: 'followers', ts: 1_000, value: 10, dimensions: null },
      { source_id: 'steam-reviews-erenshor', metric: 'review_total', ts: 2_000, value: 7, dimensions: '{"appid":"2382520"}' }
    ];
  }
  if (sql.includes('FROM events')) {
    return [{ source_id: 'steam-reviews-erenshor', external_id: 'review-1', ts: 2_500, kind: 'review', author: 'player', title: 'Great update', body: 'Loved it', url: 'https://example.test/review', metadata: '{"rating":"positive"}' }];
  }
  if (sql.includes('FROM posts_index')) {
    return [{ slug: 'release-notes', posted_at: 1_500, author: 'glockyco', title: 'Release notes', url: 'https://example.test/post', source_id: 'github-glockyco' }];
  }
  return [];
}

describe('getTimeline', () => {
  it('reads metric points, events, and related posts for selected sources and date range', async () => {
    const { db, calls } = timelineDb();

    const timeline = await getTimeline(db, {
      since: '2026-04-01',
      until: '2026-05-04',
      sinceTs: 1_000,
      untilTs: 3_000,
      sourceIds: ['github-glockyco', 'steam-reviews-erenshor'],
      overlays: ['posts', 'events']
    });

    expect(timeline.sources.map((source) => source.id)).toEqual(['github-glockyco', 'steam-reviews-erenshor']);
    expect(timeline.metricSeries).toEqual([
      { source_id: 'github-glockyco', metric: 'followers', points: [{ ts: 1_000, value: 10, dimensions: null }] },
      { source_id: 'steam-reviews-erenshor', metric: 'review_total', points: [{ ts: 2_000, value: 7, dimensions: { appid: '2382520' } }] }
    ]);
    expect(timeline.events).toEqual([{ source_id: 'steam-reviews-erenshor', external_id: 'review-1', ts: 2_500, kind: 'review', author: 'player', title: 'Great update', body: 'Loved it', url: 'https://example.test/review', metadata: { rating: 'positive' } }]);
    expect(timeline.posts).toEqual([{ slug: 'release-notes', posted_at: 1_500, author: 'glockyco', title: 'Release notes', url: 'https://example.test/post', source_id: 'github-glockyco' }]);
    expect(calls.map((call) => call.params)).toEqual([
      ['github-glockyco', 'steam-reviews-erenshor', 1_000, 3_000],
      ['github-glockyco', 'steam-reviews-erenshor', 1_000, 3_000],
      ['github-glockyco', 'steam-reviews-erenshor', 1_000, 3_000]
    ]);
    expect(calls[2].sql).toContain('JOIN posts_sources');
  });
});
