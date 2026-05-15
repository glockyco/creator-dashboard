import { z } from 'zod';
import { withBingKey } from '../auth/bing.ts';
import { fetchJson } from '../http.ts';
import type { FetcherInput, FetcherOutput, JsonRecord, MetricPoint } from '$lib/types/domain';

const BingConfig = z.object({ siteUrl: z.string().url() });
const BingRow = z.object({
  Query: z.string(),
  Page: z.string().optional(),
  Clicks: z.number(),
  Impressions: z.number(),
  Ctr: z.number().optional(),
  Position: z.number().optional(),
  AvgClickPosition: z.number().optional(),
  AvgImpressionPosition: z.number().optional(),
  Date: z.string().optional()
});
const BingResponse = z
  .union([z.object({ QueryStats: z.array(BingRow) }), z.object({ d: z.array(BingRow) })])
  .transform((response) => ('QueryStats' in response ? response.QueryStats : response.d));
const metrics = ['clicks', 'impressions', 'ctr', 'position'] as const;

type BingRow = z.infer<typeof BingRow>;
type NormalizedRow = {
  date: string;
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};
export type BingRangeInput = {
  source: FetcherInput['source'];
  env: FetcherInput['env'];
  startDate: string;
  endDate: string;
};

export async function fetchBingWebmaster({ source, env, now }: FetcherInput): Promise<FetcherOutput> {
  const date = day(now - 86_400_000);
  return fetchBingWebmasterRange({ source, env, startDate: date, endDate: date });
}

export async function fetchBingWebmasterRange({ source, env, endDate }: BingRangeInput): Promise<FetcherOutput> {
  const config = BingConfig.parse(source.config);
  const url = withBingKey(new URL('https://ssl.bing.com/webmaster/api.svc/json/GetQueryStats'), env);
  url.searchParams.set('siteUrl', config.siteUrl);
  const rows = await fetchJson(url, { schema: BingResponse });
  return {
    metric_points: pointsFromRows(
      source.id,
      rows.map((row) => normalizeRow(row, endDate))
    ),
    events: []
  };
}

function pointsFromRows(sourceId: string, rows: NormalizedRow[]): MetricPoint[] {
  const points: MetricPoint[] = [];
  const rowsByDate = new Map<string, NormalizedRow[]>();
  for (const row of rows) rowsByDate.set(row.date, [...(rowsByDate.get(row.date) ?? []), row]);

  for (const [date, dateRows] of [...rowsByDate.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const ts = Date.parse(`${date}T00:00:00.000Z`);
    points.push(...aggregatePoints(sourceId, ts, dateRows));
    for (const row of dateRows) {
      const dimensions = { query: row.query, page: row.page };
      for (const metric of metrics) points.push(point(sourceId, metric, ts, row[metric], dimensions));
    }
  }

  return points;
}

function normalizeRow(row: BingRow, defaultDate: string): NormalizedRow {
  const clicks = row.Clicks;
  const impressions = row.Impressions;
  return {
    date: normalizeDate(row.Date) ?? defaultDate,
    query: row.Query,
    page: row.Page ?? '',
    clicks,
    impressions,
    ctr: row.Ctr ?? (impressions === 0 ? 0 : clicks / impressions),
    position: row.Position ?? row.AvgImpressionPosition ?? row.AvgClickPosition ?? 0
  };
}

function normalizeDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const microsoftDate = /\/Date\((\d+)(?:[+-]\d+)?\)\//.exec(value);
  const ts = microsoftDate ? Number(microsoftDate[1]) : Date.parse(value);
  return Number.isFinite(ts) ? day(ts) : undefined;
}

function aggregatePoints(sourceId: string, ts: number, rows: NormalizedRow[]): MetricPoint[] {
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const weightedPosition =
    impressions === 0 ? 0 : rows.reduce((sum, row) => sum + row.position * row.impressions, 0) / impressions;
  return [
    point(sourceId, 'clicks', ts, clicks),
    point(sourceId, 'impressions', ts, impressions),
    point(sourceId, 'ctr', ts, impressions === 0 ? 0 : clicks / impressions),
    point(sourceId, 'position', ts, weightedPosition)
  ];
}

function point(
  source_id: string,
  metric: string,
  ts: number,
  value: number,
  dimensions: JsonRecord | null = null
): MetricPoint {
  return { source_id, metric, ts, value, dimensions };
}

function day(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}
