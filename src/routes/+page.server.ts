import type { PageServerLoad } from './$types';
import { getDashboardSnapshots } from '$lib/server/dashboard';
import type { IdentityFilter } from '$lib/types/domain';

export const load: PageServerLoad = async ({ platform, url }) => {
  const identity = parseIdentity(url.searchParams.get('identity'));
  const snapshots = platform?.env.DB ? await getDashboardSnapshots(platform.env.DB, { identity }) : [];

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
