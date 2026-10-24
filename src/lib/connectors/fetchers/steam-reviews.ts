import { z } from 'zod';
import { fetchJson, InvalidResponseError } from '../http';
import type { FetcherInput, FetcherOutput } from '../types';

const Config = z.object({
  appid: z.string(),
  // Each run re-reads reviews created or edited in this window, so a shorter outage loses nothing.
  lookbackDays: z.number().int().positive().default(7)
});
const Review = z.object({
  recommendationid: z.string(),
  author: z
    .object({
      steamid: z.string().optional(),
      playtime_forever: z.number().optional(),
      playtime_at_review: z.number().optional()
    })
    .passthrough(),
  language: z.string().optional(),
  review: z.string(),
  timestamp_created: z.number(),
  timestamp_updated: z.number().optional(),
  voted_up: z.boolean(),
  votes_up: z.number().optional(),
  weighted_vote_score: z.number().optional(),
  comment_count: z.number().optional(),
  steam_purchase: z.boolean().optional(),
  received_for_free: z.boolean().optional()
});
// GetAppReviews omits `reviews` on an empty page, returns the score fields only on the first page,
// and returns an empty `response` for an unknown app.
const Summary = z.object({
  total_reviews: z.number(),
  review_score: z.number(),
  total_positive: z.number(),
  total_negative: z.number()
});
const Response = z.object({
  response: z.object({
    query_summary: z.unknown().optional(),
    reviews: z.array(Review).default([]),
    cursor: z.string().optional()
  })
});

// Enum values from https://partner.steamgames.com/doc/webapi/IUserReviewsService#Enums
const FILTER_UPDATED = 2;
const PURCHASE_TYPE_ALL = 1;
// Guards against a cursor loop. 20 pages of 100 is far beyond these games' weekly review volume.
const MAX_PAGES = 20;
const PAGE_SIZE = 100;

export async function fetchSteamReviews({ source, now }: FetcherInput): Promise<FetcherOutput> {
  const config = Config.parse(source.config);
  const cutoffSeconds = (now - config.lookbackDays * 86_400_000) / 1000;
  const reviews: z.infer<typeof Review>[] = [];
  let metricPoints: FetcherOutput['metric_points'] = [];
  let cursor = '*';

  for (let page = 0; ; page += 1) {
    if (page === MAX_PAGES)
      throw new Error(`Steam reviews did not reach the lookback window within ${MAX_PAGES} pages`);
    const url = new URL('https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/');
    url.searchParams.set(
      'input_json',
      JSON.stringify({
        appid: Number(config.appid),
        filter: FILTER_UPDATED,
        languages: ['all'],
        purchase_type: PURCHASE_TYPE_ALL,
        num_per_page: PAGE_SIZE,
        cursor
      })
    );
    const { response } = await fetchJson(url, {
      schema: Response,
      headers: { 'User-Agent': 'creator-dashboard/1.0 (+https://dashboard.glockyco.com)' }
    });
    if (page === 0) {
      const parsed = Summary.safeParse(response.query_summary);
      if (!parsed.success) throw new InvalidResponseError(`Steam returned no review summary for app ${config.appid}`);
      const summary = parsed.data;
      metricPoints = (
        [
          ['review_total', summary.total_reviews],
          ['review_positive', summary.total_positive],
          ['review_negative', summary.total_negative],
          ['review_score', summary.review_score]
        ] as const
      ).map(([metric, value]) => ({ source_id: source.id, metric, ts: now, value, dimensions: null }));
    }
    reviews.push(...response.reviews);
    const oldest = response.reviews.at(-1);
    const next = response.cursor;
    const lastPage = response.reviews.length < PAGE_SIZE || !next || next === cursor;
    if (lastPage || !oldest || (oldest.timestamp_updated ?? oldest.timestamp_created) < cutoffSeconds) break;
    cursor = next;
  }

  return {
    metric_points: metricPoints,
    events: reviews.map((review) => ({
      source_id: source.id,
      external_id: review.recommendationid,
      ts: review.timestamp_created * 1000,
      kind: 'review',
      author: null,
      title: review.voted_up ? 'Positive review' : 'Negative review',
      body: review.review,
      url: review.author.steamid
        ? `https://steamcommunity.com/profiles/${encodeURIComponent(review.author.steamid)}/recommended/${config.appid}/`
        : `https://steamcommunity.com/app/${config.appid}/reviews/?browsefilter=mostrecent`,
      metadata: {
        native_link_kind: review.author.steamid ? 'review' : 'review_list',
        voted_up: review.voted_up,
        votes_up: review.votes_up ?? null,
        weighted_vote_score: review.weighted_vote_score ?? null,
        comment_count: review.comment_count ?? null,
        playtime_forever: review.author.playtime_forever ?? null,
        playtime_at_review: review.author.playtime_at_review ?? null,
        language: review.language ?? null,
        steam_purchase: review.steam_purchase ?? null,
        received_for_free: review.received_for_free ?? null
      }
    }))
  };
}
