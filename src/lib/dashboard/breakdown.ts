import type { MetricBreakdownConfig } from '$lib/sources/metrics';
import { latestMetricFromPoints } from './delta';
import type { MetricBreakdown, MetricBreakdownItem } from './types';

/** A raw `metric_points` row carrying its serialized `dimensions` JSON. */
export type BreakdownRow = { ts: number; value: number; dimensions: string | null };

/**
 * Group dimensioned metric rows into one ascending series per dimension value,
 * project each into a `LatestMetric` (latest sample + 24h delta), and sort by
 * latest value descending (ties broken alphabetically by key). Rows whose
 * `dimensions` JSON lacks the configured dimension key are skipped.
 */
export function buildMetricBreakdown(config: MetricBreakdownConfig, rows: readonly BreakdownRow[]): MetricBreakdown {
  const series = new Map<string, { ts: number; value: number }[]>();
  for (const row of rows) {
    const key = dimensionValue(row.dimensions, config.dimension);
    if (key === null) continue;
    const points = series.get(key);
    if (points) points.push({ ts: row.ts, value: row.value });
    else series.set(key, [{ ts: row.ts, value: row.value }]);
  }

  const items: MetricBreakdownItem[] = [...series.entries()].map(([key, points]) => {
    points.sort((a, b) => a.ts - b.ts);
    return { key, latest: latestMetricFromPoints(config.metric, points), points };
  });
  items.sort((a, b) => (b.latest.value ?? 0) - (a.latest.value ?? 0) || a.key.localeCompare(b.key));

  return { metric: config.metric, dimension: config.dimension, label: config.label, items };
}

function dimensionValue(raw: string | null, dimension: string): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = parsed[dimension];
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}
