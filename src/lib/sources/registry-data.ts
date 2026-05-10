import type { Identity } from '../identities';
import type { SourceCategory } from '../types/domain';

export type SourceConnector = 'github' | 'steamGuide' | 'steamReviews' | 'thunderstoreTeam' | 'mediaWikiRecentChanges' | 'gsc' | 'bingWebmaster' | 'cfAnalytics' | 'ga4';

export type SourceRecord = {
  id: string;
  identity: Identity;
  name: string;
  category: SourceCategory;
  cadenceHours: number;
  connector: SourceConnector;
  config: Record<string, unknown>;
};

export const sourceRecords: SourceRecord[] = [
  { id: 'github-glockyco', identity: 'glockyco', name: 'GitHub @glockyco', category: 'platform', cadenceHours: 1, connector: 'github', config: {} },
  { id: 'steam-guide-erenshor', identity: 'WoW_Much', name: 'Steam Guide: Erenshor Maps', category: 'platform', cadenceHours: 1, connector: 'steamGuide', config: { publishedfileid: '3500398991' } },
  { id: 'steam-guide-ak', identity: 'WoW_Much', name: 'Steam Guide: AK Compendium', category: 'platform', cadenceHours: 1, connector: 'steamGuide', config: { publishedfileid: '3616580411' } },
  { id: 'steam-reviews-erenshor', identity: 'WoW_Much', name: 'Steam Reviews: Erenshor', category: 'event_feed', cadenceHours: 1, connector: 'steamReviews', config: { appid: '2382520' } },
  { id: 'steam-reviews-ak', identity: 'WoW_Much', name: 'Steam Reviews: Ancient Kingdoms', category: 'event_feed', cadenceHours: 1, connector: 'steamReviews', config: { appid: '2241380' } },
  { id: 'thunderstore-wowmuch', identity: 'WoW_Much', name: 'Thunderstore: WoW_Much', category: 'platform', cadenceHours: 1, connector: 'thunderstoreTeam', config: { namespace: 'WoW_Much', community: 'erenshor' } },
  { id: 'erenshor-wiki-recent', identity: 'WoW_Much', name: 'Erenshor Wiki: Recent Changes', category: 'event_feed', cadenceHours: 1, connector: 'mediaWikiRecentChanges', config: { wiki: 'erenshor.wiki.gg' } },
  { id: 'gsc-glockyco-com', identity: 'glockyco', name: 'GSC: glockyco.com', category: 'analytics', cadenceHours: 24, connector: 'gsc', config: { siteUrl: 'sc-domain:glockyco.com' } },
  { id: 'gsc-ak-compendium', identity: 'WoW_Much', name: 'GSC: AK Compendium (workers.dev)', category: 'analytics', cadenceHours: 24, connector: 'gsc', config: { siteUrl: 'https://ancient-kingdoms-compendium.wowmuch1.workers.dev/' } },
  { id: 'gsc-ak-compendium-org', identity: 'WoW_Much', name: 'GSC: AK Compendium (compendiums.org)', category: 'analytics', cadenceHours: 24, connector: 'gsc', config: { siteUrl: 'sc-domain:ancient-kingdoms.compendiums.org' } },
  { id: 'gsc-erenshor-maps', identity: 'WoW_Much', name: 'GSC: Erenshor Maps', category: 'analytics', cadenceHours: 24, connector: 'gsc', config: { siteUrl: 'https://erenshor-maps.wowmuch1.workers.dev/' } },
  { id: 'bing-glockyco-com', identity: 'glockyco', name: 'Bing: glockyco.com', category: 'analytics', cadenceHours: 24, connector: 'bingWebmaster', config: { siteUrl: 'https://glockyco.com/' } },
  { id: 'bing-ak-compendium', identity: 'WoW_Much', name: 'Bing: AK Compendium (workers.dev)', category: 'analytics', cadenceHours: 24, connector: 'bingWebmaster', config: { siteUrl: 'https://ancient-kingdoms-compendium.wowmuch1.workers.dev/' } },
  { id: 'bing-ak-compendium-org', identity: 'WoW_Much', name: 'Bing: AK Compendium (compendiums.org)', category: 'analytics', cadenceHours: 24, connector: 'bingWebmaster', config: { siteUrl: 'https://ancient-kingdoms.compendiums.org/' } },
  { id: 'bing-erenshor-maps', identity: 'WoW_Much', name: 'Bing: Erenshor Maps', category: 'analytics', cadenceHours: 24, connector: 'bingWebmaster', config: { siteUrl: 'https://erenshor-maps.wowmuch1.workers.dev/' } },
  { id: 'cf-analytics-glockyco-com', identity: 'glockyco', name: 'Cloudflare Analytics: glockyco.com', category: 'analytics', cadenceHours: 24, connector: 'cfAnalytics', config: {} },
  { id: 'cf-analytics-ak-compendium', identity: 'WoW_Much', name: 'Cloudflare Analytics: AK Compendium', category: 'analytics', cadenceHours: 24, connector: 'cfAnalytics', config: {} },
  { id: 'cf-analytics-erenshor-maps', identity: 'WoW_Much', name: 'Cloudflare Analytics: Erenshor Maps', category: 'analytics', cadenceHours: 24, connector: 'cfAnalytics', config: {} }
];
