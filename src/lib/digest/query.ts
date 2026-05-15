export type DigestMetricRow = { source_id: string; metric: string; ts: number; value: number };
export type DigestEventRow = {
  source_id: string;
  external_id: string;
  ts: number;
  kind: string;
  author: string | null;
  title: string | null;
  url: string | null;
};
export type DigestPostRow = {
  slug: string;
  posted_at: number;
  author: string;
  platform: string;
  url: string;
  title: string;
  tags: string[];
  body_excerpt: string | null;
};
export type DigestRunRow = {
  source_id: string;
  last_run_at: number;
  last_success_at: number | null;
  last_status: string;
  last_error: string | null;
  consecutive_failures: number;
};
export type DigestFailureRow = {
  source_id: string;
  ts: number;
  tier: string;
  status_code: number | null;
  error_message: string;
};

export type DigestData = {
  window: { start: number; end: number };
  metrics: DigestMetricRow[];
  events: DigestEventRow[];
  posts: DigestPostRow[];
  runs: DigestRunRow[];
  failures: DigestFailureRow[];
};

type RawMetricRow = DigestMetricRow & { dimensions: string | null };
type RawPostRow = Omit<DigestPostRow, 'tags'> & { tags: string };

const DAY_MS = 86_400_000;
/**
 * Metrics need a 24h prior baseline for "vs 24h ago" deltas, so the
 * metric_points query covers 48h while events / posts / failures / runs
 * still report on the 24h digest window.
 */
const METRIC_WINDOW_MS = 2 * DAY_MS;

export async function getDigestData(db: D1Database, now: Date): Promise<DigestData> {
  const end = now.getTime();
  const start = end - DAY_MS;
  const metricStart = end - METRIC_WINDOW_MS;

  const metricRows = await db
    .prepare(
      'SELECT source_id, metric, ts, value, dimensions FROM metric_points WHERE ts >= ? AND ts < ? AND dimensions IS NULL ORDER BY source_id, metric, ts ASC'
    )
    .bind(metricStart, end)
    .all<RawMetricRow>();
  const eventRows = await db
    .prepare(
      'SELECT source_id, external_id, ts, kind, author, title, url FROM events WHERE ts >= ? AND ts < ? ORDER BY ts DESC LIMIT 50'
    )
    .bind(start, end)
    .all<DigestEventRow>();
  const postRows = await db
    .prepare(
      'SELECT slug, posted_at, author, platform, url, title, tags, body_excerpt FROM posts_index WHERE posted_at >= ? AND posted_at < ? ORDER BY posted_at DESC LIMIT 10'
    )
    .bind(start, end)
    .all<RawPostRow>();
  const runRows = await db
    .prepare(
      'SELECT source_id, last_run_at, last_success_at, last_status, last_error, consecutive_failures FROM fetcher_runs ORDER BY source_id'
    )
    .all<DigestRunRow>();
  const failureRows = await db
    .prepare(
      'SELECT source_id, ts, tier, status_code, error_message FROM fetcher_failures WHERE ts >= ? AND ts < ? ORDER BY ts DESC LIMIT 25'
    )
    .bind(start, end)
    .all<DigestFailureRow>();

  return {
    window: { start, end },
    metrics: (metricRows.results ?? [])
      .filter((row) => row.dimensions === null)
      .map(({ source_id, metric, ts, value }) => ({ source_id, metric, ts, value })),
    events: eventRows.results ?? [],
    posts: (postRows.results ?? []).map((row) => ({ ...row, tags: parseTags(row.tags) })),
    runs: runRows.results ?? [],
    failures: failureRows.results ?? []
  };
}

function parseTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {
    return [];
  }
}
