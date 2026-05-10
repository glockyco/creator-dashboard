import { z } from 'zod';
import { fetchJson } from '../http';
import type { FetcherInput, FetcherOutput } from '../types';

const Config = z.object({ wiki: z.string() });
const WikiFlag = z.union([z.boolean(), z.literal('')]);
const Change = z.object({
  type: z.string(),
  ns: z.number(),
  title: z.string(),
  revid: z.number().optional(),
  old_revid: z.number().optional(),
  rcid: z.number(),
  user: z.string().optional(),
  timestamp: z.string(),
  comment: z.string().optional(),
  minor: WikiFlag.optional(),
  bot: WikiFlag.optional(),
  oldlen: z.number().optional(),
  newlen: z.number().optional()
});
const Response = z.object({ query: z.object({ recentchanges: z.array(Change) }) });

export async function fetchMediaWikiRecentChanges({ source }: FetcherInput): Promise<FetcherOutput> {
  const config = Config.parse(source.config);
  const url = new URL(`https://${config.wiki}/api.php`);
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'recentchanges');
  url.searchParams.set('rcprop', 'ids|title|timestamp|user|comment|sizes|flags');
  url.searchParams.set('format', 'json');

  const data = await fetchJson(url, {
    schema: Response,
    headers: { 'User-Agent': 'creator-dashboard/1.0 (+https://dashboard.glockyco.com)' }
  });

  return {
    metric_points: [],
    events: data.query.recentchanges.map((change) => ({
      source_id: source.id,
      external_id: String(change.rcid),
      ts: new Date(change.timestamp).getTime(),
      kind: 'wiki_edit',
      author: change.user ?? null,
      title: change.title,
      body: change.comment ?? null,
      url: `https://${config.wiki}/wiki/${encodeURIComponent(change.title.replaceAll(' ', '_'))}`,
      metadata: {
        type: change.type,
        revid: change.revid ?? null,
        old_revid: change.old_revid ?? null,
        namespace: change.ns,
        minor: flag(change.minor),
        bot: flag(change.bot),
        size_delta: change.newlen != null && change.oldlen != null ? change.newlen - change.oldlen : null
      }
    }))
  };
}

function flag(value: z.infer<typeof WikiFlag> | undefined): boolean {
  return value === '' || value === true;
}
