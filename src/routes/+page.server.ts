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
  const [performance, activity, layout] = await Promise.all([
    loadPerformance(platform.env.DB, range, now),
    getActivity(platform.env.DB, { since: now - days * 86_400_000, limit: 2 }),
    parent()
  ]);
  return { performance, activity: activity.items, issueSummary: layout.issueSummary, range };
};
