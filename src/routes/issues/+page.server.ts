import { error } from '@sveltejs/kit';
import { getIssues } from '$lib/server/incidents';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
  if (!platform?.env) throw error(500, 'Cloudflare platform env missing');
  const now = Date.now();
  return { ...(await getIssues(platform.env.DB, now)), now };
};
