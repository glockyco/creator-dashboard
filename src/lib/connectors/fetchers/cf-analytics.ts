import { z } from 'zod';
import { cfHeaders } from '../auth/cloudflare.ts';
import { fetchJson } from '../http.ts';
import type { FetcherInput, FetcherOutput, MetricPoint } from '$lib/types/domain';

const SiteTags = z.record(z.string(), z.string().min(1));
const CfRow = z.object({
  dimensions: z.object({ date: z.string() }),
  sum: z.object({ visits: z.number() }),
  count: z.number()
});
const CfResponse = z.object({
  data: z.object({
    viewer: z.object({
      accounts: z.array(
        z.object({
          rumPageloadEventsAdaptiveGroups: z.array(CfRow)
        })
      )
    })
  })
});

type CfRow = z.infer<typeof CfRow>;
export type CfAnalyticsRangeInput = {
  source: FetcherInput['source'];
  env: FetcherInput['env'];
  startDate: string;
  endDate: string;
};

export async function fetchCfAnalytics({ source, env, now }: FetcherInput): Promise<FetcherOutput> {
  const date = new Date(now - 86_400_000).toISOString().slice(0, 10);
  const output = await fetchCfAnalyticsRange({ source, env, startDate: date, endDate: date });
  return output.metric_points.length > 0
    ? output
    : { metric_points: pointsFromRow(source.id, { dimensions: { date }, sum: { visits: 0 }, count: 0 }), events: [] };
}

export async function fetchCfAnalyticsRange({
  source,
  env,
  startDate,
  endDate
}: CfAnalyticsRangeInput): Promise<FetcherOutput> {
  const siteTag = SiteTags.parse(JSON.parse(env.CF_ANALYTICS_SITE_TAGS))[source.id];
  if (!siteTag) throw new Error(`missing Cloudflare Web Analytics site tag for ${source.id}`);
  const accountTag = env.CF_ACCOUNT_ID;
  if (!accountTag) throw new Error(`missing Cloudflare account id (CF_ACCOUNT_ID) for ${source.id}`);
  const response = await fetchJson('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: cfHeaders(env),
    body: JSON.stringify({
      query: `query WebAnalytics($accountTag: string, $siteTag: string, $startDate: Date, $endDate: Date) { viewer { accounts(filter: { accountTag: $accountTag }) { rumPageloadEventsAdaptiveGroups(limit: 1000, filter: { siteTag: $siteTag, date_geq: $startDate, date_leq: $endDate }) { dimensions { date } sum { visits } count } } } }`,
      variables: { accountTag, siteTag, startDate, endDate }
    }),
    schema: CfResponse
  });
  const rows = response.data.viewer.accounts.flatMap((account) => account.rumPageloadEventsAdaptiveGroups);
  return { metric_points: rows.flatMap((row) => pointsFromRow(source.id, row)), events: [] };
}

function pointsFromRow(sourceId: string, row: CfRow): MetricPoint[] {
  const ts = Date.parse(`${row.dimensions.date}T00:00:00.000Z`);
  return [
    { source_id: sourceId, metric: 'visits', ts, value: row.sum.visits, dimensions: null },
    { source_id: sourceId, metric: 'pageviews', ts, value: row.count, dimensions: null }
  ];
}
