import type { LayoutServerLoad } from './$types';
import { env } from 'cloudflare:workers';
import { getIssueSummary } from '#lib/server/incidents/index.js';
import { error } from '@sveltejs/kit';

export const load: LayoutServerLoad = async () => {
  if (!env.DB) throw error(500, 'Cloudflare D1 binding missing');
  return { issueSummary: await getIssueSummary(env.DB, Date.now()) };
};
