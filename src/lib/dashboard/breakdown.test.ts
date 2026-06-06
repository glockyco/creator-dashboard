import { describe, expect, it } from 'vitest';
import { buildMetricBreakdown, type BreakdownRow } from './breakdown';

const DAY_MS = 86_400_000;
const config = { metric: 'package_downloads', dimension: 'package', label: 'Downloads per mod' };

describe('buildMetricBreakdown', () => {
  it('groups rows by dimension value, computes 24h deltas, and sorts by latest value', () => {
    const rows: BreakdownRow[] = [
      { ts: DAY_MS, value: 100, dimensions: '{"package":"MapPins"}' },
      { ts: 2 * DAY_MS, value: 130, dimensions: '{"package":"MapPins"}' },
      { ts: DAY_MS, value: 900, dimensions: '{"package":"BigMod"}' },
      { ts: 2 * DAY_MS, value: 950, dimensions: '{"package":"BigMod"}' }
    ];

    const breakdown = buildMetricBreakdown(config, rows);

    expect(breakdown).toEqual({
      metric: 'package_downloads',
      dimension: 'package',
      label: 'Downloads per mod',
      items: [
        {
          key: 'BigMod',
          latest: { metric: 'package_downloads', value: 950, previousValue: 900, delta: 50 },
          points: [
            { ts: DAY_MS, value: 900 },
            { ts: 2 * DAY_MS, value: 950 }
          ]
        },
        {
          key: 'MapPins',
          latest: { metric: 'package_downloads', value: 130, previousValue: 100, delta: 30 },
          points: [
            { ts: DAY_MS, value: 100 },
            { ts: 2 * DAY_MS, value: 130 }
          ]
        }
      ]
    });
  });

  it('orders each series ascending by ts regardless of row order', () => {
    const rows: BreakdownRow[] = [
      { ts: 2 * DAY_MS, value: 130, dimensions: '{"package":"MapPins"}' },
      { ts: DAY_MS, value: 100, dimensions: '{"package":"MapPins"}' }
    ];

    expect(buildMetricBreakdown(config, rows).items[0].points).toEqual([
      { ts: DAY_MS, value: 100 },
      { ts: 2 * DAY_MS, value: 130 }
    ]);
  });

  it('skips rows missing the dimension key or with unparseable dimensions', () => {
    const rows: BreakdownRow[] = [
      { ts: DAY_MS, value: 5, dimensions: null },
      { ts: DAY_MS, value: 5, dimensions: '{"repo":"other"}' },
      { ts: DAY_MS, value: 5, dimensions: 'not json' },
      { ts: DAY_MS, value: 42, dimensions: '{"package":"OnlyOne"}' }
    ];

    const breakdown = buildMetricBreakdown(config, rows);

    expect(breakdown.items).toEqual([
      {
        key: 'OnlyOne',
        latest: { metric: 'package_downloads', value: 42, previousValue: null, delta: null },
        points: [{ ts: DAY_MS, value: 42 }]
      }
    ]);
  });

  it('returns no items for an empty row set', () => {
    expect(buildMetricBreakdown(config, []).items).toEqual([]);
  });
});
