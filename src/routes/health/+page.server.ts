import { error } from '@sveltejs/kit';
import { getHealthSnapshot } from '$lib/server/health/queries';

export const load = async ({ platform }) => {
  if (!platform?.env) throw error(500, 'Cloudflare platform env missing');
  return getHealthSnapshot(platform.env.DB);
};
