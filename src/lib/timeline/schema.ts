import { z } from 'zod';

export const timelineOverlays = ['posts', 'events'] as const;
export type TimelineOverlay = (typeof timelineOverlays)[number];

export type TimelineFilters = {
  since: string;
  until: string;
  sinceTs: number;
  untilTs: number;
  sourceIds: string[];
  overlays: TimelineOverlay[];
};

export type TimelineFilterOptions = {
  now?: Date;
  knownSourceIds: readonly string[];
};

const DateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const overlaySet = new Set<string>(timelineOverlays);
const dayMs = 86_400_000;

export function parseTimelineFilters(params: URLSearchParams, options: TimelineFilterOptions): TimelineFilters {
  const today = utcDay(options.now ?? new Date());
  const since = parseDateParam(params.get('since'), 'since', day(today.getTime() - 29 * dayMs));
  const until = parseDateParam(params.get('until'), 'until', day(today));
  const sinceTs = Date.parse(`${since}T00:00:00.000Z`);
  const untilTs = Date.parse(`${until}T23:59:59.999Z`);
  if (sinceTs > untilTs) throw new Error('since must be on or before until');

  const sourceIds = parseSourceIds(params.get('sources'), options.knownSourceIds);
  const overlays = parseOverlays(params.get('overlay'));
  return { since, until, sinceTs, untilTs, sourceIds, overlays };
}

function parseDateParam(value: string | null, name: 'since' | 'until', fallback: string): string {
  if (!value) return fallback;
  if (!DateParam.safeParse(value).success || day(new Date(`${value}T00:00:00.000Z`)) !== value)
    throw new Error(`invalid ${name} date`);
  return value;
}

function parseSourceIds(value: string | null, knownSourceIds: readonly string[]): string[] {
  if (!value) return [...knownSourceIds];
  const known = new Set(knownSourceIds);
  const sourceIds = value
    .split(',')
    .map((source) => source.trim())
    .filter(Boolean);
  for (const sourceId of sourceIds) {
    if (!known.has(sourceId)) throw new Error(`unknown timeline source: ${sourceId}`);
  }
  return [...new Set(sourceIds)];
}

function parseOverlays(value: string | null): TimelineOverlay[] {
  if (!value) return ['posts', 'events'];
  const overlays = value
    .split(',')
    .map((overlay) => overlay.trim())
    .filter(Boolean);
  if (overlays.length === 0) return [];
  for (const overlay of overlays) {
    if (!overlaySet.has(overlay)) throw new Error(`invalid overlay: ${overlay}`);
  }
  return [...new Set(overlays)] as TimelineOverlay[];
}

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function day(dateOrTs: Date | number): string {
  return new Date(dateOrTs).toISOString().slice(0, 10);
}
