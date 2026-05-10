import { z } from 'zod';
import { getGoogleOAuthAccessToken } from '../auth/google.ts';
import { fetchJson } from '../http.ts';
import type { FetcherInput, FetcherOutput, MetricPoint } from '$lib/types/domain';

const Ga4Row = z.object({
  dimensionValues: z.tuple([z.object({ value: z.string() })]),
  metricValues: z.tuple([z.object({ value: z.string() }), z.object({ value: z.string() }), z.object({ value: z.string() }), z.object({ value: z.string() })])
});
const Ga4Response = z.object({ rows: z.array(Ga4Row).default([]) });
const metricNames = ['active_users', 'sessions', 'views', 'event_count'] as const;

type Ga4Row = z.infer<typeof Ga4Row>;
export type Ga4RangeInput = { source: FetcherInput['source']; env: FetcherInput['env']; startDate: string; endDate: string };

export async function fetchGa4({ source, env, now }: FetcherInput): Promise<FetcherOutput> {
  const date = day(now - 86_400_000);
  const output = await fetchGa4Range({ source, env, startDate: date, endDate: date });
  return output.metric_points.length > 0 ? output : { metric_points: zeroPoints(source.id, date), events: [] };
}

export async function fetchGa4Range({ source, env, startDate, endDate }: Ga4RangeInput): Promise<FetcherOutput> {
  const token = await getGoogleOAuthAccessToken(env);
  const response = await fetchJson(`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'eventCount' }]
    }),
    schema: Ga4Response
  });
  return { metric_points: response.rows.flatMap((row) => pointsFromRow(source.id, row)), events: [] };
}

function pointsFromRow(sourceId: string, row: Ga4Row): MetricPoint[] {
  const ts = Date.parse(`${dateFromGa4(row.dimensionValues[0].value)}T00:00:00.000Z`);
  return metricNames.map((metric, index) => ({ source_id: sourceId, metric, ts, value: Number(row.metricValues[index].value), dimensions: null }));
}

function zeroPoints(sourceId: string, date: string): MetricPoint[] {
  const ts = Date.parse(`${date}T00:00:00.000Z`);
  return metricNames.map((metric) => ({ source_id: sourceId, metric, ts, value: 0, dimensions: null }));
}

function day(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function dateFromGa4(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}
