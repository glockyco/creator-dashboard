import { describe, expect, it } from 'vitest';
import { summarizeLevelSeries, summarizePerformanceSeries } from './series';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 21 * DAY_MS;

function point(day: number, value: number) {
  return { ts: day * DAY_MS, value };
}

describe('summarizePerformanceSeries', () => {
  it('calculates selected-range and 24-hour absolute gains', () => {
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
  });

  it('reports a falling rating as a signed change instead of a counter reset', () => {
    const summary = summarizeLevelSeries([point(14, 0.8), point(20, 0.75), point(21, 0.7)], '7d', NOW, 1);

    expect(summary.total).toBe(0.7);
    expect(summary.dayGain).toBeCloseTo(-0.05);
    expect(summary.periodGain).toBeCloseTo(-0.1);
  });

  it('leaves a rating change unavailable without a boundary capture', () => {
    const summary = summarizeLevelSeries([point(18, 0.8), point(21, 0.7)], '7d', NOW, 1);

    expect(summary.total).toBe(0.7);
    expect(summary.dayGain).toBeNull();
    expect(summary.periodGain).toBeNull();
  });

  it('keeps every value unavailable when no capture exists', () => {
    expect(summarizePerformanceSeries([], '90d', NOW, 1)).toEqual({
      total: null,
      dayGain: null,
      periodGain: null,
      points: [],
      lastCapturedAt: null
    });
  });
});
