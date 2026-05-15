import { z } from 'zod';
import { getGoogleOAuthAccessToken } from '../auth/google.ts';
import { fetchJson } from '../http.ts';
import type { FetcherInput, FetcherOutput, JsonRecord, MetricPoint } from '$lib/types/domain';

const GscConfig = z.object({ siteUrl: z.string().min(1) });
const GscRow = z.object({
  keys: z.union([z.tuple([z.string(), z.string()]), z.tuple([z.string(), z.string(), z.string()])]),
  clicks: z.number(),
  impressions: z.number(),
  ctr: z.number(),
  position: z.number()
});
const GscResponse = z.object({ rows: z.array(GscRow).default([]) });
const metrics = ['clicks', 'impressions', 'ctr', 'position'] as const;
const rowLimit = 25_000;

type GscRow = z.infer<typeof GscRow>;
type NormalizedRow = {
  date: string;
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};
export type GscRangeInput = {
  source: FetcherInput['source'];
  env: FetcherInput['env'];
  startDate: string;
  endDate: string;
};

export async function fetchGsc({ source, env, now }: FetcherInput): Promise<FetcherOutput> {
  const date = day(now - 86_400_000);
  return fetchGscRange({ source, env, startDate: date, endDate: date });
}

export async function fetchGscRange({ source, env, startDate, endDate }: GscRangeInput): Promise<FetcherOutput> {
  const config = GscConfig.parse(source.config);
  const token = await getGoogleOAuthAccessToken(env);
  const rows: GscRow[] = [];

  for (let startRow = 0; ; startRow += rowLimit) {
    const response = await fetchJson(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ['date', 'query', 'page'],
          rowLimit,
          startRow,
          dataState: 'all'
        }),
        schema: GscResponse
      }
    );
    rows.push(...response.rows);
    if (response.rows.length < rowLimit) break;
  }

  return {
    metric_points: pointsFromRows(
      source.id,
      rows.map((row) => normalizeRow(row, startDate))
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

function normalizeRow(row: GscRow, defaultDate: string): NormalizedRow {
  const [first, second, third] = row.keys;
  const hasDate = third !== undefined;
  return {
    date: hasDate ? first : defaultDate,
    query: hasDate ? second : first,
    page: hasDate ? third : second,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position
  };
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
