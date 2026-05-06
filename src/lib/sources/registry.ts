import { z } from 'zod';
import { Identity } from '$lib/identities';
import type { Fetcher, SourceCategory } from '$lib/types/domain';
import * as fetchers from '$lib/connectors/fetchers';

export const SourceDef = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  identity: Identity,
  category: z.enum(['platform', 'analytics', 'event_feed']),
  cadenceHours: z.number().int().positive(),
  fetcher: z.custom<Fetcher>((value) => typeof value === 'function'),
  config: z.record(z.string(), z.unknown()).default({})
});

export type SourceDef = z.infer<typeof SourceDef> & { category: SourceCategory };

export const sources: SourceDef[] = z.array(SourceDef).parse([
  { id: 'github-glockyco', identity: 'glockyco', name: 'GitHub @glockyco', category: 'platform', cadenceHours: 1, fetcher: fetchers.github, config: {} },
  { id: 'steam-guide-erenshor', identity: 'WoW_Much', name: 'Steam Guide: Erenshor Maps', category: 'platform', cadenceHours: 1, fetcher: fetchers.steamGuide, config: { publishedfileid: '3500398991' } },
  { id: 'steam-guide-ak', identity: 'WoW_Much', name: 'Steam Guide: AK Compendium', category: 'platform', cadenceHours: 1, fetcher: fetchers.steamGuide, config: { publishedfileid: '3616580411' } },
  { id: 'steam-reviews-erenshor', identity: 'WoW_Much', name: 'Steam Reviews: Erenshor', category: 'event_feed', cadenceHours: 1, fetcher: fetchers.steamReviews, config: { appid: '2382520' } },
  { id: 'steam-reviews-ak', identity: 'WoW_Much', name: 'Steam Reviews: Ancient Kingdoms', category: 'event_feed', cadenceHours: 1, fetcher: fetchers.steamReviews, config: { appid: '2241380' } },
  { id: 'thunderstore-wowmuch', identity: 'WoW_Much', name: 'Thunderstore: WoW_Much', category: 'platform', cadenceHours: 1, fetcher: fetchers.thunderstoreTeam, config: { namespace: 'WoW_Much' } },
  { id: 'erenshor-wiki-recent', identity: 'WoW_Much', name: 'Erenshor Wiki: Recent Changes', category: 'event_feed', cadenceHours: 1, fetcher: fetchers.mediaWikiRecentChanges, config: { wiki: 'erenshor.wiki.gg' } },
  { id: 'gsc-glockyco-com', identity: 'glockyco', name: 'GSC: glockyco.com', category: 'analytics', cadenceHours: 24, fetcher: fetchers.gsc, config: { siteUrl: 'sc-domain:glockyco.com' } },
  { id: 'gsc-ak-compendium', identity: 'WoW_Much', name: 'GSC: AK Compendium', category: 'analytics', cadenceHours: 24, fetcher: fetchers.gsc, config: { siteUrl: 'https://ancient-kingdoms-compendium.wowmuch1.workers.dev/' } },
  { id: 'gsc-erenshor-maps', identity: 'WoW_Much', name: 'GSC: Erenshor Maps', category: 'analytics', cadenceHours: 24, fetcher: fetchers.gsc, config: { siteUrl: 'https://erenshor-maps.wowmuch1.workers.dev/' } },
  { id: 'bing-glockyco-com', identity: 'glockyco', name: 'Bing: glockyco.com', category: 'analytics', cadenceHours: 24, fetcher: fetchers.bingWebmaster, config: { siteUrl: 'https://glockyco.com/' } },
  { id: 'bing-ak-compendium', identity: 'WoW_Much', name: 'Bing: AK Compendium', category: 'analytics', cadenceHours: 24, fetcher: fetchers.bingWebmaster, config: { siteUrl: 'https://ancient-kingdoms-compendium.wowmuch1.workers.dev/' } },
  { id: 'bing-erenshor-maps', identity: 'WoW_Much', name: 'Bing: Erenshor Maps', category: 'analytics', cadenceHours: 24, fetcher: fetchers.bingWebmaster, config: { siteUrl: 'https://erenshor-maps.wowmuch1.workers.dev/' } },
  { id: 'cf-analytics-glockyco-com', identity: 'glockyco', name: 'Cloudflare Analytics: glockyco.com', category: 'analytics', cadenceHours: 24, fetcher: fetchers.cfAnalytics, config: {} },
  { id: 'cf-analytics-ak-compendium', identity: 'WoW_Much', name: 'Cloudflare Analytics: AK Compendium', category: 'analytics', cadenceHours: 24, fetcher: fetchers.cfAnalytics, config: {} },
  { id: 'cf-analytics-erenshor-maps', identity: 'WoW_Much', name: 'Cloudflare Analytics: Erenshor Maps', category: 'analytics', cadenceHours: 24, fetcher: fetchers.cfAnalytics, config: {} }
]);

export function getSource(sourceId: string): SourceDef | undefined {
  return sources.find((source) => source.id === sourceId);
}
