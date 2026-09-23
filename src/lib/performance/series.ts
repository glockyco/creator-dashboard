export type Range = '7d' | '30d' | '90d';

export type PerformancePoint = {
  ts: number;
  value: number;
};

export type PerformanceSeriesSummary = {
  total: number | null;
  dayGain: number | null;
  periodGain: number | null;
  previousGain: number | null;
  comparisonPct: number | null;
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
  const points = input
    .filter((point) => Number.isFinite(point.ts) && Number.isFinite(point.value) && point.ts <= now)
    .sort((left, right) => left.ts - right.ts);
  const latest = points.at(-1);
  const periodMs = rangeDurationMs(range);
  const periodBoundary = now - periodMs;
  const previousBoundary = periodBoundary - periodMs;
  const toleranceMs = boundaryToleranceMs(cadenceHours);
  const trend = points.filter((point) => point.ts >= periodBoundary);

  if (!latest) {
    return {
      total: null,
      dayGain: null,
      periodGain: null,
      previousGain: null,
      comparisonPct: null,
      points: trend,
      lastCapturedAt: null
    };
  }

  const latestIsEligible = now - latest.ts <= toleranceMs;
  const dayBaseline = findPastBaseline(points, now - DAY_MS, toleranceMs);
  const periodBaseline = findPastBaseline(points, periodBoundary, toleranceMs);
  const previousBaseline = findPastBaseline(points, previousBoundary, toleranceMs);

  const dayGain = latestIsEligible ? cumulativeGain(points, dayBaseline, latest) : null;
  const periodGain = latestIsEligible ? cumulativeGain(points, periodBaseline, latest) : null;
  const previousGain = cumulativeGain(points, previousBaseline, periodBaseline);
  const comparisonPct =
    periodGain !== null && previousGain !== null && previousGain !== 0
      ? ((periodGain - previousGain) / previousGain) * 100
      : null;

  return {
    total: latest.value,
    dayGain,
    periodGain,
    previousGain,
    comparisonPct,
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

function cumulativeGain(
  points: readonly PerformancePoint[],
  start: PerformancePoint | undefined,
  end: PerformancePoint | undefined
): number | null {
  if (!start || !end || start.ts >= end.ts) return null;

  let previousValue = start.value;
  for (const point of points) {
    if (point.ts <= start.ts) continue;
    if (point.ts > end.ts) break;
    if (point.value < previousValue) return null;
    previousValue = point.value;
  }

  return end.value - start.value;
}
