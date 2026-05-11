import { sources, type SourceDef } from "$lib/sources/registry";
import { sourceMetrics } from "$lib/sources/metrics";
import type { IdentityFilter } from "$lib/types/domain";
import type {
  FetcherStatus,
  LatestEvent,
  LatestMetric,
  SparkPoint,
  TileSnapshot,
} from "$lib/dashboard/types";

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
const emptyStatus: FetcherStatus = {
  last_run_at: null,
  last_success_at: null,
  last_status: null,
  last_error: null,
  consecutive_failures: 0,
};

export async function getDashboardSnapshots(
  db: D1Database,
  filters: DashboardFilters = {},
): Promise<TileSnapshot[]> {
  const since = filters.since ?? Date.now() - defaultWindowMs;
  const visibleSources = sources.filter((source) =>
    filters.identity && filters.identity !== "all"
      ? source.identity === filters.identity
      : true,
  );
  const visibleConfigs = visibleSources
    .map((source) => ({ source, metrics: sourceMetrics[source.id] }))
    .filter(
      (
        entry,
      ): entry is {
        source: SourceDef;
        metrics: NonNullable<(typeof sourceMetrics)[string]>;
      } => Boolean(entry.metrics),
    );

  if (visibleConfigs.length === 0) return [];
  const snapshots: TileSnapshot[] = [];

  const [metricRowsResult, eventRows, statusRows] = await Promise.all([
    metricRows(db, visibleConfigs, since),
    latestEvents(db, visibleConfigs),
    fetcherStatuses(
      db,
      visibleConfigs.map(({ source }) => source.id),
    ),
  ]);
  const metricRowsByKey = groupMetricRows(metricRowsResult);
  const eventsBySource = groupBySource(eventRows);
  const statusBySource = groupStatusRows(statusRows);

  for (const { source, metrics } of visibleConfigs) {
    const primary = metrics.primary.map((metric) =>
      toLatestMetric(
        metric,
        metricRowsByKey.get(metricKey(source.id, metric)) ?? [],
      ),
    );

    snapshots.push({
      source: withoutFetcher(source),
      metrics: primary,
      sparkline: toSparkline(
        metricRowsByKey.get(metricKey(source.id, metrics.sparkline)) ?? [],
      ),
      latestEvents: (eventsBySource.get(source.id) ?? []).map(toLatestEvent),
      status: statusBySource.get(source.id) ?? emptyStatus,
    });
  }

  return snapshots;
}

async function metricRows(
  db: D1Database,
  entries: {
    source: SourceDef;
    metrics: NonNullable<(typeof sourceMetrics)[string]>;
  }[],
  since: number,
): Promise<MetricPointRow[]> {
  const sourceIds = entries.map(({ source }) => source.id);
  const metricNames = [
    ...new Set(
      entries.flatMap(({ metrics }) => [...metrics.primary, metrics.sparkline]),
    ),
  ];
  const result = await db
    .prepare(
      `SELECT source_id, metric, ts, value, dimensions
       FROM metric_points
       WHERE source_id IN (${placeholders(sourceIds.length)})
         AND metric IN (${placeholders(metricNames.length)})
         AND ts >= ?
         AND dimensions IS NULL
       ORDER BY source_id ASC, metric ASC, ts ASC`,
    )
    .bind(...sourceIds, ...metricNames, since)
    .all<MetricPointRow>();
  return result.results ?? [];
}

async function latestEvents(
  db: D1Database,
  entries: {
    source: SourceDef;
    metrics: NonNullable<(typeof sourceMetrics)[string]>;
  }[],
): Promise<EventRow[]> {
  const clauses: string[] = [];
  const params: string[] = [];

  for (const { source, metrics } of entries) {
    if (metrics.eventKind) {
      clauses.push("(source_id = ? AND kind = ?)");
      params.push(source.id, metrics.eventKind);
    } else {
      clauses.push("(source_id = ?)");
      params.push(source.id);
    }
  }

  const result = await db
    .prepare(
      `SELECT source_id, external_id, ts, kind, author, title, url
       FROM (
         SELECT source_id, external_id, ts, kind, author, title, url,
           ROW_NUMBER() OVER (PARTITION BY source_id ORDER BY ts DESC) AS row_number
         FROM events
         WHERE ${clauses.join(" OR ")}
       )
       WHERE row_number <= 3
       ORDER BY source_id ASC, ts DESC`,
    )
    .bind(...params)
    .all<EventRow>();
  return result.results ?? [];
}

type FetcherStatusRow = FetcherStatus & { source_id: string };

async function fetcherStatuses(
  db: D1Database,
  sourceIds: string[],
): Promise<FetcherStatusRow[]> {
  const result = await db
    .prepare(
      `SELECT source_id, last_run_at, last_success_at, last_status, last_error, consecutive_failures
       FROM fetcher_runs
       WHERE source_id IN (${placeholders(sourceIds.length)})`,
    )
    .bind(...sourceIds)
    .all<FetcherStatusRow>();
  return result.results ?? [];
}

function toLatestMetric(metric: string, rows: MetricPointRow[]): LatestMetric {
  const latest = rows.at(-1);
  const previous = rows.at(-2);
  return {
    metric,
    value: latest?.value ?? null,
    previousValue: previous?.value ?? null,
    delta: latest && previous ? latest.value - previous.value : null,
  };
}

function toLatestEvent(row: EventRow): LatestEvent {
  return {
    ts: row.ts,
    kind: row.kind,
    title: row.title,
    author: row.author,
    url: row.url,
  };
}

function toSparkline(rows: MetricPointRow[]): SparkPoint[] {
  return rows.map((row) => ({ ts: row.ts, value: row.value }));
}

function groupMetricRows(
  rows: MetricPointRow[],
): Map<string, MetricPointRow[]> {
  const grouped = new Map<string, MetricPointRow[]>();
  for (const row of rows) {
    const key = metricKey(row.source_id, row.metric);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return grouped;
}

function groupBySource<T extends { source_id: string }>(
  rows: T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    grouped.set(row.source_id, [...(grouped.get(row.source_id) ?? []), row]);
  }
  return grouped;
}

function groupStatusRows(rows: FetcherStatusRow[]): Map<string, FetcherStatus> {
  const grouped = new Map<string, FetcherStatus>();
  for (const { source_id, ...status } of rows) {
    grouped.set(source_id, status);
  }
  return grouped;
}

function metricKey(sourceId: string, metric: string): string {
  return `${sourceId}\u0000${metric}`;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

function withoutFetcher(source: SourceDef): Omit<SourceDef, "fetcher"> {
  const { fetcher: _fetcher, ...serializable } = source;
  return serializable;
}
