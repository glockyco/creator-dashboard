import { z } from 'zod';
import { fetchJson } from '../http';
import type { FetcherInput, FetcherOutput } from '../types';

const Config = z.object({ namespace: z.string() });
const Package = z.object({ namespace: z.string(), name: z.string(), download_count: z.number() }).passthrough();
const Response = z.array(Package);

export async function fetchThunderstoreTeam({ source, now }: FetcherInput): Promise<FetcherOutput> {
  const config = Config.parse(source.config);
  const url = new URL('https://thunderstore.io/api/experimental/package/');
  const data = await fetchJson(url, { schema: Response });
  const packages = data.filter((pkg) => pkg.namespace === config.namespace);

  return {
    metric_points: [
      { source_id: source.id, metric: 'total_downloads', ts: now, value: packages.reduce((sum, pkg) => sum + pkg.download_count, 0), dimensions: null },
      { source_id: source.id, metric: 'package_count', ts: now, value: packages.length, dimensions: null },
      ...packages.map((pkg) => ({ source_id: source.id, metric: 'package_downloads', ts: now, value: pkg.download_count, dimensions: { package: pkg.name } }))
    ],
    events: []
  };
}
