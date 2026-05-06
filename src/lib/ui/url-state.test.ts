import { describe, expect, it } from 'vitest';
import { parseIdentityParam, setSearchParam } from './url-state';

describe('url-state', () => {
  it('parses identity filters and rejects unknown values', () => {
    expect(parseIdentityParam(null)).toBe('all');
    expect(parseIdentityParam('all')).toBe('all');
    expect(parseIdentityParam('glockyco')).toBe('glockyco');
    expect(parseIdentityParam('WoW_Much')).toBe('WoW_Much');
    expect(() => parseIdentityParam('unknown')).toThrow();
  });

  it('sets, replaces, and clears search params without mutating the source URL', () => {
    const url = new URL('https://dashboard.glockyco.com/?identity=glockyco&page=2');

    expect(setSearchParam(url, 'identity', 'WoW_Much')).toBe('/?identity=WoW_Much&page=2');
    expect(setSearchParam(url, 'identity', 'all')).toBe('/?page=2');
    expect(setSearchParam(url, 'identity', '')).toBe('/?page=2');
    expect(url.searchParams.get('identity')).toBe('glockyco');
  });
});
