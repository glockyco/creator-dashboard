import { z } from 'zod';
import { fetchJson } from '../http';
import type { FetcherInput, FetcherOutput } from '../types';

const Config = z.object({
  wiki: z.string(),
  // Accounts whose edits the owner already knows about. Bot-flagged edits are always excluded.
  excludeUsers: z.array(z.string()).default([]),
  // Each run re-reads this window, so an outage shorter than it loses nothing.
  lookbackDays: z.number().int().positive().default(7)
});
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
const Response = z.object({
  query: z.object({ recentchanges: z.array(Change) }),
  continue: z.looseObject({ rccontinue: z.string() }).optional()
});

// Guards against a continuation loop. 50 pages of 500 is far beyond the wiki's human edit volume.
const MAX_PAGES = 50;

export async function fetchMediaWikiRecentChanges({ source, now }: FetcherInput): Promise<FetcherOutput> {
  const config = Config.parse(source.config);
  const excludedUsers = new Set(config.excludeUsers);
  const url = new URL(`https://${config.wiki}/api.php`);
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'recentchanges');
  url.searchParams.set('rcprop', 'ids|title|timestamp|user|comment|sizes|flags');
  url.searchParams.set('rctype', 'edit|new');
  url.searchParams.set('rcshow', '!bot');
  url.searchParams.set('rclimit', '500');
  url.searchParams.set('rcend', new Date(now - config.lookbackDays * 86_400_000).toISOString());
  url.searchParams.set('format', 'json');

  const changes: z.infer<typeof Change>[] = [];
  for (let page = 0; ; page += 1) {
    if (page === MAX_PAGES) throw new Error(`wiki recent changes did not end within ${MAX_PAGES} pages`);
    const data = await fetchJson(url, {
      schema: Response,
      headers: { 'User-Agent': 'creator-dashboard/1.0 (+https://dashboard.glockyco.com)' }
    });
    changes.push(...data.query.recentchanges);
    if (!data.continue) break;
    url.searchParams.set('rccontinue', data.continue.rccontinue);
  }

  return {
    metric_points: [],
    events: changes
      .filter((change) => change.user === undefined || !excludedUsers.has(change.user))
      .map((change) => {
        // MediaWiki reports 0 for a revision that does not exist, such as the parent of a new page.
        const hasDiff = (change.old_revid ?? 0) > 0 && (change.revid ?? 0) > 0;
        return {
          source_id: source.id,
          external_id: String(change.rcid),
          ts: new Date(change.timestamp).getTime(),
          kind: 'wiki_edit',
          author: change.user ?? null,
          title: change.title,
          body: change.comment ?? null,
          url: hasDiff
            ? `https://${config.wiki}/wiki/Special:Diff/${change.old_revid}/${change.revid}`
            : `https://${config.wiki}/wiki/${encodeURIComponent(change.title.replaceAll(' ', '_'))}`,
          metadata: {
            native_link_kind: hasDiff ? 'diff' : 'page',
            type: change.type,
            revid: change.revid ?? null,
            old_revid: change.old_revid ?? null,
            namespace: change.ns,
            minor: flag(change.minor),
            bot: flag(change.bot),
            size_delta: change.newlen != null && change.oldlen != null ? change.newlen - change.oldlen : null
          }
        };
      })
  };
}

function flag(value: z.infer<typeof WikiFlag> | undefined): boolean {
  return value === '' || value === true;
}
