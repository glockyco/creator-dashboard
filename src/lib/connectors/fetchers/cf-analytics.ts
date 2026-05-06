import { z } from 'zod';
import { cfHeaders } from '../auth/cloudflare';
import { fetchJson } from '../http';
import type { FetcherInput, FetcherOutput, MetricPoint } from '$lib/types/domain';

const SiteTags = z.record(z.string(), z.string().min(1));
const CfResponse = z.object({
  data: z.object({
    viewer: z.object({
      accounts: z.array(
        z.object({
          rumPageloadEventsAdaptiveGroups: z.array(
            z.object({
              dimensions: z.object({ date: z.string() }),
              sum: z.object({ visits: z.number() }),
              count: z.number()
            })
          )
        })
      )
    })
  })
});

export async function fetchCfAnalytics({ source, env }: FetcherInput): Promise<FetcherOutput> {
  const siteTag = SiteTags.parse(JSON.parse(env.CF_ANALYTICS_SITE_TAGS))[source.id];
  if (!siteTag) throw new Error(`missing Cloudflare Web Analytics site tag for ${source.id}`);
  const response = await fetchJson('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: cfHeaders(env),
    body: JSON.stringify({
      query: `query WebAnalytics($siteTag: string) { viewer { accounts { rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: $siteTag }) { dimensions { date } sum { visits } count } } } }`,
      variables: { siteTag }
    }),
    schema: CfResponse
  });
  const row = response.data.viewer.accounts[0]?.rumPageloadEventsAdaptiveGroups[0];
  const ts = Date.parse(`${row?.dimensions.date ?? new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const metric_points: MetricPoint[] = [
    { source_id: source.id, metric: 'visits', ts, value: row?.sum.visits ?? 0, dimensions: null },
    { source_id: source.id, metric: 'pageviews', ts, value: row?.count ?? 0, dimensions: null }
  ];
  return { metric_points, events: [] };
}
