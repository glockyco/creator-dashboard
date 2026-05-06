import { z } from 'zod';
import { withBingKey } from '../auth/bing';
import { fetchJson } from '../http';
import type { FetcherInput, FetcherOutput, JsonRecord, MetricPoint } from '$lib/types/domain';

const BingConfig = z.object({ siteUrl: z.string().url() });
const BingRow = z.object({ Query: z.string(), Page: z.string(), Clicks: z.number(), Impressions: z.number(), Ctr: z.number(), Position: z.number() });
const BingResponse = z.object({ QueryStats: z.array(BingRow).default([]) });
const metrics = ['clicks', 'impressions', 'ctr', 'position'] as const;

type NormalizedRow = { query: string; page: string; clicks: number; impressions: number; ctr: number; position: number };

export async function fetchBingWebmaster({ source, env, now }: FetcherInput): Promise<FetcherOutput> {
  const config = BingConfig.parse(source.config);
  const url = withBingKey(new URL('https://ssl.bing.com/webmaster/api.svc/json/GetQueryStats'), env);
  url.searchParams.set('siteUrl', config.siteUrl);
  const response = await fetchJson(url, { schema: BingResponse });
  const rows = response.QueryStats.map((row) => ({ query: row.Query, page: row.Page, clicks: row.Clicks, impressions: row.Impressions, ctr: row.Ctr, position: row.Position }));
  const ts = Date.parse(`${day(now - 86_400_000)}T00:00:00.000Z`);

  const metric_points = aggregatePoints(source.id, ts, rows);
  for (const row of rows) {
    const dimensions = { query: row.query, page: row.page };
    for (const metric of metrics) metric_points.push(point(source.id, metric, ts, row[metric], dimensions));
  }
  return { metric_points, events: [] };
}

function aggregatePoints(sourceId: string, ts: number, rows: NormalizedRow[]): MetricPoint[] {
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
