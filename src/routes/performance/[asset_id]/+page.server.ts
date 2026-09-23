import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { loadPerformanceAsset, type Range } from '$lib/server/performance';

export const load: PageServerLoad = async ({ params, platform, url }) => {
  if (!platform?.env.DB) throw error(500, 'Cloudflare D1 binding missing');
  const selected = url.searchParams.get('range');
  const range: Range = selected === '7d' || selected === '90d' ? selected : '30d';
  const asset = await loadPerformanceAsset(platform.env.DB, params.asset_id, range, Date.now());
  if (!asset) throw error(404, 'Performance asset not found');
  return { asset, range };
};
