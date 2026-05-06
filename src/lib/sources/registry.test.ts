import { describe, expect, it } from 'vitest';
import { SourceDef, sources } from './registry';

const fetcher = async () => ({ metric_points: [], events: [] });

describe('source registry', () => {
  it('starts empty until real connectors are enabled in Phase 3', () => {
    expect(sources).toEqual([]);
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
