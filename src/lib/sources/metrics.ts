export type SourceMetricConfig = {
  primary: string[];
  sparkline: string;
  eventKind?: string;
};

export const sourceMetrics: Record<string, SourceMetricConfig> = {
  'github-glockyco': { primary: ['followers', 'total_stars', 'public_repos'], sparkline: 'contributions' },
  'steam-guide-erenshor': { primary: ['views', 'rating', 'ratings'], sparkline: 'views' },
  'steam-guide-ak': { primary: ['views', 'rating', 'ratings'], sparkline: 'views' },
  'steam-reviews-erenshor': { primary: ['review_total', 'review_positive', 'review_negative'], sparkline: 'review_total', eventKind: 'review' },
  'steam-reviews-ak': { primary: ['review_total', 'review_positive', 'review_negative'], sparkline: 'review_total', eventKind: 'review' },
  'thunderstore-wowmuch': { primary: ['total_downloads', 'package_count'], sparkline: 'total_downloads' },
  'erenshor-wiki-recent': { primary: ['wiki_change_count'], sparkline: 'wiki_change_count', eventKind: 'wiki_edit' }
};
