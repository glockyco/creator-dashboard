import { sources, type SourceDef } from '$lib/sources/registry';
import { sourceMetrics } from '$lib/sources/metrics';
import type { JsonRecord } from '$lib/types/domain';
import type { TimelineFilters } from '$lib/timeline/schema';

export type TimelineMetricPoint = {
  ts: number;
  value: number;
  dimensions: JsonRecord | null;
};

export type TimelineMetricSeries = {
  source_id: string;
  metric: string;
  points: TimelineMetricPoint[];
};

export type TimelineEvent = {
  source_id: string;
  external_id: string;
  ts: number;
  kind: string;
  author: string | null;
  title: string | null;
  body: string | null;
  url: string | null;
  metadata: Record<string, unknown> | null;
};

export type TimelinePost = {
  slug: string;
  posted_at: number;
  author: string;
  title: string;
  url: string;
  source_id: string;
};

export type TimelineData = {
  sources: Array<Omit<SourceDef, 'fetcher'>>;
  metricSeries: TimelineMetricSeries[];
  events: TimelineEvent[];
  posts: TimelinePost[];
};

type MetricRow = { source_id: string; metric: string; ts: number; value: number; dimensions: string | null };
type EventRow = Omit<TimelineEvent, 'metadata'> & { metadata: string | null };
type PostRow = TimelinePost;

export async function getTimeline(db: D1Database, filters: TimelineFilters): Promise<TimelineData> {
  const visibleSources = sources.filter((source) => filters.sourceIds.includes(source.id));
  const sourceIds = visibleSources.map((source) => source.id);
  if (sourceIds.length === 0) return { sources: [], metricSeries: [], events: [], posts: [] };

  const metricRows = await readMetricRows(db, sourceIds, filters.sinceTs, filters.untilTs);
  return {
    sources: visibleSources.map(withoutFetcher),
    metricSeries: toMetricSeries(visibleSources, metricRows),
    events: filters.overlays.includes('events')
      ? await readEvents(db, sourceIds, filters.sinceTs, filters.untilTs)
      : [],
    posts: filters.overlays.includes('posts') ? await readPosts(db, sourceIds, filters.sinceTs, filters.untilTs) : []
  };
}

async function readMetricRows(db: D1Database, sourceIds: string[], since: number, until: number): Promise<MetricRow[]> {
  const result = await db
    .prepare(
      `SELECT source_id, metric, ts, value, dimensions
       FROM metric_points
       WHERE source_id IN (${placeholders(sourceIds)}) AND ts BETWEEN ? AND ?
       ORDER BY ts ASC`
    )
    .bind(...sourceIds, since, until)
    .all<MetricRow>();
  return result.results ?? [];
}

async function readEvents(db: D1Database, sourceIds: string[], since: number, until: number): Promise<TimelineEvent[]> {
  const result = await db
    .prepare(
      `SELECT source_id, external_id, ts, kind, author, title, body, url, metadata
       FROM events
       WHERE source_id IN (${placeholders(sourceIds)}) AND ts BETWEEN ? AND ?
       ORDER BY ts ASC`
    )
    .bind(...sourceIds, since, until)
    .all<EventRow>();
  return (result.results ?? []).map((row) => ({ ...row, metadata: parseObject(row.metadata) }));
}

async function readPosts(db: D1Database, sourceIds: string[], since: number, until: number): Promise<TimelinePost[]> {
  const result = await db
    .prepare(
      `SELECT p.slug, p.posted_at, p.author, p.title, p.url, ps.source_id
       FROM posts_index p
       JOIN posts_sources ps ON ps.slug = p.slug
       WHERE ps.source_id IN (${placeholders(sourceIds)}) AND p.posted_at BETWEEN ? AND ?
       ORDER BY p.posted_at ASC`
    )
    .bind(...sourceIds, since, until)
    .all<PostRow>();
  return result.results ?? [];
}

function toMetricSeries(visibleSources: SourceDef[], rows: MetricRow[]): TimelineMetricSeries[] {
  const series: TimelineMetricSeries[] = [];
  for (const source of visibleSources) {
    const metric = sourceMetrics[source.id]?.sparkline;
    if (!metric) continue;
    series.push({
      source_id: source.id,
      metric,
      points: rows
        .filter((row) => row.source_id === source.id && row.metric === metric)
        .map((row) => ({ ts: row.ts, value: row.value, dimensions: parseObject(row.dimensions) as JsonRecord | null }))
    });
  }
  return series;
}

function placeholders(values: unknown[]): string {
  return values.map(() => '?').join(', ');
}

function parseObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function withoutFetcher(source: SourceDef): Omit<SourceDef, 'fetcher'> {
  const { fetcher: _fetcher, ...serializable } = source;
  return serializable;
}
