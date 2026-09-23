import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { activitySubjects, getActivity, type ActivityKind, type ActivitySentiment } from '$lib/server/activity';

const RANGE_MS = {
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
  '90d': 90 * 86_400_000
} as const;

type ActivityRange = keyof typeof RANGE_MS;
type FilterValue<T extends string> = T | 'all';

export const load: PageServerLoad = async ({ platform, url }) => {
  if (!platform?.env) throw error(500, 'Cloudflare platform env missing');

  const type = parseType(url.searchParams.get('type'));
  const subject = parseSubject(url.searchParams.get('subject'));
  const sentiment = parseSentiment(url.searchParams.get('sentiment'));
  const range = parseRange(url.searchParams.get('range'));
  const cursor = url.searchParams.get('cursor') ?? undefined;
  const now = Date.now();

  let activity;
  try {
    activity = await getActivity(platform.env.DB, {
      kind: type === 'all' ? undefined : type,
      sourceId: subject === 'all' ? undefined : subject,
      sentiment: sentiment === 'all' ? undefined : sentiment,
      since: now - RANGE_MS[range],
      cursor,
      limit: 20
    });
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'Invalid activity cursor') throw error(400, cause.message);
    throw cause;
  }

  let nextPageHref: string | null = null;
  if (activity.nextCursor) {
    const nextUrl = new URL(url);
    nextUrl.searchParams.set('cursor', activity.nextCursor);
    nextPageHref = `${nextUrl.pathname}${nextUrl.search}`;
  }

  return {
    title: 'Activity',
    activity,
    subjects: activitySubjects,
    filters: { type, subject, sentiment, range },
    now,
    nextPageHref
  };
};

function parseType(value: string | null): FilterValue<ActivityKind> {
  if (!value || value === 'all') return 'all';
  if (value === 'review' || value === 'wiki_edit') return value;
  throw error(400, 'Invalid activity type');
}

function parseSubject(value: string | null): string {
  if (!value || value === 'all') return 'all';
  if (activitySubjects.some((subject) => subject.id === value)) return value;
  throw error(400, 'Invalid activity subject');
}

function parseSentiment(value: string | null): FilterValue<ActivitySentiment> {
  if (!value || value === 'all') return 'all';
  if (value === 'positive' || value === 'negative') return value;
  throw error(400, 'Invalid review sentiment');
}

function parseRange(value: string | null): ActivityRange {
  if (!value) return '30d';
  if (value === '7d' || value === '30d' || value === '90d') return value;
  throw error(400, 'Invalid activity range');
}
