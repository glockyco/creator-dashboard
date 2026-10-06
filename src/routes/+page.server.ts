import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { loadPerformance, type Range } from '$lib/server/performance';
import { getActivity } from '$lib/server/activity';

export const load: PageServerLoad = async ({ platform, url, parent }) => {
  if (!platform?.env.DB) throw error(500, 'Cloudflare D1 binding missing');
  const now = Date.now();
  const selected = url.searchParams.get('range');
  const range: Range = selected === '7d' || selected === '90d' ? selected : '30d';
  const days = Number.parseInt(range, 10);
  const since = now - days * 86_400_000;
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
