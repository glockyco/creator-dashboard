export type SourceMetricConfig = {
  primary: string[];
  sparkline: string;
  eventKind?: string;
};

export const sourceMetrics: Record<string, SourceMetricConfig> = {
  'github-glockyco': { primary: ['followers', 'total_stars', 'public_repos'], sparkline: 'contributions' },
  'steam-guide-erenshor': {
    primary: ['views', 'rating', 'ratings', 'comment_count', 'award_count'],
    sparkline: 'views'
  },
  'steam-guide-ak': { primary: ['views', 'rating', 'ratings', 'comment_count', 'award_count'], sparkline: 'views' },
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
  'thunderstore-wowmuch': { primary: ['total_downloads', 'package_count'], sparkline: 'total_downloads' },
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
