export type PerformanceAssetKind = 'guide' | 'mod';

export type PerformanceDimension = {
  key: 'package' | 'slug' | 'mod';
  value: string;
};

export type PerformanceAssetDefinition = {
  id: string;
  name: string;
  platform: 'Steam' | 'Thunderstore' | 'Erenshor Vault';
  kind: PerformanceAssetKind;
  sourceId: string;
  metric: 'views' | 'package_downloads' | 'mod_downloads';
  dimension: PerformanceDimension | null;
  alternateDimension?: PerformanceDimension;
  cadenceHours: number;
  href: string;
};

export type PerformanceReviewDefinition = {
  id: string;
  name: string;
  sourceId: string;
  cadenceHours: number;
};

export const performanceReviewDefinitions = [
  {
    id: 'steam-reviews-erenshor',
    name: 'Erenshor',
    sourceId: 'steam-reviews-erenshor',
    cadenceHours: 1
  },
  {
    id: 'steam-reviews-ak',
    name: 'Ancient Kingdoms',
    sourceId: 'steam-reviews-ak',
    cadenceHours: 1
  },
  {
    id: 'steam-reviews-afallon',
    name: 'Afallon',
    sourceId: 'steam-reviews-afallon',
    cadenceHours: 1
  }
] as const satisfies readonly PerformanceReviewDefinition[];

export const performanceAssetDefinitions = [
  {
    id: 'steam-guide-erenshor',
    name: 'Erenshor Interactive Maps and Spreadsheets',
    platform: 'Steam',
    kind: 'guide',
    sourceId: 'steam-guide-erenshor',
    metric: 'views',
    dimension: null,
    cadenceHours: 1,
    href: 'https://steamcommunity.com/sharedfiles/filedetails/?id=3500398991'
  },
  {
    id: 'steam-guide-ak',
    name: 'Ancient Kingdoms Compendium',
    platform: 'Steam',
    kind: 'guide',
    sourceId: 'steam-guide-ak',
    metric: 'views',
    dimension: null,
    cadenceHours: 1,
    href: 'https://steamcommunity.com/sharedfiles/filedetails/?id=3616580411'
  },
  {
    id: 'steam-guide-fractured-realms',
    name: 'Fractured Realms: The Complete Data Sheet',
    platform: 'Steam',
    kind: 'guide',
    sourceId: 'steam-guide-fractured-realms',
    metric: 'views',
    dimension: null,
    cadenceHours: 1,
    href: 'https://steamcommunity.com/sharedfiles/filedetails/?id=3770721423'
  },
  {
    id: 'steam-guide-afallon',
    name: 'Afallon Compendium - Interactive Map',
    platform: 'Steam',
    kind: 'guide',
    sourceId: 'steam-guide-afallon',
    metric: 'views',
    dimension: null,
    cadenceHours: 1,
    href: 'https://steamcommunity.com/sharedfiles/filedetails/?id=3800843227'
  },
  {
    id: 'thunderstore-adventure-guide',
    name: 'Adventure Guide',
    platform: 'Thunderstore',
    kind: 'mod',
    sourceId: 'thunderstore-wowmuch',
    metric: 'package_downloads',
    dimension: { key: 'package', value: 'AdventureGuide' },
    cadenceHours: 1,
    href: 'https://thunderstore.io/c/erenshor/p/WoW_Much/AdventureGuide/'
  },
  {
    id: 'vault-adventure-guide',
    name: 'Adventure Guide',
    platform: 'Erenshor Vault',
    kind: 'mod',
    sourceId: 'erenshor-vault-wowmuch',
    metric: 'mod_downloads',
    dimension: { key: 'slug', value: 'adventure-guide' },
    alternateDimension: { key: 'mod', value: 'Adventure Guide' },
    cadenceHours: 1,
    href: 'https://erenshorvault.app/mod/adventure-guide'
  },
  {
    id: 'thunderstore-interactive-map-companion',
    name: 'Interactive Map Companion',
    platform: 'Thunderstore',
    kind: 'mod',
    sourceId: 'thunderstore-wowmuch',
    metric: 'package_downloads',
    dimension: { key: 'package', value: 'InteractiveMapCompanion' },
    cadenceHours: 1,
    href: 'https://thunderstore.io/c/erenshor/p/WoW_Much/InteractiveMapCompanion/'
  },
  {
    id: 'vault-interactive-map-companion',
    name: 'Interactive Map Companion',
    platform: 'Erenshor Vault',
    kind: 'mod',
    sourceId: 'erenshor-vault-wowmuch',
    metric: 'mod_downloads',
    dimension: { key: 'slug', value: 'interactive-map-companion' },
    alternateDimension: { key: 'mod', value: 'Interactive Map Companion' },
    cadenceHours: 1,
    href: 'https://erenshorvault.app/mod/interactive-map-companion'
  },
  {
    id: 'thunderstore-sprint',
    name: 'Sprint',
    platform: 'Thunderstore',
    kind: 'mod',
    sourceId: 'thunderstore-wowmuch',
    metric: 'package_downloads',
    dimension: { key: 'package', value: 'Sprint' },
    cadenceHours: 1,
    href: 'https://thunderstore.io/c/erenshor/p/WoW_Much/Sprint/'
  },
  {
    id: 'vault-sprint',
    name: 'Sprint',
    platform: 'Erenshor Vault',
    kind: 'mod',
    sourceId: 'erenshor-vault-wowmuch',
    metric: 'mod_downloads',
    dimension: { key: 'slug', value: 'sprint' },
    alternateDimension: { key: 'mod', value: 'Sprint' },
    cadenceHours: 1,
    href: 'https://erenshorvault.app/mod/sprint'
  },
  {
    id: 'thunderstore-justice-for-f7',
    name: 'Justice for F7',
    platform: 'Thunderstore',
    kind: 'mod',
    sourceId: 'thunderstore-wowmuch',
    metric: 'package_downloads',
    dimension: { key: 'package', value: 'JusticeForF7' },
    cadenceHours: 1,
    href: 'https://thunderstore.io/c/erenshor/p/WoW_Much/JusticeForF7/'
  },
  {
    id: 'vault-justice-for-f7',
    name: 'Justice for F7',
    platform: 'Erenshor Vault',
    kind: 'mod',
    sourceId: 'erenshor-vault-wowmuch',
    metric: 'mod_downloads',
    dimension: { key: 'slug', value: 'justice-for-f7' },
    alternateDimension: { key: 'mod', value: 'Justice for F7' },
    cadenceHours: 1,
    href: 'https://erenshorvault.app/mod/justice-for-f7'
  }
] as const satisfies readonly PerformanceAssetDefinition[];
