import { z } from 'zod';
import { FetchError, InvalidResponseError } from '$lib/connectors/http';
import { parseRetryAfter as parseConnectorRetryAfter } from '$lib/connectors/errors';

export type FailureTier = 'transient' | 'rate_limited' | 'permanent';
export type Failure = {
  tier: FailureTier;
  statusCode: number | null;
  retryAfterSeconds: number | null;
  errorClass: string;
};

export const parseRetryAfter = parseConnectorRetryAfter;

export function classify(err: unknown): Failure {
  if (err instanceof z.ZodError)
    return { tier: 'permanent', statusCode: null, retryAfterSeconds: null, errorClass: 'schema_drift' };
  if (err instanceof InvalidResponseError)
    return { tier: 'permanent', statusCode: err.status, retryAfterSeconds: null, errorClass: 'invalid_response' };
  if (err instanceof FetchError) {
    if (err.status === 429)
      return {
        tier: 'rate_limited',
        statusCode: 429,
        retryAfterSeconds: parseRetryAfter(err.headers) ?? 600,
        errorClass: 'rate_limited'
      };
    if (err.status === 401 || err.status === 403)
      return { tier: 'permanent', statusCode: err.status, retryAfterSeconds: null, errorClass: 'auth_dead' };
    if (err.status === 404)
      return { tier: 'permanent', statusCode: 404, retryAfterSeconds: null, errorClass: 'not_found' };
    // 408 is a timeout; every other 4xx means the request no longer matches the upstream API.
    if (err.status >= 400 && err.status < 500 && err.status !== 408)
      return { tier: 'permanent', statusCode: err.status, retryAfterSeconds: null, errorClass: 'client_error' };
    if (err.status >= 500)
      return { tier: 'transient', statusCode: err.status, retryAfterSeconds: 300, errorClass: 'upstream_5xx' };
    return { tier: 'transient', statusCode: err.status, retryAfterSeconds: 300, errorClass: 'network_or_unknown' };
  }
  return { tier: 'transient', statusCode: null, retryAfterSeconds: 300, errorClass: 'network_or_unknown' };
}
