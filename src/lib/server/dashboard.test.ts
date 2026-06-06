import { describe, expect, it, vi } from 'vitest';
import { getDashboardSnapshots } from './dashboard';

const fetchers = vi.hoisted(() => ({ github: vi.fn(), steam: vi.fn(), thunderstore: vi.fn() }));

const DAY_MS = 86_400_000;
const PRIOR_TS = DAY_MS; // 24h ago in test space
const LATEST_TS = 2 * DAY_MS; // "now" in test space
const EVENT_TS = LATEST_TS + DAY_MS; // events after the latest metric
const STATUS_TS = LATEST_TS + 2 * DAY_MS;
const SINCE_TS = PRIOR_TS - 500;

vi.mock('$lib/sources/registry', () => ({
  sources: [
    {
      id: 'github-glockyco',
      identity: 'glockyco',
      name: 'GitHub @glockyco',
      category: 'platform',
      cadenceHours: 1,
      fetcher: fetchers.github,
      config: {}
    },
    {
      id: 'steam-reviews-ak',
      identity: 'WoW_Much',
      name: 'Steam Reviews: AK',
      category: 'platform',
      cadenceHours: 1,
      fetcher: fetchers.steam,
      config: { appid: '123' }
    },
    {
      id: 'thunderstore-wowmuch',
      identity: 'WoW_Much',
      name: 'Thunderstore: WoW_Much',
      category: 'platform',
      cadenceHours: 1,
      fetcher: fetchers.thunderstore,
      config: { namespace: 'WoW_Much' }
    }
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
    const rows = [
      {
        source_id: 'github-glockyco',
        metric: 'followers',
        ts: PRIOR_TS,
        value: 10,
        dimensions: null
      },
      {
        source_id: 'github-glockyco',
        metric: 'followers',
        ts: LATEST_TS,
        value: 12,
        dimensions: null
      },
      {
        source_id: 'github-glockyco',
        metric: 'followers',
        ts: EVENT_TS,
        value: 99,
        dimensions: '{"repo":"sample"}'
      },
      {
        source_id: 'github-glockyco',
        metric: 'total_stars',
        ts: LATEST_TS,
        value: 30,
        dimensions: null
      },
      {
        source_id: 'github-glockyco',
        metric: 'contributions',
        ts: PRIOR_TS,
        value: 1,
        dimensions: null
      },
      {
        source_id: 'github-glockyco',
        metric: 'contributions',
        ts: LATEST_TS,
        value: 2,
        dimensions: null
      },
      { source_id: 'thunderstore-wowmuch', metric: 'total_downloads', ts: PRIOR_TS, value: 1787, dimensions: null },
      { source_id: 'thunderstore-wowmuch', metric: 'total_downloads', ts: LATEST_TS, value: 1802, dimensions: null },
      { source_id: 'thunderstore-wowmuch', metric: 'package_count', ts: LATEST_TS, value: 4, dimensions: null },
      {
        source_id: 'thunderstore-wowmuch',
        metric: 'package_downloads',
        ts: PRIOR_TS,
        value: 500,
        dimensions: '{"package":"MapPins"}'
      },
      {
        source_id: 'thunderstore-wowmuch',
        metric: 'package_downloads',
        ts: LATEST_TS,
        value: 510,
        dimensions: '{"package":"MapPins"}'
      },
      {
        source_id: 'thunderstore-wowmuch',
        metric: 'package_downloads',
        ts: PRIOR_TS,
        value: 1280,
        dimensions: '{"package":"BigMod"}'
      },
      {
        source_id: 'thunderstore-wowmuch',
        metric: 'package_downloads',
        ts: LATEST_TS,
        value: 1292,
        dimensions: '{"package":"BigMod"}'
      }
    ];
    const since = Number(params.at(-1));
    return rows.filter((row) => {
      const matchesDimensions = sql.includes('dimensions IS NOT NULL')
        ? row.dimensions !== null
        : sql.includes('dimensions IS NULL')
          ? row.dimensions === null
          : true;
      return params.includes(row.source_id) && params.includes(row.metric) && row.ts >= since && matchesDimensions;
    });
  }
  if (sql.includes('FROM events')) {
    const rows = [
      {
        source_id: 'github-glockyco',
        external_id: 'evt-1',
        ts: EVENT_TS,
        kind: 'release',
        author: 'glockyco',
        title: 'Released a tool',
        url: 'https://example.test/release'
      },
      {
        source_id: 'steam-reviews-ak',
        external_id: 'evt-2',
        ts: STATUS_TS,
        kind: 'announcement',
        author: 'developer',
        title: 'Non-review update',
        url: 'https://example.test/update'
      },
      {
        source_id: 'steam-reviews-ak',
        external_id: 'evt-3',
        ts: EVENT_TS + DAY_MS / 2,
        kind: 'review',
        author: 'player',
        title: 'Recommended',
        url: 'https://example.test/review'
      }
    ];
    return rows.filter(
      (row) => params.includes(row.source_id) && (!params.includes('review') || row.kind === 'review')
    );
  }
  if (sql.includes('FROM fetcher_runs')) {
    return params.includes('github-glockyco')
      ? [
          {
            source_id: 'github-glockyco',
            last_run_at: STATUS_TS,
            last_success_at: STATUS_TS,
            last_status: 'success',
            last_error: null,
            consecutive_failures: 0
          }
        ]
      : [];
  }
  return [];
}

function rowForFirst(params: unknown[]) {
  if (params[0] === 'github-glockyco')
    return {
      last_run_at: STATUS_TS,
      last_success_at: STATUS_TS,
      last_status: 'success',
      last_error: null,
      consecutive_failures: 0
    };
  return null;
}

describe('getDashboardSnapshots', () => {
  it('builds tile snapshots with latest metrics, sparklines, events, and status', async () => {
    const { db, calls } = dashboardDb();

    const snapshots = await getDashboardSnapshots(db, {
      identity: 'glockyco',
      since: SINCE_TS
    });

    expect(snapshots).toEqual([
      {
        source: {
          id: 'github-glockyco',
          identity: 'glockyco',
          name: 'GitHub @glockyco',
          category: 'platform',
          cadenceHours: 1,
          config: {}
        },
        metrics: [
          { metric: 'followers', value: 12, previousValue: 10, delta: 2 },
          {
            metric: 'total_stars',
            value: 30,
            previousValue: null,
            delta: null
          },
          {
            metric: 'public_repos',
            value: null,
            previousValue: null,
            delta: null
          }
        ],
        sparkline: [
          { ts: PRIOR_TS, value: 1 },
          { ts: LATEST_TS, value: 2 }
        ],
        latestEvents: [
          {
            ts: EVENT_TS,
            kind: 'release',
            author: 'glockyco',
            title: 'Released a tool',
            url: 'https://example.test/release'
          }
        ],
        status: {
          last_run_at: STATUS_TS,
          last_success_at: STATUS_TS,
          last_status: 'success',
          last_error: null,
          consecutive_failures: 0
        },
        breakdown: null
      }
    ]);
    expect(calls.filter((call) => call.sql.includes('FROM metric_points'))).toHaveLength(1);
    expect(calls.find((call) => call.sql.includes('FROM metric_points'))?.params).toContain(SINCE_TS);
  });

  it('returns empty metric values, event-kind filtered events, and default status when a source has no metric rows yet', async () => {
    const { db } = dashboardDb();

    const snapshots = await getDashboardSnapshots(db, {
      identity: 'WoW_Much',
      since: SINCE_TS
    });

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].metrics[0]).toEqual({
      metric: 'review_total',
      value: null,
      previousValue: null,
      delta: null
    });
    expect(snapshots[0].sparkline).toEqual([]);
    expect(snapshots[0].latestEvents).toEqual([
      {
        ts: EVENT_TS + DAY_MS / 2,
        kind: 'review',
        author: 'player',
        title: 'Recommended',
        url: 'https://example.test/review'
      }
    ]);
    expect(snapshots[0].status).toEqual({
      last_run_at: null,
      last_success_at: null,
      last_status: null,
      last_error: null,
      consecutive_failures: 0
    });
  });

  it('builds a per-package breakdown for sources configured with one', async () => {
    const { db, calls } = dashboardDb();

    const snapshots = await getDashboardSnapshots(db, { identity: 'WoW_Much', since: SINCE_TS });
    const thunderstore = snapshots.find((snapshot) => snapshot.source.id === 'thunderstore-wowmuch');
    const steam = snapshots.find((snapshot) => snapshot.source.id === 'steam-reviews-ak');

    expect(steam?.breakdown).toBeNull();
    expect(thunderstore?.breakdown).toEqual({
      metric: 'package_downloads',
      dimension: 'package',
      label: 'Downloads per mod',
      items: [
        {
          key: 'BigMod',
          latest: { metric: 'package_downloads', value: 1292, previousValue: 1280, delta: 12 },
          points: [
            { ts: PRIOR_TS, value: 1280 },
            { ts: LATEST_TS, value: 1292 }
          ]
        },
        {
          key: 'MapPins',
          latest: { metric: 'package_downloads', value: 510, previousValue: 500, delta: 10 },
          points: [
            { ts: PRIOR_TS, value: 500 },
            { ts: LATEST_TS, value: 510 }
          ]
        }
      ]
    });
    const breakdownCall = calls.find((call) => call.sql.includes('dimensions IS NOT NULL'));
    expect(breakdownCall?.sql).toContain('FROM metric_points');
    expect(breakdownCall?.params).toEqual(['thunderstore-wowmuch', 'package_downloads', SINCE_TS]);
  });
});
