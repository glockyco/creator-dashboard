import { error } from '@sveltejs/kit';
import { getSourceDetail } from '$lib/server/source-detail';
import type { PageServerLoad } from './$types';

const defaultWindowMs = 30 * 24 * 3_600_000;

export const load: PageServerLoad = async ({ params, platform, url }) => {
  if (!platform?.env) throw error(500, 'Cloudflare platform env missing');

  const since = Number(url.searchParams.get('since') ?? Date.now() - defaultWindowMs);
  if (!Number.isFinite(since)) throw error(400, 'invalid since');

  const detail = await getSourceDetail(platform.env.DB, params.id, { since });
  if (!detail) throw error(404, 'unknown source');

  return { detail, url: url.toString() };
};
