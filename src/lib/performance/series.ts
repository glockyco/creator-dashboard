export type Range = '7d' | '30d' | '90d';

export type PerformancePoint = {
  ts: number;
  value: number;
};

export type PerformanceSeriesSummary = {
  total: number | null;
  dayGain: number | null;
  periodGain: number | null;
  points: PerformancePoint[];
  lastCapturedAt: number | null;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const rangeDurations: Record<Range, number> = {
  '7d': 7 * DAY_MS,
  '30d': 30 * DAY_MS,
  '90d': 90 * DAY_MS
};

export function rangeDurationMs(range: Range): number {
  return rangeDurations[range];
}

/** Allow one missed scheduled capture at a period boundary. */
export function boundaryToleranceMs(cadenceHours: number): number {
  return Math.max(cadenceHours, 1) * 2 * HOUR_MS;
}

export function summarizePerformanceSeries(
  input: readonly PerformancePoint[],
  range: Range,
  now: number,
  cadenceHours: number
): PerformanceSeriesSummary {
  return summarizeSeries(input, range, now, cadenceHours, false);
}

/** A rating can rise or fall; report its signed change instead of treating a fall as a counter reset. */
export function summarizeLevelSeries(
  input: readonly PerformancePoint[],
  range: Range,
  now: number,
  cadenceHours: number
): PerformanceSeriesSummary {
  return summarizeSeries(input, range, now, cadenceHours, true);
}

function summarizeSeries(
  input: readonly PerformancePoint[],
  range: Range,
  now: number,
  cadenceHours: number,
  allowDecrease: boolean
): PerformanceSeriesSummary {
  const points = input
    .filter((point) => Number.isFinite(point.ts) && Number.isFinite(point.value) && point.ts <= now)
    .sort((left, right) => left.ts - right.ts);
  const latest = points.at(-1);
  const periodMs = rangeDurationMs(range);
  const periodBoundary = now - periodMs;
  const toleranceMs = boundaryToleranceMs(cadenceHours);
  const trend = points.filter((point) => point.ts >= periodBoundary);

  if (!latest) {
    return {
      total: null,
      dayGain: null,
      periodGain: null,
      points: trend,
      lastCapturedAt: null
    };
  }

  const latestIsEligible = now - latest.ts <= toleranceMs;
  const dayBaseline = findPastBaseline(points, now - DAY_MS, toleranceMs);
  const periodBaseline = findPastBaseline(points, periodBoundary, toleranceMs);
  const dayGain = latestIsEligible ? intervalChange(points, dayBaseline, latest, allowDecrease) : null;
  const periodGain = latestIsEligible ? intervalChange(points, periodBaseline, latest, allowDecrease) : null;

  return {
    total: latest.value,
    dayGain,
    periodGain,
    points: trend,
    lastCapturedAt: latest.ts
  };
}

function findPastBaseline(
  points: readonly PerformancePoint[],
  boundary: number,
  toleranceMs: number
): PerformancePoint | undefined {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (point.ts > boundary) continue;
    return boundary - point.ts <= toleranceMs ? point : undefined;
  }
  return undefined;
}

function intervalChange(
  points: readonly PerformancePoint[],
  start: PerformancePoint | undefined,
  end: PerformancePoint | undefined,
  allowDecrease: boolean
): number | null {
  if (!start || !end || start.ts >= end.ts) return null;

  if (!allowDecrease) {
    let previousValue = start.value;
    for (const point of points) {
      if (point.ts <= start.ts) continue;
      if (point.ts > end.ts) break;
      if (point.value < previousValue) return null;
      previousValue = point.value;
    }
  }

  return end.value - start.value;
}
