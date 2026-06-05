import { z } from 'zod';
import { withSteamKey } from '../auth/steam';
import { fetchJson } from '../http';
import { fetchSteamGuideComments } from './steam-guide-comments';
import type { FetcherInput, FetcherOutput } from '../types';

const STEAM_REACTION_ICON_BASE = 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still';

const Config = z.object({ publishedfileid: z.string() });
const Reaction = z.object({ reactionid: z.number().int(), count: z.number().int() });
const Response = z.object({
  response: z.object({
    publishedfiledetails: z.array(
      z.object({
        publishedfileid: z.string(),
        result: z.number().int(),
        creator: z.union([z.string(), z.number()]).transform(String),
        views: z.number(),
        num_comments_public: z.number().int().optional(),
        reactions: z.array(Reaction).optional(),
        vote_data: z.object({ score: z.number(), votes_up: z.number(), votes_down: z.number() })
      })
    )
  })
});

export async function fetchSteamGuide({ source, env, now }: FetcherInput): Promise<FetcherOutput> {
  const config = Config.parse(source.config);
  const url = withSteamKey(new URL('https://api.steampowered.com/IPublishedFileService/GetDetails/v1/'), env);
  url.searchParams.set('publishedfileids[0]', config.publishedfileid);
  url.searchParams.set('includevotes', 'true');
  url.searchParams.set('includereactions', 'true');

  const data = await fetchJson(url, { method: 'GET', schema: Response });
  const detail = data.response.publishedfiledetails[0];
  if (!detail || detail.result !== 1)
    throw new Error(`Steam guide ${config.publishedfileid} was not returned successfully`);

  const comments = await fetchSteamGuideComments({ creator: detail.creator, publishedfileid: config.publishedfileid });
  const reactions = detail.reactions ?? [];
  const awardCount = reactions.reduce((sum, reaction) => sum + reaction.count, 0);

  return {
    metric_points: [
      { source_id: source.id, metric: 'views', ts: now, value: detail.views, dimensions: null },
      { source_id: source.id, metric: 'rating', ts: now, value: detail.vote_data.score, dimensions: null },
      {
        source_id: source.id,
        metric: 'ratings',
        ts: now,
        value: detail.vote_data.votes_up + detail.vote_data.votes_down,
        dimensions: null
      },
      {
        source_id: source.id,
        metric: 'comment_count',
        ts: now,
        value: comments.totalCount,
        dimensions: null
      },
      { source_id: source.id, metric: 'award_count', ts: now, value: awardCount, dimensions: null }
    ],
    events: comments.comments.map((event) => ({ ...event, source_id: source.id })),
    steam_guide_awards: reactions
      .filter((reaction) => reaction.count > 0)
      .map((reaction) => ({
        source_id: source.id,
        reaction_id: reaction.reactionid,
        count: reaction.count,
        icon_url: `${STEAM_REACTION_ICON_BASE}/${reaction.reactionid}.png?v=5`,
        captured_at: now
      }))
  };
}
