import { describe, expect, it } from 'vitest';
import { chooseAccessHeaders, isLoopbackBaseUrl, serviceTokenHeaders } from './access-headers.ts';

describe('isLoopbackBaseUrl', () => {
  it.each([
    ['http://127.0.0.1:8788', true],
    ['http://localhost:8788', true],
    ['http://[::1]:8788', true],
    ['https://dashboard.glockyco.com', false],
    ['https://preview.glockyco.com', false],
    ['not a url', false]
  ])('classifies %s as loopback=%s', (url, expected) => {
    expect(isLoopbackBaseUrl(url)).toBe(expected);
  });
});

describe('serviceTokenHeaders', () => {
  it('returns both Access service headers when env has both halves', () => {
    expect(serviceTokenHeaders({ CF_ACCESS_CLIENT_ID: 'abc.access', CF_ACCESS_CLIENT_SECRET: 'sekret' })).toEqual({
      'CF-Access-Client-Id': 'abc.access',
      'CF-Access-Client-Secret': 'sekret'
    });
  });

  it('returns null when either half is missing or empty', () => {
    expect(serviceTokenHeaders({})).toBeNull();
    expect(serviceTokenHeaders({ CF_ACCESS_CLIENT_ID: 'abc.access' })).toBeNull();
    expect(serviceTokenHeaders({ CF_ACCESS_CLIENT_SECRET: 'sekret' })).toBeNull();
    expect(serviceTokenHeaders({ CF_ACCESS_CLIENT_ID: '', CF_ACCESS_CLIENT_SECRET: 'sekret' })).toBeNull();
  });
});

describe('chooseAccessHeaders', () => {
  it('prefers service token headers when env has them, regardless of URL', async () => {
    const env = { CF_ACCESS_CLIENT_ID: 'id.access', CF_ACCESS_CLIENT_SECRET: 'secret' };
    expect(await chooseAccessHeaders('http://127.0.0.1:8788', env)).toEqual({
      'CF-Access-Client-Id': 'id.access',
      'CF-Access-Client-Secret': 'secret'
    });
    expect(await chooseAccessHeaders('https://dashboard.glockyco.com', env)).toEqual({
      'CF-Access-Client-Id': 'id.access',
      'CF-Access-Client-Secret': 'secret'
    });
  });

  it('throws a directive error when targeting a remote URL with no service token', async () => {
    await expect(chooseAccessHeaders('https://dashboard.glockyco.com', {})).rejects.toThrow(
      /CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET/
    );
  });
});
