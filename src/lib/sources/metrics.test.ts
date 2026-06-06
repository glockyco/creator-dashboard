import { describe, expect, it } from 'vitest';
import { sources } from './registry';
import { sourceMetrics } from './metrics';

describe('sourceMetrics', () => {
  it('defines dashboard metrics for every enabled source', () => {
    expect(Object.keys(sourceMetrics).sort()).toEqual(sources.map((source) => source.id).sort());
    expect(sourceMetrics['github-glockyco']).toEqual({
      primary: ['followers', 'total_stars', 'public_repos'],
      sparkline: 'contributions'
    });
    expect(sourceMetrics['steam-guide-erenshor']).toEqual({
      primary: ['views', 'rating', 'ratings', 'comment_count', 'award_count'],
      sparkline: 'views'
    });
    expect(sourceMetrics['steam-guide-ak']).toEqual({
      primary: ['views', 'rating', 'ratings', 'comment_count', 'award_count'],
      sparkline: 'views'
    });
    expect(sourceMetrics['steam-reviews-erenshor']).toMatchObject({
      primary: ['review_total', 'review_positive', 'review_negative'],
      sparkline: 'review_total',
      eventKind: 'review'
    });
    expect(sourceMetrics['erenshor-wiki-recent']).toMatchObject({
      primary: ['wiki_change_count'],
      sparkline: 'wiki_change_count',
      eventKind: 'wiki_edit'
    });
    expect(sourceMetrics['gsc-erenshor-maps']).toEqual({
      primary: ['clicks', 'impressions', 'ctr', 'position'],
      sparkline: 'clicks'
    });
    expect(sourceMetrics['cf-analytics-erenshor-maps']).toEqual({
      primary: ['visits', 'pageviews'],
      sparkline: 'visits'
    });
    expect(sourceMetrics['ga4']).toEqual({
      primary: ['active_users', 'sessions', 'views', 'event_count'],
      sparkline: 'active_users'
    });
    expect(sourceMetrics['thunderstore-wowmuch']).toEqual({
      primary: ['total_downloads', 'package_count'],
      sparkline: 'total_downloads',
      breakdown: { metric: 'package_downloads', dimension: 'package', label: 'Downloads per mod' }
    });
  });
});
