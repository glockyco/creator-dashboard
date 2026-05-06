import { describe, expect, it, vi } from 'vitest';
import { getDashboardSnapshots } from './dashboard';

const fetchers = vi.hoisted(() => ({ github: vi.fn(), steam: vi.fn() }));

vi.mock('$lib/sources/registry', () => ({
  sources: [
    { id: 'github-glockyco', identity: 'glockyco', name: 'GitHub @glockyco', category: 'platform', cadenceHours: 1, fetcher: fetchers.github, config: {} },
    { id: 'steam-guide-erenshor', identity: 'WoW_Much', name: 'Steam Guide: Erenshor Maps', category: 'platform', cadenceHours: 1, fetcher: fetchers.steam, config: { publishedfileid: '3500398991' } }
  ]
}));

type PreparedCall = { sql: string; params: unknown[] };

function dashboardDb() {
  const calls: PreparedCall[] = [];
  const prepare = vi.fn((sql: string) => ({
    bind: (...params: unknown[]) => {
      calls.push({ sql, params });
      return {
        all: async () => ({ results: rowsForAll(sql, params) }),
        first: async () => rowForFirst(params)
      };
    }
  }));
  return { db: { prepare } as unknown as D1Database, calls, prepare };
}

function rowsForAll(sql: string, params: unknown[]) {
  if (sql.includes('FROM metric_points')) {
    const metric = params[1];
    if (metric === 'followers') return [{ source_id: 'github-glockyco', metric: 'followers', ts: 1_000, value: 10, dimensions: null }, { source_id: 'github-glockyco', metric: 'followers', ts: 2_000, value: 12, dimensions: null }];
    if (metric === 'total_stars') return [{ source_id: 'github-glockyco', metric: 'total_stars', ts: 2_000, value: 30, dimensions: null }];
    if (metric === 'contributions') return [{ source_id: 'github-glockyco', metric: 'contributions', ts: 1_000, value: 1, dimensions: null }, { source_id: 'github-glockyco', metric: 'contributions', ts: 2_000, value: 2, dimensions: null }];
    return [];
  }
  if (sql.includes('FROM events') && params[0] === 'github-glockyco') {
    return [{ source_id: 'github-glockyco', external_id: 'evt-1', ts: 3_000, kind: 'release', author: 'glockyco', title: 'Released a tool', url: 'https://example.test/release' }];
  }
  return [];
}

function rowForFirst(params: unknown[]) {
  if (params[0] === 'github-glockyco') return { last_run_at: 4_000, last_success_at: 4_000, last_status: 'success', last_error: null, consecutive_failures: 0 };
  return null;
}

describe('getDashboardSnapshots', () => {
  it('builds tile snapshots with latest metrics, sparklines, events, and status', async () => {
    const { db, calls } = dashboardDb();

    const snapshots = await getDashboardSnapshots(db, { identity: 'glockyco', since: 500 });

    expect(snapshots).toEqual([
      {
        source: { id: 'github-glockyco', identity: 'glockyco', name: 'GitHub @glockyco', category: 'platform', cadenceHours: 1, config: {} },
        metrics: [
          { metric: 'followers', value: 12, previousValue: 10, delta: 2 },
          { metric: 'total_stars', value: 30, previousValue: null, delta: null },
          { metric: 'public_repos', value: null, previousValue: null, delta: null }
        ],
        sparkline: [
          { ts: 1_000, value: 1 },
          { ts: 2_000, value: 2 }
        ],
        latestEvents: [{ ts: 3_000, kind: 'release', author: 'glockyco', title: 'Released a tool', url: 'https://example.test/release' }],
        status: { last_run_at: 4_000, last_success_at: 4_000, last_status: 'success', last_error: null, consecutive_failures: 0 }
      }
    ]);
    expect(calls.filter((call) => call.sql.includes('FROM metric_points')).map((call) => call.params[2])).toEqual([500, 500, 500, 500]);
  });

  it('returns empty values and default status when a source has no rows yet', async () => {
    const { db } = dashboardDb();

    const snapshots = await getDashboardSnapshots(db, { identity: 'WoW_Much', since: 500 });

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].metrics[0]).toEqual({ metric: 'views', value: null, previousValue: null, delta: null });
    expect(snapshots[0].sparkline).toEqual([]);
    expect(snapshots[0].latestEvents).toEqual([]);
    expect(snapshots[0].status).toEqual({ last_run_at: null, last_success_at: null, last_status: null, last_error: null, consecutive_failures: 0 });
  });
});
