import { describe, expect, it } from 'vitest';
import { parseSmokeCronArgs } from './smoke-cron';

describe('smoke-cron args', () => {
  it('defaults to hourly cron and safe source', () => {
    expect(parseSmokeCronArgs([])).toEqual({
      sourceId: 'steam-reviews-erenshor',
      baseUrl: 'http://127.0.0.1:8788',
      timeoutMs: 60_000
    });
  });
});
