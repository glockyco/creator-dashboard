import { describe, expect, it } from 'vitest';
import { parseVerifyDeployArgs } from './verify-deploy';

describe('verify-deploy args', () => {
  it('defaults to the production dashboard', () => {
    expect(parseVerifyDeployArgs([])).toEqual({
      baseUrl: 'https://dashboard.glockyco.com'
    });
  });
});
