import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { loadPerformance } from '$lib/server/performance';
import { getActivity } from '$lib/server/activity';
import { rangeDurationMs } from '$lib/performance/series';
import { selectRange } from '$lib/server/range';

export const load: PageServerLoad = async ({ platform, url, cookies, parent }) => {
  if (!platform?.env.DB) throw error(500, 'Cloudflare D1 binding missing');
  const now = Date.now();
  const range = selectRange(url, cookies);
  const since = now - rangeDurationMs(range);
  const [performance, reviews, wikiEdits, layout] = await Promise.all([
    loadPerformance(platform.env.DB, range, now),
    getActivity(platform.env.DB, { kind: 'review', since, limit: 6 }),
    getActivity(platform.env.DB, { kind: 'wiki_edit', since, limit: 6 }),
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
