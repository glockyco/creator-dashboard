import { Identity } from '$lib/identities';
import type { IdentityFilter } from '$lib/types/domain';

export function parseIdentityParam(value: string | null): IdentityFilter {
  if (!value || value === 'all') return 'all';
  return Identity.parse(value);
}

export function setSearchParam(url: URL, key: string, value: string | null): `/${string}` {
  const next = new URL(url);
  if (value === null || value === '' || value === 'all') next.searchParams.delete(key);
  else next.searchParams.set(key, value);
  return `${next.pathname}${next.search}` as `/${string}`;
}
