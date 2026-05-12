import type { LatestMetric, SparkPoint } from './types';

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Maximum distance from the 24h-prior target a point may sit at and still be
 * accepted as the baseline. Both hourly (ts = run-time) and daily (ts =
 * midnight UTC of the report date) cadences fall well inside ±12h of the
 * exact 24h-prior target; anything further away signals a missed run or a
 * gap in the series, where reporting a "vs 24h ago" delta would be
 * misleading.
 */
const TOLERANCE_MS = 12 * 60 * 60 * 1000;

/**
 * Returns the point in `points` whose `ts` is closest in time to
 * `latest.ts - 24h`, considering only points strictly older than `latest`.
 * Returns `undefined` when no candidate exists within ±12h of the target.
 *
 * `points` does not need to be sorted.
 */
export function findPointAt24hPrior<T extends { ts: number }>(
  points: readonly T[],
  latest: T
): T | undefined {
  const target = latest.ts - DAY_MS;
  let best: T | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const point of points) {
    if (point.ts >= latest.ts) continue;
    const distance = Math.abs(point.ts - target);
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return bestDistance <= TOLERANCE_MS ? best : undefined;
}

/**
 * Build the `LatestMetric` projection used by the dashboard tile, source
 * detail header, and digest formatter from an ordered or unordered series of
 * sparkline points. `value` is the latest sample; `previousValue` is the
 * sample closest to 24h before it; `delta = value - previousValue` or `null`
 * when no usable 24h baseline exists.
 */
export function latestMetricFromPoints(
  metric: string,
  points: readonly SparkPoint[]
): LatestMetric {
  let latest: SparkPoint | undefined;
  for (const point of points) {
    if (!latest || point.ts > latest.ts) latest = point;
  }
  const prior = latest ? findPointAt24hPrior(points, latest) : undefined;
  return {
    metric,
    value: latest?.value ?? null,
    previousValue: prior?.value ?? null,
    delta: latest && prior ? latest.value - prior.value : null
  };
}
