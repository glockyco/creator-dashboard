import { sources, type SourceDef } from '$lib/sources/registry';
import { sourceMetrics } from '$lib/sources/metrics';
import type { IdentityFilter } from '$lib/types/domain';
import type { FetcherStatus, LatestEvent, LatestMetric, SparkPoint, TileSnapshot } from '$lib/dashboard/types';

export type DashboardFilters = {
  identity?: IdentityFilter;
  since?: number;
};

type MetricPointRow = {
  source_id: string;
  metric: string;
  ts: number;
  value: number;
  dimensions: string | null;
};

type EventRow = {
  source_id: string;
  external_id: string;
  ts: number;
  kind: string;
  author: string | null;
  title: string | null;
  url: string | null;
};

const defaultWindowMs = 30 * 24 * 3_600_000;
const emptyStatus: FetcherStatus = { last_run_at: null, last_success_at: null, last_status: null, last_error: null, consecutive_failures: 0 };

export async function getDashboardSnapshots(db: D1Database, filters: DashboardFilters = {}): Promise<TileSnapshot[]> {
  const since = filters.since ?? Date.now() - defaultWindowMs;
  const visibleSources = sources.filter((source) => (filters.identity && filters.identity !== 'all' ? source.identity === filters.identity : true));
  const snapshots: TileSnapshot[] = [];

  for (const source of visibleSources) {
    const metrics = sourceMetrics[source.id];
    if (!metrics) continue;

    const primary = [] as LatestMetric[];
    for (const metric of metrics.primary) {
      primary.push(toLatestMetric(metric, await metricRows(db, source.id, metric, since)));
    }

    snapshots.push({
      source: withoutFetcher(source),
      metrics: primary,
      sparkline: toSparkline(await metricRows(db, source.id, metrics.sparkline, since)),
      latestEvents: await latestEvents(db, source.id),
      status: (await fetcherStatus(db, source.id)) ?? emptyStatus
    });
  }

  return snapshots;
}

async function metricRows(db: D1Database, sourceId: string, metric: string, since: number): Promise<MetricPointRow[]> {
  const result = await db
    .prepare(
      `SELECT source_id, metric, ts, value, dimensions
       FROM metric_points
       WHERE source_id = ? AND metric = ? AND ts >= ?
       ORDER BY ts ASC`
    )
    .bind(sourceId, metric, since)
    .all<MetricPointRow>();
  return result.results ?? [];
}

async function latestEvents(db: D1Database, sourceId: string): Promise<LatestEvent[]> {
  const result = await db
    .prepare(
      `SELECT source_id, external_id, ts, kind, author, title, url
       FROM events
       WHERE source_id = ?
       ORDER BY ts DESC
       LIMIT 3`
    )
    .bind(sourceId)
    .all<EventRow>();
  return (result.results ?? []).map((row) => ({ ts: row.ts, kind: row.kind, title: row.title, author: row.author, url: row.url }));
}

async function fetcherStatus(db: D1Database, sourceId: string): Promise<FetcherStatus | null> {
  return await db
    .prepare(
      `SELECT last_run_at, last_success_at, last_status, last_error, consecutive_failures
       FROM fetcher_runs
       WHERE source_id = ?`
    )
    .bind(sourceId)
    .first<FetcherStatus>();
}

function toLatestMetric(metric: string, rows: MetricPointRow[]): LatestMetric {
  const latest = rows.at(-1);
  const previous = rows.at(-2);
  return {
    metric,
    value: latest?.value ?? null,
    previousValue: previous?.value ?? null,
    delta: latest && previous ? latest.value - previous.value : null
  };
}

function toSparkline(rows: MetricPointRow[]): SparkPoint[] {
  return rows.map((row) => ({ ts: row.ts, value: row.value }));
}

function withoutFetcher(source: SourceDef): Omit<SourceDef, 'fetcher'> {
  const { fetcher: _fetcher, ...serializable } = source;
  return serializable;
}
