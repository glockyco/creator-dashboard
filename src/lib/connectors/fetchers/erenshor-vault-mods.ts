import { z } from 'zod';
import { fetchJson } from '../http';
import type { FetcherInput, FetcherOutput } from '../types';

const Config = z.object({ mods: z.array(z.string().min(1)).min(1) });
const Mod = z.object({
  slug: z.string(),
  modRef: z.string(),
  name: z.string(),
  downloadCount: z.number(),
  viewCount: z.number()
});
const Response = z.object({ mods: z.array(Mod) });

export async function fetchErenshorVaultMods({ source, now }: FetcherInput): Promise<FetcherOutput> {
  const config = Config.parse(source.config);
  const configuredMods = new Set(config.mods);
  const data = await fetchJson(new URL('https://erenshorvault.app/api/mods'), { schema: Response });
  const matchedConfiguredMods = new Set<string>();
  const mods = data.mods.filter((mod) => {
    const slugMatches = configuredMods.has(mod.slug);
    const modRefMatches = configuredMods.has(mod.modRef);
    if (slugMatches) matchedConfiguredMods.add(mod.slug);
    if (modRefMatches) matchedConfiguredMods.add(mod.modRef);
    return slugMatches || modRefMatches;
  });
  const missingMods = config.mods.filter((mod) => !matchedConfiguredMods.has(mod));
  if (missingMods.length > 0) {
    throw new Error(`Erenshor Vault did not return configured mod(s): ${missingMods.join(', ')}`);
  }

  return {
    metric_points: [
      {
        source_id: source.id,
        metric: 'total_downloads',
        ts: now,
        value: mods.reduce((sum, mod) => sum + mod.downloadCount, 0),
        dimensions: null
      },
      {
        source_id: source.id,
        metric: 'total_views',
        ts: now,
        value: mods.reduce((sum, mod) => sum + mod.viewCount, 0),
        dimensions: null
      },
      { source_id: source.id, metric: 'mod_count', ts: now, value: mods.length, dimensions: null },
      ...mods.map((mod) => ({
        source_id: source.id,
        metric: 'mod_downloads',
        ts: now,
        value: mod.downloadCount,
        dimensions: { mod: mod.name, slug: mod.slug }
      })),
      ...mods.map((mod) => ({
        source_id: source.id,
        metric: 'mod_views',
        ts: now,
        value: mod.viewCount,
        dimensions: { mod: mod.name, slug: mod.slug }
      }))
    ],
    events: []
  };
}
