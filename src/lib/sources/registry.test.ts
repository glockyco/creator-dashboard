import { describe, expect, it } from 'vitest';
import { SourceDef, sources } from './registry';

const fetcher = async () => ({ metric_points: [], events: [] });

describe('source registry', () => {
  it('contains Tier 1 and enabled analytics source IDs with approved cadences', () => {
    expect(sources.map((source) => source.id)).toEqual([
      'github-glockyco',
      'steam-guide-erenshor',
      'steam-guide-ak',
      'steam-reviews-erenshor',
      'steam-reviews-ak',
      'thunderstore-wowmuch',
      'erenshor-vault-wowmuch',
      'erenshor-wiki-recent',
      'gsc-glockyco-com',
      'gsc-ak-compendium',
      'gsc-ak-compendium-org',
      'gsc-erenshor-maps',
      'bing-glockyco-com',
      'bing-ak-compendium',
      'bing-ak-compendium-org',
      'bing-erenshor-maps',
      'cf-analytics-glockyco-com',
      'cf-analytics-ak-compendium',
      'cf-analytics-erenshor-maps',
      'ga4'
    ]);
    expect(
      sources.filter((source) => source.category !== 'analytics').every((source) => source.cadenceHours === 1)
    ).toBe(true);
    expect(
      sources.filter((source) => source.category === 'analytics').every((source) => source.cadenceHours === 24)
    ).toBe(true);
    expect(sources.some((source) => source.id === 'ga4')).toBe(true);
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
