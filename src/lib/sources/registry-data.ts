import type { Identity } from '../identities';
import type { SourceCategory } from '../types/domain';

export type SourceConnector =
  'steamGuide' | 'steamReviews' | 'thunderstoreTeam' | 'erenshorVaultMods' | 'mediaWikiRecentChanges';

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
  {
    id: 'steam-guide-erenshor',
    identity: 'WoW_Much',
    name: 'Steam Guide: Erenshor Maps',
    category: 'platform',
    cadenceHours: 1,
    connector: 'steamGuide',
    config: { publishedfileid: '3500398991' }
  },
  {
    id: 'steam-guide-ak',
    identity: 'WoW_Much',
    name: 'Steam Guide: AK Compendium',
    category: 'platform',
    cadenceHours: 1,
    connector: 'steamGuide',
    config: { publishedfileid: '3616580411' }
  },
  {
    id: 'steam-guide-fractured-realms',
    identity: 'WoW_Much',
    name: 'Steam Guide: Fractured Realms Data Sheet',
    category: 'platform',
    cadenceHours: 1,
    connector: 'steamGuide',
    config: { publishedfileid: '3770721423' }
  },
  {
    id: 'steam-guide-afallon',
    identity: 'WoW_Much',
    name: 'Steam Guide: Afallon Compendium',
    category: 'platform',
    cadenceHours: 1,
    connector: 'steamGuide',
    config: { publishedfileid: '3800843227' }
  },
  {
    id: 'steam-reviews-erenshor',
    identity: 'WoW_Much',
    name: 'Steam Reviews: Erenshor',
    category: 'event_feed',
    cadenceHours: 1,
    connector: 'steamReviews',
    config: { appid: '2382520' }
  },
  {
    id: 'steam-reviews-ak',
    identity: 'WoW_Much',
    name: 'Steam Reviews: Ancient Kingdoms',
    category: 'event_feed',
    cadenceHours: 1,
    connector: 'steamReviews',
    config: { appid: '2241380' }
  },
  {
    id: 'steam-reviews-afallon',
    identity: 'WoW_Much',
    name: 'Steam Reviews: Afallon',
    category: 'event_feed',
    cadenceHours: 1,
    connector: 'steamReviews',
    config: { appid: '2597810' }
  },
  {
    id: 'thunderstore-wowmuch',
    identity: 'WoW_Much',
    name: 'Thunderstore: WoW_Much',
    category: 'platform',
    cadenceHours: 1,
    connector: 'thunderstoreTeam',
    config: { namespace: 'WoW_Much', community: 'erenshor' }
  },
  {
    id: 'erenshor-vault-wowmuch',
    identity: 'WoW_Much',
    name: 'Erenshor Vault: WoW_Much Mods',
    category: 'platform',
    cadenceHours: 1,
    connector: 'erenshorVaultMods',
    config: { mods: ['adventure-guide', 'sprint', 'justice-for-f7', 'interactive-map-companion'] }
  },
  {
    id: 'erenshor-wiki-recent',
    identity: 'WoW_Much',
    name: 'Erenshor Wiki: Recent Changes',
    category: 'event_feed',
    cadenceHours: 1,
    connector: 'mediaWikiRecentChanges',
    config: { wiki: 'erenshor.wiki.gg' }
  }
];
