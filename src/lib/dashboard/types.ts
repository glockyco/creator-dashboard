import type { SourceDef } from '$lib/sources/registry';

export type SparkPoint = { ts: number; value: number };
export type LatestMetric = { metric: string; value: number | null; previousValue: number | null; delta: number | null };
export type LatestEvent = { ts: number; kind: string; title: string | null; author: string | null; url: string | null };
export type FetcherStatus = {
  last_run_at: number | null;
  last_success_at: number | null;
  last_status: string | null;
  last_error: string | null;
  consecutive_failures: number;
};
export type MetricBreakdownItem = {
  /** Dimension value identifying the series, e.g. a package name. */
  key: string;
  /** Latest value plus 24h delta for this series. */
  latest: LatestMetric;
  /** Full series within the queried window, ascending by ts. */
  points: SparkPoint[];
};
export type MetricBreakdown = {
  metric: string;
  dimension: string;
  label: string;
  items: MetricBreakdownItem[];
};
export type TileSnapshot = {
  source: Omit<SourceDef, 'fetcher'>;
  metrics: LatestMetric[];
  sparkline: SparkPoint[];
  latestEvents: LatestEvent[];
  status: FetcherStatus;
  breakdown: MetricBreakdown | null;
};
