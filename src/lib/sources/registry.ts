import { z } from 'zod';
import { Identity } from '$lib/identities';
import type { Fetcher, SourceCategory } from '$lib/types/domain';

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

export const sources: SourceDef[] = z.array(SourceDef).parse([]);

export function getSource(sourceId: string): SourceDef | undefined {
  return sources.find((source) => source.id === sourceId);
}
