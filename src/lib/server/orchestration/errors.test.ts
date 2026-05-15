import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { FetchError } from '$lib/connectors/http';
import { classify, parseRetryAfter } from './errors';

describe('orchestration error classification', () => {
  it('classifies schema drift as permanent', () => {
    const err = new z.ZodError([]);
    expect(classify(err)).toEqual({
      tier: 'permanent',
      statusCode: null,
      retryAfterSeconds: null,
      errorClass: 'schema_drift'
    });
  });

  it('classifies auth and not-found statuses as permanent', () => {
    expect(classify(new FetchError(401, 'unauthorized'))).toMatchObject({
      tier: 'permanent',
      statusCode: 401,
      errorClass: 'auth_dead'
    });
    expect(classify(new FetchError(403, 'forbidden'))).toMatchObject({
      tier: 'permanent',
      statusCode: 403,
      errorClass: 'auth_dead'
    });
    expect(classify(new FetchError(404, 'missing'))).toMatchObject({
      tier: 'permanent',
      statusCode: 404,
      errorClass: 'not_found'
    });
  });

  it('classifies rate limits with Retry-After', () => {
    const err = new FetchError(429, 'slow down', new Headers({ 'Retry-After': '42' }));
    expect(classify(err)).toEqual({
      tier: 'rate_limited',
      statusCode: 429,
      retryAfterSeconds: 42,
      errorClass: 'rate_limited'
    });
  });

  it('classifies 5xx and unknown errors as transient', () => {
    expect(classify(new FetchError(502, 'bad gateway'))).toEqual({
      tier: 'transient',
      statusCode: 502,
      retryAfterSeconds: 300,
      errorClass: 'upstream_5xx'
    });
    expect(classify(new Error('socket closed'))).toEqual({
      tier: 'transient',
      statusCode: null,
      retryAfterSeconds: 300,
      errorClass: 'network_or_unknown'
    });
  });

  it('parses date Retry-After values', () => {
    vi.setSystemTime(new Date('2026-05-04T00:00:00Z'));
    expect(parseRetryAfter(new Headers({ 'Retry-After': 'Mon, 04 May 2026 00:05:00 GMT' }))).toBe(300);
    vi.useRealTimers();
  });
});
