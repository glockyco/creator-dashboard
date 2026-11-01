import type { PageServerLoad } from './$types';
import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import { loadPerformanceAsset } from '#lib/server/performance.js';
import { selectRange } from '#lib/server/range.js';

export const load: PageServerLoad = async ({ params, url, cookies }) => {
  if (!env.DB) throw error(500, 'Cloudflare D1 binding missing');
  const range = selectRange(url, cookies);
  const asset = await loadPerformanceAsset(env.DB, params.asset_id, range, Date.now());
  if (!asset) throw error(404, 'Performance asset not found');
  return { asset, range };
};
