import { z } from 'zod';
import { fetchJson, InvalidResponseError } from '../http';
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
    // Undefined when Thunderstore reports no count at all, which must not be recorded as zero downloads.
    download_count:
      pkg.download_count ??
      (pkg.total_downloads != null && pkg.total_downloads >= 0 ? pkg.total_downloads : undefined) ??
      pkg.versions?.reduce((sum, version) => sum + version.downloads, 0)
  }));
type Package = z.infer<typeof Package>;
// The community endpoint returns a plain list; the paginated shape links to further pages.
const Response = z.union([
  z.array(Package).transform((packages) => ({ packages, next: null })),
  z
    .object({ results: z.array(Package), next: z.string().nullable().optional() })
    .transform((page) => ({ packages: page.results, next: page.next ?? null }))
]);

// Guards against a pagination loop; a community has far fewer pages than this.
const MAX_PAGES = 50;

export async function fetchThunderstoreTeam({ source, now }: FetcherInput): Promise<FetcherOutput> {
  const config = Config.parse(source.config);
  let url: string | null = config.community
    ? `https://thunderstore.io/c/${config.community}/api/v1/package/`
    : 'https://thunderstore.io/api/v1/package/';
  const all: Package[] = [];
  for (let page = 0; url; page += 1) {
    if (page === MAX_PAGES) throw new Error(`Thunderstore packages did not end within ${MAX_PAGES} pages`);
    const data: z.infer<typeof Response> = await fetchJson(new URL(url), { schema: Response });
    all.push(...data.packages);
    url = data.next;
  }

  const packages = all.filter((pkg) => pkg.namespace === config.namespace);
  if (packages.length === 0)
    throw new InvalidResponseError(`Thunderstore returned no packages for namespace ${config.namespace}`);
  const counted = packages.map((pkg) => {
    if (pkg.download_count === undefined)
      throw new InvalidResponseError(`Thunderstore returned no download count for ${pkg.name}`);
    return { name: pkg.name, downloads: pkg.download_count };
  });

  return {
    metric_points: [
      {
        source_id: source.id,
        metric: 'total_downloads',
        ts: now,
        value: counted.reduce((sum, pkg) => sum + pkg.downloads, 0),
        dimensions: null
      },
      { source_id: source.id, metric: 'package_count', ts: now, value: counted.length, dimensions: null },
      ...counted.map((pkg) => ({
        source_id: source.id,
        metric: 'package_downloads',
        ts: now,
        value: pkg.downloads,
        dimensions: { package: pkg.name }
      }))
    ],
    events: []
  };
}
