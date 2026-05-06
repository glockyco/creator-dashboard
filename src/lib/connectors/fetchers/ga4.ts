import { z } from 'zod';
import { getGoogleAccessToken } from '../auth/google';
import { fetchJson } from '../http';
import type { FetcherInput, FetcherOutput, MetricPoint } from '$lib/types/domain';

const Ga4Row = z.object({
  dimensionValues: z.tuple([z.object({ value: z.string() })]),
  metricValues: z.tuple([z.object({ value: z.string() }), z.object({ value: z.string() }), z.object({ value: z.string() }), z.object({ value: z.string() })])
});
const Ga4Response = z.object({ rows: z.array(Ga4Row).default([]) });
const metricNames = ['active_users', 'sessions', 'views', 'event_count'] as const;

export async function fetchGa4({ source, env, now }: FetcherInput): Promise<FetcherOutput> {
  const token = await getGoogleAccessToken(env, ['https://www.googleapis.com/auth/analytics.readonly']);
  const date = day(now - 86_400_000);
  const response = await fetchJson(`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate: date, endDate: date }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'eventCount' }]
    }),
    schema: Ga4Response
  });
  const row = response.rows[0];
  const ts = Date.parse(`${dateFromGa4(row?.dimensionValues[0].value ?? date.replaceAll('-', ''))}T00:00:00.000Z`);
  const metric_points: MetricPoint[] = metricNames.map((metric, index) => ({ source_id: source.id, metric, ts, value: Number(row?.metricValues[index].value ?? 0), dimensions: null }));
  return { metric_points, events: [] };
}

function day(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function dateFromGa4(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}
