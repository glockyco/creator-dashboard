import { getSource, type SourceDef } from '$lib/sources/registry';
import { sourceMetrics } from '$lib/sources/metrics';
import type { LatestMetric, SparkPoint } from '$lib/dashboard/types';
import type { SteamGuideAward } from '$lib/types/domain';
import { latestMetricFromPoints } from '$lib/dashboard/delta';

export type LinkedPost = {
  slug: string;
  posted_at: number;
  author: string;
  platform: string;
  url: string;
  title: string;
  tags: string[];
  body_excerpt: string | null;
};

export type SourceEvent = {
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

export type EventsPage = {
  items: SourceEvent[];
  nextCursor: number | null;
};

export type SourceDetail = {
  source: Omit<SourceDef, 'fetcher'>;
  metricHistory: Record<string, SparkPoint[]>;
  secondaryMetrics: LatestMetric[];
  linkedPosts: LinkedPost[];
  events: EventsPage;
  steamGuideAwards: SteamGuideAward[];
};

export type SourceDetailRange = {
  since: number;
};

export type SourceEventsOptions = {
  cursor?: number;
  kind?: string;
  pageSize?: number;
};

type MetricRow = { ts: number; value: number };
type PostRow = Omit<LinkedPost, 'tags'> & { tags: string };
type EventRow = Omit<SourceEvent, 'metadata'> & { metadata: string | null };

export async function getSourceDetail(
  db: D1Database,
  sourceId: string,
  range: SourceDetailRange
): Promise<SourceDetail | null> {
  const source = getSource(sourceId);
  if (!source) return null;

  const config = sourceMetrics[source.id];
  const metrics = config ? unique([...config.primary, config.sparkline]) : [];
  const metricHistory: Record<string, SparkPoint[]> = {};

  for (const metric of metrics) {
    metricHistory[metric] = await metricHistoryRows(db, source.id, metric, range.since);
  }

  return {
    source: withoutFetcher(source),
    metricHistory,
    secondaryMetrics: config
      ? config.primary.map((metric) => latestMetricFromPoints(metric, metricHistory[metric] ?? []))
      : [],
    linkedPosts: await linkedPosts(db, source.id),
    events: await getSourceEvents(db, source.id, { pageSize: 20 }),
    steamGuideAwards: await steamGuideAwards(db, source.id)
  };
}

export async function getSourceEvents(
  db: D1Database,
  sourceId: string,
  options: SourceEventsOptions = {}
): Promise<EventsPage> {
  const pageSize = options.pageSize ?? 20;
  const where = ['source_id = ?'];
  const params: unknown[] = [sourceId];
  if (options.cursor !== undefined) {
    where.push('ts < ?');
    params.push(options.cursor);
  }
  if (options.kind) {
    where.push('kind = ?');
    params.push(options.kind);
  }
  params.push(pageSize + 1);

  const result = await db
    .prepare(
      `SELECT source_id, external_id, ts, kind, author, title, body, url, metadata
       FROM events
       WHERE ${where.join(' AND ')}
       ORDER BY ts DESC
       LIMIT ?`
    )
    .bind(...params)
    .all<EventRow>();

  const rows = result.results ?? [];
  const pageRows = rows.slice(0, pageSize);
  return {
    items: pageRows.map(toEvent),
    nextCursor: rows.length > pageSize ? (pageRows.at(-1)?.ts ?? null) : null
  };
}

async function metricHistoryRows(
  db: D1Database,
  sourceId: string,
  metric: string,
  since: number
): Promise<SparkPoint[]> {
  const result = await db
    .prepare(
      `SELECT ts, value
       FROM metric_points
       WHERE source_id = ? AND metric = ? AND ts >= ?
       ORDER BY ts ASC`
    )
    .bind(sourceId, metric, since)
    .all<MetricRow>();
  return (result.results ?? []).map((row) => ({ ts: row.ts, value: row.value }));
}

async function linkedPosts(db: D1Database, sourceId: string): Promise<LinkedPost[]> {
  const result = await db
    .prepare(
      `SELECT p.slug, p.posted_at, p.author, p.platform, p.url, p.title, p.tags, p.body_excerpt
       FROM posts_sources ps
       JOIN posts_index p ON p.slug = ps.slug
       WHERE ps.source_id = ?
       ORDER BY p.posted_at DESC
       LIMIT 10`
    )
    .bind(sourceId)
    .all<PostRow>();
  return (result.results ?? []).map((post) => ({ ...post, tags: parseTags(post.tags) }));
}

async function steamGuideAwards(db: D1Database, sourceId: string): Promise<SteamGuideAward[]> {
  if (!sourceId.startsWith('steam-guide-')) return [];
  const result = await db
    .prepare(
      `SELECT source_id, reaction_id, count, icon_url, captured_at
       FROM steam_guide_awards
       WHERE source_id = ? AND count > 0
       ORDER BY count DESC, reaction_id ASC`
    )
    .bind(sourceId)
    .all<SteamGuideAward>();
  return (result.results ?? []).sort((left, right) => right.count - left.count || left.reaction_id - right.reaction_id);
}

function toEvent(row: EventRow): SourceEvent {
  return { ...row, metadata: parseMetadata(row.metadata) };
}

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {
    return [];
  }
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function withoutFetcher(source: SourceDef): Omit<SourceDef, 'fetcher'> {
  const { fetcher: _fetcher, ...serializable } = source;
  return serializable;
}
