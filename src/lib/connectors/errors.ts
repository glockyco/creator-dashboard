export { FetchError } from './http';

export function parseRetryAfter(headers: Headers): number | null {
  const value = headers.get('Retry-After');
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.floor(seconds);

  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) return Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));

  return null;
}

export const isRateLimitStatus = (status: number) => status === 429;
export const isPermanentStatus = (status: number) => status === 401 || status === 403 || status === 404;
export const isTransientStatus = (status: number) => status >= 500;
