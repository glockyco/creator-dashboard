import { z } from 'zod';
import { fetchJson } from '../http';
import type { FetcherInput, FetcherOutput } from '../types';

const Config = z.object({ namespace: z.string(), community: z.string().optional() });
const Package = z
  .object({
    namespace: z.string().optional(),
    owner: z.string().optional(),
    name: z.string(),
    download_count: z.number().optional(),
    total_downloads: z.number().optional(),
    versions: z.array(z.object({ downloads: z.number() })).optional()
  })
  .transform((pkg) => ({
    namespace: pkg.namespace ?? pkg.owner ?? '',
    name: pkg.name,
    download_count:
      pkg.download_count ??
      (pkg.total_downloads != null && pkg.total_downloads >= 0 ? pkg.total_downloads : undefined) ??
      pkg.versions?.reduce((sum, version) => sum + version.downloads, 0) ??
      0
  }));
const Response = z.union([
  z.array(Package),
  z.object({ results: z.array(Package) }).transform((response) => response.results)
]);

export async function fetchThunderstoreTeam({ source, now }: FetcherInput): Promise<FetcherOutput> {
  const config = Config.parse(source.config);
  const url = new URL(
    config.community
      ? `https://thunderstore.io/c/${config.community}/api/v1/package/`
      : 'https://thunderstore.io/api/v1/package/'
  );
  const data = await fetchJson(url, { schema: Response });
  const packages = data.filter((pkg) => pkg.namespace === config.namespace);

  return {
    metric_points: [
      {
        source_id: source.id,
        metric: 'total_downloads',
        ts: now,
        value: packages.reduce((sum, pkg) => sum + pkg.download_count, 0),
        dimensions: null
      },
      { source_id: source.id, metric: 'package_count', ts: now, value: packages.length, dimensions: null },
      ...packages.map((pkg) => ({
        source_id: source.id,
        metric: 'package_downloads',
        ts: now,
        value: pkg.download_count,
        dimensions: { package: pkg.name }
      }))
    ],
    events: []
  };
}
