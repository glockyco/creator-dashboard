import type { TimelineData, TimelineEvent, TimelinePost } from '$lib/server/timeline';
import type { TimelineOverlay } from './schema';

export type TimelineLogItem =
  | {
      type: 'event';
      ts: number;
      source_id: string;
      title: string;
      subtitle: string | null;
      url: string | null;
      event: TimelineEvent;
    }
  | {
      type: 'post';
      ts: number;
      source_id: string;
      title: string;
      subtitle: string | null;
      url: string;
      post: TimelinePost;
    };

export function timelineLog(
  events: TimelineEvent[],
  posts: TimelinePost[],
  overlays: TimelineOverlay[]
): TimelineLogItem[] {
  const items: TimelineLogItem[] = [];
  if (overlays.includes('events')) {
    for (const event of events) {
      items.push({
        type: 'event',
        ts: event.ts,
        source_id: event.source_id,
        title: event.title ?? event.kind,
        subtitle: event.body,
        url: event.url,
        event
      });
    }
  }
  if (overlays.includes('posts')) {
    for (const post of posts) {
      items.push({
        type: 'post',
        ts: post.posted_at,
        source_id: post.source_id,
        title: post.title,
        subtitle: post.author,
        url: post.url,
        post
      });
    }
  }
  return items.sort((left, right) => left.ts - right.ts || left.title.localeCompare(right.title));
}

export function sourceName(timeline: TimelineData, sourceId: string): string {
  return timeline.sources.find((source) => source.id === sourceId)?.name ?? sourceId;
}

export function formatTimelineDate(ts: number): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(ts));
}
