import { describe, expect, it } from 'vitest';
import { SourceDef, sources } from './registry';

const fetcher = async () => ({ metric_points: [], events: [] });

describe('source registry', () => {
  it('contains only retained hourly collectors', () => {
    expect(sources.map((source) => source.id)).toEqual([
      'steam-guide-erenshor',
      'steam-guide-ak',
      'steam-guide-fractured-realms',
      'steam-guide-afallon',
      'steam-reviews-erenshor',
      'steam-reviews-ak',
      'steam-reviews-afallon',
      'thunderstore-wowmuch',
      'erenshor-vault-wowmuch',
      'erenshor-wiki-recent'
    ]);
    expect(sources.every((source) => source.cadenceHours === 1)).toBe(true);
    expect(sources.find((source) => source.id === 'steam-guide-afallon')?.config).toEqual({
      publishedfileid: '3800843227'
    });
    expect(sources.find((source) => source.id === 'steam-reviews-afallon')?.config).toEqual({ appid: '2597810' });
    expect(sources.find((source) => source.id === 'erenshor-vault-wowmuch')?.config).toMatchObject({
      mods: expect.arrayContaining(['interactive-map-companion'])
    });
  });

  it('accepts a valid source shape', () => {
    expect(
      SourceDef.parse({
        id: 'test-source',
        name: 'Test Source',
        identity: 'glockyco',
        category: 'platform',
        cadenceHours: 1,
        fetcher,
        config: {}
      }).id
    ).toBe('test-source');
  });

  it('rejects invalid identity, category, cadence, and fetcher', () => {
    expect(() =>
      SourceDef.parse({ id: 'x', name: 'x', identity: 'bad', category: 'platform', cadenceHours: 1, fetcher })
    ).toThrow();
    expect(() =>
      SourceDef.parse({ id: 'x', name: 'x', identity: 'glockyco', category: 'bad', cadenceHours: 1, fetcher })
    ).toThrow();
    expect(() =>
      SourceDef.parse({ id: 'x', name: 'x', identity: 'glockyco', category: 'platform', cadenceHours: 0, fetcher })
    ).toThrow();
    expect(() =>
      SourceDef.parse({
        id: 'x',
        name: 'x',
        identity: 'glockyco',
        category: 'platform',
        cadenceHours: 1,
        fetcher: 'nope'
      })
    ).toThrow();
  });
});
