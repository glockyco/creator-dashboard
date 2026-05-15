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
export type TileSnapshot = {
  source: Omit<SourceDef, 'fetcher'>;
  metrics: LatestMetric[];
  sparkline: SparkPoint[];
  latestEvents: LatestEvent[];
  status: FetcherStatus;
};
