import { env } from 'cloudflare:workers';
import { getIssues } from '#lib/server/incidents/index.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const now = Date.now();
  return { ...(await getIssues(env.DB, now)), now };
};
