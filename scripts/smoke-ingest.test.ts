import { describe, expect, it } from 'vitest';
import { parseSmokeIngestArgs, statusReachedSuccess } from './smoke-ingest';

describe('smoke-ingest helpers', () => {
  it('defaults to a safe public source and local base url', () => {
    expect(parseSmokeIngestArgs([])).toEqual({ sourceId: 'steam-reviews-erenshor', baseUrl: 'http://127.0.0.1:8788', timeoutMs: 60_000 });
  });

  it('accepts explicit source and timeout', () => {
    expect(parseSmokeIngestArgs(['--source', 'github-glockyco', '--base-url', 'https://dashboard.glockyco.com', '--timeout-ms', '5000'])).toEqual({ sourceId: 'github-glockyco', baseUrl: 'https://dashboard.glockyco.com', timeoutMs: 5_000 });
  });

  it('recognizes a successful fetcher status', () => {
    expect(statusReachedSuccess({ last_status: 'success', last_success_at: 123, consecutive_failures: 0 })).toBe(true);
    expect(statusReachedSuccess({ last_status: 'permanent_failure', last_success_at: null, consecutive_failures: 1 })).toBe(false);
  });
});
