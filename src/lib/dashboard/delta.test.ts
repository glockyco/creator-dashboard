import { describe, expect, it } from 'vitest';
import { DAY_MS, findPointAt24hPrior, latestMetricFromPoints } from './delta';

const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

describe('findPointAt24hPrior', () => {
  it('returns the point exactly 24h before the latest sample', () => {
    const points = [
      { ts: 0, value: 1 },
      { ts: DAY_MS, value: 2 },
      { ts: 2 * DAY_MS, value: 3 }
    ];
    const latest = points[2];
    expect(findPointAt24hPrior(points, latest)).toBe(points[1]);
  });

  it('prefers the point closest to the 24h target when an hourly series has drift', () => {
    const latest = { ts: 100 * HOUR_MS, value: 99 };
    const points = [
      { ts: latest.ts - 23 * HOUR_MS, value: 23 },
      { ts: latest.ts - 24 * HOUR_MS - MIN_MS, value: 24 },
      { ts: latest.ts - 25 * HOUR_MS, value: 25 },
      latest
    ];
    expect(findPointAt24hPrior(points, latest)).toEqual({ ts: latest.ts - 24 * HOUR_MS - MIN_MS, value: 24 });
  });

  it('ignores points at or after the latest sample', () => {
    const latest = { ts: 2 * DAY_MS, value: 10 };
    const points = [{ ts: DAY_MS, value: 9 }, latest, { ts: 3 * DAY_MS, value: 11 }];
    expect(findPointAt24hPrior(points, latest)).toEqual({ ts: DAY_MS, value: 9 });
  });

  it('returns undefined when the closest earlier point is outside the 12h tolerance', () => {
    const latest = { ts: 10 * DAY_MS, value: 50 };
    const points = [{ ts: latest.ts - 5 * DAY_MS, value: 5 }, { ts: latest.ts - HOUR_MS, value: 49 }, latest];
    expect(findPointAt24hPrior(points, latest)).toBeUndefined();
  });

  it('returns undefined when only the latest point exists', () => {
    const latest = { ts: DAY_MS, value: 1 };
    expect(findPointAt24hPrior([latest], latest)).toBeUndefined();
  });
});

describe('latestMetricFromPoints', () => {
  it('builds value, previousValue, and delta from a 24h-prior baseline', () => {
    const points = [
      { ts: 0, value: 10 },
      { ts: DAY_MS, value: 12 }
    ];
    expect(latestMetricFromPoints('followers', points)).toEqual({
      metric: 'followers',
      value: 12,
      previousValue: 10,
      delta: 2
    });
  });

  it('emits null delta when only one sample exists', () => {
    expect(latestMetricFromPoints('followers', [{ ts: DAY_MS, value: 12 }])).toEqual({
      metric: 'followers',
      value: 12,
      previousValue: null,
      delta: null
    });
  });

  it('emits null delta when prior samples are outside the 12h tolerance', () => {
    const latest = { ts: 10 * DAY_MS, value: 20 };
    const points = [{ ts: latest.ts - 3 * DAY_MS, value: 17 }, { ts: latest.ts - HOUR_MS, value: 19 }, latest];
    expect(latestMetricFromPoints('clicks', points)).toEqual({
      metric: 'clicks',
      value: 20,
      previousValue: null,
      delta: null
    });
  });

  it('emits all-null when the series is empty', () => {
    expect(latestMetricFromPoints('clicks', [])).toEqual({
      metric: 'clicks',
      value: null,
      previousValue: null,
      delta: null
    });
  });

  it('handles unordered series by picking the latest ts and the closest 24h-prior ts', () => {
    const points = [
      { ts: DAY_MS, value: 5 },
      { ts: 0, value: 1 },
      { ts: 2 * DAY_MS, value: 9 }
    ];
    expect(latestMetricFromPoints('ctr', points)).toEqual({
      metric: 'ctr',
      value: 9,
      previousValue: 5,
      delta: 4
    });
  });
});
