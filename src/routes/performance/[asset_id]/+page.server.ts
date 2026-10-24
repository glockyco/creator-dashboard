import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { loadPerformanceAsset } from '$lib/server/performance';
import { selectRange } from '$lib/server/range';

export const load: PageServerLoad = async ({ params, platform, url, cookies }) => {
  if (!platform?.env.DB) throw error(500, 'Cloudflare D1 binding missing');
  const range = selectRange(url, cookies);
  const asset = await loadPerformanceAsset(platform.env.DB, params.asset_id, range, Date.now());
  if (!asset) throw error(404, 'Performance asset not found');
  return { asset, range };
};
