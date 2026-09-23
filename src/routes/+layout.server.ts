import type { LayoutServerLoad } from './$types';
import { getIssueSummary } from '$lib/server/incidents';
import { error } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ platform }) => {
  if (!platform?.env.DB) throw error(500, 'Cloudflare D1 binding missing');
  return { issueSummary: await getIssueSummary(platform.env.DB, Date.now()) };
};
