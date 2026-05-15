import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getDashboardSnapshots } from '$lib/server/dashboard';
import type { IdentityFilter } from '$lib/types/domain';

export const load: PageServerLoad = async ({ platform, url }) => {
  const identity = parseIdentity(url.searchParams.get('identity'));
  if (!platform?.env.DB) throw error(500, 'Cloudflare D1 binding missing');
  const snapshots = await getDashboardSnapshots(platform.env.DB, { identity });

  return {
    title: 'Creator Dashboard',
    snapshots,
    identity,
    url: url.toString()
  };
};

function parseIdentity(value: string | null): IdentityFilter {
  if (value === 'glockyco' || value === 'WoW_Much') return value;
  return 'all';
}
