import { z } from 'zod';
import { withSteamKey } from '../auth/steam';
import { fetchJson } from '../http';
import type { FetcherInput, FetcherOutput } from '../types';

const Config = z.object({ publishedfileid: z.string() });
const Response = z.object({
  response: z.object({
    publishedfiledetails: z.array(
      z.object({
        publishedfileid: z.string(),
        result: z.number().int(),
        views: z.number(),
        vote_data: z.object({ score: z.number(), votes_up: z.number(), votes_down: z.number() })
      })
    )
  })
});

export async function fetchSteamGuide({ source, env, now }: FetcherInput): Promise<FetcherOutput> {
  const config = Config.parse(source.config);
  const url = withSteamKey(new URL('https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/'), env);
  url.searchParams.set('itemcount', '1');
  url.searchParams.set('publishedfileids[0]', config.publishedfileid);

  const data = await fetchJson(url, { method: 'GET', schema: Response });
  const detail = data.response.publishedfiledetails[0];
  if (!detail || detail.result !== 1) throw new Error(`Steam guide ${config.publishedfileid} was not returned successfully`);

  return {
    metric_points: [
      { source_id: source.id, metric: 'views', ts: now, value: detail.views, dimensions: null },
      { source_id: source.id, metric: 'rating', ts: now, value: detail.vote_data.score, dimensions: null },
      { source_id: source.id, metric: 'ratings', ts: now, value: detail.vote_data.votes_up + detail.vote_data.votes_down, dimensions: null }
    ],
    events: []
  };
}
