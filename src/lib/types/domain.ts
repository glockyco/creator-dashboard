import type { z } from 'zod';
import type { Identity } from '$lib/identities';
import type { SourceDef } from '$lib/sources/registry';

export type JsonRecord = Record<string, string | number | boolean | null>;

export type MetricPoint = {
  source_id: string;
  metric: string;
  ts: number;
  value: number;
  dimensions: JsonRecord | null;
};

export type EventRow = {
  source_id: string;
  external_id: string;
  ts: number;
  kind: string;
  author: string | null;
  title: string | null;
  body: string | null;
  url: string | null;
  metadata: Record<string, unknown> | null;
};

export type SteamGuideAward = {
  source_id: string;
  reaction_id: number;
  count: number;
  icon_url: string;
  captured_at: number;
};

export type FetcherInput = { source: SourceDef; env: Env; now: number };
export type FetcherOutput = {
  metric_points: MetricPoint[];
  events: EventRow[];
  steam_guide_awards?: SteamGuideAward[];
};
export type Fetcher = (input: FetcherInput) => Promise<FetcherOutput>;
export type SourceCategory = 'platform' | 'analytics' | 'event_feed';
export type IdentityFilter = Identity | 'all';
export type ZodInfer<T extends z.ZodTypeAny> = z.infer<T>;
