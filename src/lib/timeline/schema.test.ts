import { describe, expect, it } from 'vitest';
import { parseTimelineFilters } from './schema';

const knownSourceIds = ['github-glockyco', 'steam-reviews-erenshor', 'thunderstore-wowmuch'];
const now = new Date('2026-05-04T12:00:00.000Z');

describe('parseTimelineFilters', () => {
  it('defaults to the last 30 UTC days, all known sources, and both overlays', () => {
    expect(parseTimelineFilters(new URLSearchParams(), { now, knownSourceIds })).toEqual({
      since: '2026-04-05',
      until: '2026-05-04',
      sinceTs: Date.parse('2026-04-05T00:00:00.000Z'),
      untilTs: Date.parse('2026-05-04T23:59:59.999Z'),
      sourceIds: knownSourceIds,
      overlays: ['posts', 'events']
    });
  });

  it('parses comma-separated source IDs and overlay values', () => {
    const params = new URLSearchParams({ since: '2026-04-01', until: '2026-05-04', sources: 'thunderstore-wowmuch,steam-reviews-erenshor', overlay: 'events' });

    expect(parseTimelineFilters(params, { now, knownSourceIds })).toMatchObject({
      since: '2026-04-01',
      until: '2026-05-04',
      sourceIds: ['thunderstore-wowmuch', 'steam-reviews-erenshor'],
      overlays: ['events']
    });
  });

  it('rejects invalid dates, inverted ranges, unknown sources, and unsupported overlays', () => {
    expect(() => parseTimelineFilters(new URLSearchParams({ since: '2026-02-31' }), { now, knownSourceIds })).toThrow('invalid since date');
    expect(() => parseTimelineFilters(new URLSearchParams({ since: '2026-05-05', until: '2026-05-04' }), { now, knownSourceIds })).toThrow('since must be on or before until');
    expect(() => parseTimelineFilters(new URLSearchParams({ sources: 'missing-source' }), { now, knownSourceIds })).toThrow('unknown timeline source');
    expect(() => parseTimelineFilters(new URLSearchParams({ overlay: 'posts,health' }), { now, knownSourceIds })).toThrow('invalid overlay');
  });
});
