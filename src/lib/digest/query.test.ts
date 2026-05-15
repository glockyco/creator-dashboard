import { describe, expect, it, vi } from 'vitest';
import { getDigestData } from './query';

type QueryCall = { sql: string; params: unknown[] };

function digestDb() {
  const calls: QueryCall[] = [];
  const prepare = vi.fn((sql: string) => ({
    all: async () => ({ results: rowsFor(sql, []) }),
    bind: (...params: unknown[]) => {
      calls.push({ sql, params });
      return { all: async () => ({ results: rowsFor(sql, params) }) };
    }
  }));
  return { db: { prepare } as unknown as D1Database, calls };
}

function rowsFor(sql: string, params: unknown[]) {
  const [start, end] = params;
  if (sql.includes('FROM metric_points')) {
    return [
      { source_id: 'github-glockyco', metric: 'followers', ts: start, value: 12, dimensions: null },
      { source_id: 'github-glockyco', metric: 'followers', ts: Number(end) - 1, value: 13, dimensions: null },
      {
        source_id: 'github-glockyco',
        metric: 'followers',
        ts: Number(end) - 1,
        value: 99,
        dimensions: '{"country":"AT"}'
      }
    ];
  }
  if (sql.includes('FROM events')) {
    return [
      {
        source_id: 'steam-reviews-ak',
        external_id: 'review-1',
        ts: Number(end) - 2,
        kind: 'review',
        author: null,
        title: 'Good',
        url: 'https://example.test/review'
      }
    ];
  }
  if (sql.includes('FROM posts_index')) {
    return [
      {
        slug: 'post-1',
        posted_at: Number(end) - 3,
        author: 'glockyco',
        platform: 'site',
        url: 'https://example.test/post',
        title: 'Post title',
        tags: '["dev"]',
        body_excerpt: 'Excerpt'
      }
    ];
  }
  if (sql.includes('FROM fetcher_runs')) {
    return [
      {
        source_id: 'github-glockyco',
        last_run_at: Number(end) - 4,
        last_success_at: Number(end) - 4,
        last_status: 'success',
        last_error: null,
        consecutive_failures: 0
      }
    ];
  }
  if (sql.includes('FROM fetcher_failures')) {
    return [
      {
        source_id: 'gsc-ak-compendium',
        ts: Number(end) - 5,
        tier: 'permanent',
        status_code: 403,
        error_message: 'forbidden'
      }
    ];
  }
  return [];
}

describe('getDigestData', () => {
  it('reads a 48h metric window and a 24h event/post/failure window', async () => {
    const { db, calls } = digestDb();
    const now = new Date('2026-05-10T06:00:00.000Z');

    const snapshot = await getDigestData(db, now);

    const start = Date.parse('2026-05-09T06:00:00.000Z');
    const end = Date.parse('2026-05-10T06:00:00.000Z');
    const metricStart = Date.parse('2026-05-08T06:00:00.000Z');

    const metricCall = calls.find((call) => call.sql.includes('FROM metric_points'));
    expect(metricCall).toMatchObject({ params: [metricStart, end] });
    expect(metricCall?.sql).toContain('dimensions IS NULL');

    const eventCall = calls.find((call) => call.sql.includes('FROM events'));
    expect(eventCall).toMatchObject({ params: [start, end] });

    const postCall = calls.find((call) => call.sql.includes('FROM posts_index'));
    expect(postCall).toMatchObject({ params: [start, end] });

    const failureCall = calls.find((call) => call.sql.includes('FROM fetcher_failures'));
    expect(failureCall).toMatchObject({ params: [start, end] });

    expect(snapshot.window).toEqual({ start, end });
    expect(snapshot.metrics).toEqual([
      { source_id: 'github-glockyco', metric: 'followers', ts: metricStart, value: 12 },
      { source_id: 'github-glockyco', metric: 'followers', ts: end - 1, value: 13 }
    ]);
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.posts[0]).toMatchObject({ title: 'Post title', tags: ['dev'] });
    expect(snapshot.runs[0]).toMatchObject({ source_id: 'github-glockyco', last_status: 'success' });
    expect(snapshot.failures[0]).toMatchObject({ tier: 'permanent', status_code: 403 });
  });
});
