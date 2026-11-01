import type { PageServerLoad } from './$types';
import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import { loadPerformance } from '#lib/server/performance.js';
import { getActivity } from '#lib/server/activity.js';
import { rangeDurationMs } from '#lib/performance/series.js';
import { selectRange } from '#lib/server/range.js';

export const load: PageServerLoad = async ({ url, cookies, parent }) => {
  if (!env.DB) throw error(500, 'Cloudflare D1 binding missing');
  const now = Date.now();
  const range = selectRange(url, cookies);
  const since = now - rangeDurationMs(range);
  const [performance, reviews, wikiEdits, layout] = await Promise.all([
    loadPerformance(env.DB, range, now),
    getActivity(env.DB, { kind: 'review', since, limit: 6 }),
    getActivity(env.DB, { kind: 'wiki_edit', since, limit: 6 }),
    parent()
  ]);
  return {
    performance,
    activitySections: [
      {
        id: 'reviews',
        title: 'Reviews',
        type: 'review',
        empty: 'No Steam reviews in this range.',
        items: reviews.items
      },
      {
        id: 'wiki',
        title: 'Wiki edits',
        type: 'wiki_edit',
        empty: 'No wiki changes in this range.',
        items: wikiEdits.items
      }
    ],
    issueSummary: layout.issueSummary,
    range
  };
};
