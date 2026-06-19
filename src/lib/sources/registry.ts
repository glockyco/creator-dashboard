import { z } from 'zod';
import { Identity } from '../identities';
import type { Fetcher, SourceCategory } from '../types/domain';
import * as fetchers from '../connectors/fetchers';
import { sourceRecords, type SourceRecord } from './registry-data';

export const SourceDef = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  identity: Identity,
  category: z.enum(['platform', 'analytics', 'event_feed']),
  cadenceHours: z.number().int().positive(),
  fetcher: z.custom<Fetcher>((value) => typeof value === 'function'),
  config: z.record(z.string(), z.unknown()).default({})
});

export type SourceDef = z.infer<typeof SourceDef> & { category: SourceCategory };

const fetcherByConnector = {
  github: fetchers.github,
  steamGuide: fetchers.steamGuide,
  steamReviews: fetchers.steamReviews,
  thunderstoreTeam: fetchers.thunderstoreTeam,
  erenshorVaultMods: fetchers.erenshorVaultMods,
  mediaWikiRecentChanges: fetchers.mediaWikiRecentChanges,
  gsc: fetchers.gsc,
  bingWebmaster: fetchers.bingWebmaster,
  cfAnalytics: fetchers.cfAnalytics,
  ga4: fetchers.ga4
} satisfies Record<SourceRecord['connector'], Fetcher>;

export const sources: SourceDef[] = z.array(SourceDef).parse(
  sourceRecords.map(({ connector, ...source }) => ({
    ...source,
    fetcher: fetcherByConnector[connector]
  }))
);

export function getSource(sourceId: string): SourceDef | undefined {
  return sources.find((source) => source.id === sourceId);
}
