export type MetricBreakdownConfig = {
  /** Metric name carrying the per-dimension series, e.g. `package_downloads`. */
  metric: string;
  /** Dimension key whose value identifies each series, e.g. `package`. */
  dimension: string;
  /** Heading shown above the breakdown, e.g. `Downloads per mod`. */
  label: string;
};

export type SourceMetricConfig = {
  primary: string[];
  sparkline: string;
  eventKind?: string;
  /** Optional per-dimension breakdown surfaced on the tile and detail page. */
  breakdown?: MetricBreakdownConfig;
};

export const sourceMetrics: Record<string, SourceMetricConfig> = {
  'github-glockyco': { primary: ['followers', 'total_stars', 'public_repos'], sparkline: 'contributions' },
  'steam-guide-erenshor': {
    primary: ['views', 'favorite_count', 'rating', 'ratings', 'comment_count', 'award_count'],
    sparkline: 'views'
  },
  'steam-guide-ak': {
    primary: ['views', 'favorite_count', 'rating', 'ratings', 'comment_count', 'award_count'],
    sparkline: 'views'
  },
  'steam-guide-fractured-realms': {
    primary: ['views', 'favorite_count', 'rating', 'ratings', 'comment_count', 'award_count'],
    sparkline: 'views'
  },
  'steam-reviews-erenshor': {
    primary: ['review_total', 'review_positive', 'review_negative'],
    sparkline: 'review_total',
    eventKind: 'review'
  },
  'steam-reviews-ak': {
    primary: ['review_total', 'review_positive', 'review_negative'],
    sparkline: 'review_total',
    eventKind: 'review'
  },
  'thunderstore-wowmuch': {
    primary: ['total_downloads', 'package_count'],
    sparkline: 'total_downloads',
    breakdown: { metric: 'package_downloads', dimension: 'package', label: 'Downloads per mod' }
  },
  'erenshor-vault-wowmuch': {
    primary: ['total_downloads', 'total_views', 'mod_count'],
    sparkline: 'total_downloads',
    breakdown: { metric: 'mod_downloads', dimension: 'mod', label: 'Downloads per Vault mod' }
  },
  'erenshor-wiki-recent': { primary: ['wiki_change_count'], sparkline: 'wiki_change_count', eventKind: 'wiki_edit' },
  'gsc-glockyco-com': { primary: ['clicks', 'impressions', 'ctr', 'position'], sparkline: 'clicks' },
  'gsc-ak-compendium': { primary: ['clicks', 'impressions', 'ctr', 'position'], sparkline: 'clicks' },
  'gsc-ak-compendium-org': { primary: ['clicks', 'impressions', 'ctr', 'position'], sparkline: 'clicks' },
  'gsc-erenshor-maps': { primary: ['clicks', 'impressions', 'ctr', 'position'], sparkline: 'clicks' },
  'bing-glockyco-com': { primary: ['clicks', 'impressions', 'ctr', 'position'], sparkline: 'clicks' },
  'bing-ak-compendium': { primary: ['clicks', 'impressions', 'ctr', 'position'], sparkline: 'clicks' },
  'bing-ak-compendium-org': { primary: ['clicks', 'impressions', 'ctr', 'position'], sparkline: 'clicks' },
  'bing-erenshor-maps': { primary: ['clicks', 'impressions', 'ctr', 'position'], sparkline: 'clicks' },
  'cf-analytics-glockyco-com': { primary: ['visits', 'pageviews'], sparkline: 'visits' },
  'cf-analytics-ak-compendium': { primary: ['visits', 'pageviews'], sparkline: 'visits' },
  'cf-analytics-erenshor-maps': { primary: ['visits', 'pageviews'], sparkline: 'visits' },
  ga4: { primary: ['active_users', 'sessions', 'views', 'event_count'], sparkline: 'active_users' }
};
