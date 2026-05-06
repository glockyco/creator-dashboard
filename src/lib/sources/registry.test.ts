import { describe, expect, it } from 'vitest';
import { SourceDef, sources } from './registry';

const fetcher = async () => ({ metric_points: [], events: [] });

describe('source registry', () => {
  it('contains the seven Tier 1 source IDs with approved cadences', () => {
    expect(sources.map((source) => source.id)).toEqual([
      'github-glockyco',
      'steam-guide-erenshor',
      'steam-guide-ak',
      'steam-reviews-erenshor',
      'steam-reviews-ak',
      'thunderstore-wowmuch',
      'erenshor-wiki-recent'
    ]);
    expect(sources.every((source) => source.cadenceHours === 1)).toBe(true);
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
      SourceDef.parse({ id: 'x', name: 'x', identity: 'glockyco', category: 'platform', cadenceHours: 1, fetcher: 'nope' })
    ).toThrow();
  });
});
