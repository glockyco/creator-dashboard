import { z } from 'zod';
import { fetchJson } from '../http';
import type { FetcherInput, FetcherOutput } from '../types';

const Config = z.object({ appid: z.string() });
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
  voted_up: z.boolean(),
  votes_up: z.number().optional(),
  weighted_vote_score: z.number().optional(),
  comment_count: z.number().optional(),
  steam_purchase: z.boolean().optional(),
  received_for_free: z.boolean().optional()
});
// GetAppReviews omits `reviews` on an empty page and returns an empty `response` for an unknown app.
const Response = z.object({
  response: z.object({
    query_summary: z
      .object({
        num_reviews: z.number(),
        total_reviews: z.number(),
        review_score: z.number(),
        total_positive: z.number(),
        total_negative: z.number()
      })
      .optional(),
    reviews: z.array(Review).default([])
  })
});

// Enum values from https://partner.steamgames.com/doc/webapi/IUserReviewsService#Enums
const FILTER_RECENT = 1;
const PURCHASE_TYPE_ALL = 1;

export async function fetchSteamReviews({ source, now }: FetcherInput): Promise<FetcherOutput> {
  const config = Config.parse(source.config);
  const url = new URL('https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/');
  url.searchParams.set(
    'input_json',
    JSON.stringify({
      appid: Number(config.appid),
      filter: FILTER_RECENT,
      languages: ['all'],
      purchase_type: PURCHASE_TYPE_ALL
    })
  );

  const { response: data } = await fetchJson(url, {
    schema: Response,
    headers: { 'User-Agent': 'creator-dashboard/1.0 (+https://dashboard.glockyco.com)' }
  });
  const metrics = data.query_summary
    ? [
        {
          source_id: source.id,
          metric: 'review_total',
          ts: now,
          value: data.query_summary.total_reviews,
          dimensions: null
        },
        {
          source_id: source.id,
          metric: 'review_positive',
          ts: now,
          value: data.query_summary.total_positive,
          dimensions: null
        },
        {
          source_id: source.id,
          metric: 'review_negative',
          ts: now,
          value: data.query_summary.total_negative,
          dimensions: null
        },
        {
          source_id: source.id,
          metric: 'review_score',
          ts: now,
          value: data.query_summary.review_score,
          dimensions: null
        }
      ]
    : [];

  return {
    metric_points: metrics,
    events: data.reviews.map((review) => ({
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
