import { describe, expect, it } from 'vitest';
import { parseVerifyDeployArgs } from './verify-deploy';

describe('verify-deploy args', () => {
  it('defaults to production dashboard and safe source', () => {
    expect(parseVerifyDeployArgs([])).toEqual({
      baseUrl: 'https://dashboard.glockyco.com',
      sourceId: 'steam-reviews-erenshor',
      timeoutMs: 120_000
    });
  });
});
