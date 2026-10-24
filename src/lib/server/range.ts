import { error, type Cookies } from '@sveltejs/kit';
import type { Range } from '$lib/performance/series';

const RANGE_COOKIE = 'range';
const DEFAULT_RANGE: Range = '30d';

/**
 * The comparison range shared by Overview, Activity, and performance details. An explicit `range`
 * parameter wins and is remembered in a cookie, so plain navigation keeps the last choice and every
 * page renders with it on the first server load.
 */
export function selectRange(url: URL, cookies: Cookies): Range {
  const requested = url.searchParams.get('range');
  if (requested !== null) {
    if (!isRange(requested)) throw error(400, 'Invalid range');
    cookies.set(RANGE_COOKIE, requested, { path: '/', maxAge: 365 * 86_400, sameSite: 'lax', httpOnly: true });
    return requested;
  }
  const saved = cookies.get(RANGE_COOKIE);
  return saved !== undefined && isRange(saved) ? saved : DEFAULT_RANGE;
}

function isRange(value: string): value is Range {
  return value === '7d' || value === '30d' || value === '90d';
}
