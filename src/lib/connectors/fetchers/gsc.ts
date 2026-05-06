import { z } from 'zod';
import { getGoogleAccessToken } from '../auth/google';
import { fetchJson } from '../http';
import type { FetcherInput, FetcherOutput, JsonRecord, MetricPoint } from '$lib/types/domain';

const GscConfig = z.object({ siteUrl: z.string().min(1) });
const GscRow = z.object({
  keys: z.tuple([z.string(), z.string()]),
  clicks: z.number(),
  impressions: z.number(),
  ctr: z.number(),
  position: z.number()
});
const GscResponse = z.object({ rows: z.array(GscRow).default([]) });
const metrics = ['clicks', 'impressions', 'ctr', 'position'] as const;

export async function fetchGsc({ source, env, now }: FetcherInput): Promise<FetcherOutput> {
  const config = GscConfig.parse(source.config);
  const token = await getGoogleAccessToken(env, ['https://www.googleapis.com/auth/webmasters.readonly']);
  const date = day(now - 86_400_000);
  const response = await fetchJson(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: date, endDate: date, dimensions: ['query', 'page'], rowLimit: 250 }),
    schema: GscResponse
  });

  const ts = Date.parse(`${date}T00:00:00.000Z`);
  const metric_points: MetricPoint[] = aggregatePoints(source.id, ts, response.rows);
  for (const row of response.rows) {
    const dimensions = { query: row.keys[0], page: row.keys[1] };
    for (const metric of metrics) metric_points.push(point(source.id, metric, ts, row[metric], dimensions));
  }
  return { metric_points, events: [] };
}

function aggregatePoints(sourceId: string, ts: number, rows: z.infer<typeof GscRow>[]): MetricPoint[] {
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const weightedPosition = impressions === 0 ? 0 : rows.reduce((sum, row) => sum + row.position * row.impressions, 0) / impressions;
  return [point(sourceId, 'clicks', ts, clicks), point(sourceId, 'impressions', ts, impressions), point(sourceId, 'ctr', ts, impressions === 0 ? 0 : clicks / impressions), point(sourceId, 'position', ts, weightedPosition)];
}

function point(source_id: string, metric: string, ts: number, value: number, dimensions: JsonRecord | null = null): MetricPoint {
  return { source_id, metric, ts, value, dimensions };
}

function day(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}
