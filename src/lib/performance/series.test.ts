import { describe, expect, it } from 'vitest';
import { summarizePerformanceSeries } from './series';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 21 * DAY_MS;

function point(day: number, value: number) {
  return { ts: day * DAY_MS, value };
}

describe('summarizePerformanceSeries', () => {
  it('compares the selected period with the preceding equal period', () => {
    const summary = summarizePerformanceSeries(
      [point(21, 150), point(7, 100), point(20, 145), point(14, 120)],
      '7d',
      NOW,
      1
    );

    expect(summary).toEqual({
      total: 150,
      dayGain: 5,
      periodGain: 30,
      previousGain: 20,
      comparisonPct: 50,
      points: [point(14, 120), point(20, 145), point(21, 150)],
      lastCapturedAt: NOW
    });
  });

  it('uses only past samples as boundary baselines', () => {
    const minute = 60 * 1000;
    const summary = summarizePerformanceSeries(
      [
        point(7, 70),
        { ts: 14 * DAY_MS - 60 * minute, value: 90 },
        { ts: 14 * DAY_MS + minute, value: 100 },
        point(21, 130)
      ],
      '7d',
      NOW,
      1
    );

    expect(summary.periodGain).toBe(40);
  });

  it('rejects sparse baselines outside the cadence tolerance', () => {
    const summary = summarizePerformanceSeries(
      [point(7, 50), { ts: 14 * DAY_MS - 3 * 60 * 60 * 1000, value: 70 }, point(21, 90)],
      '7d',
      NOW,
      1
    );

    expect(summary.periodGain).toBeNull();
    expect(summary.previousGain).toBeNull();
    expect(summary.comparisonPct).toBeNull();
  });

  it('invalidates only gains whose interval contains a counter reset', () => {
    const summary = summarizePerformanceSeries(
      [point(7, 100), point(14, 120), point(16, 130), point(17, 5), point(20, 15), point(21, 20)],
      '7d',
      NOW,
      1
    );

    expect(summary.total).toBe(20);
    expect(summary.dayGain).toBe(5);
    expect(summary.periodGain).toBeNull();
    expect(summary.previousGain).toBe(20);
    expect(summary.comparisonPct).toBeNull();
  });

  it('does not calculate a percentage from a zero prior gain', () => {
    const summary = summarizePerformanceSeries([point(7, 100), point(14, 100), point(21, 110)], '7d', NOW, 1);

    expect(summary.periodGain).toBe(10);
    expect(summary.previousGain).toBe(0);
    expect(summary.comparisonPct).toBeNull();
  });

  it('keeps every value unavailable when no capture exists', () => {
    expect(summarizePerformanceSeries([], '90d', NOW, 1)).toEqual({
      total: null,
      dayGain: null,
      periodGain: null,
      previousGain: null,
      comparisonPct: null,
      points: [],
      lastCapturedAt: null
    });
  });
});
