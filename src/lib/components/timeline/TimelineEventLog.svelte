<script lang="ts">
  import type { TimelineData } from '$lib/server/timeline';
  import type { TimelineOverlay } from '$lib/timeline/schema';
  import { formatTimelineDate, sourceName, timelineLog } from '$lib/timeline/domain.svelte';

  let { timeline, overlays }: { timeline: TimelineData; overlays: TimelineOverlay[] } = $props();
  const items = $derived(timelineLog(timeline.events, timeline.posts, overlays));
</script>

<section class="rounded-xl border border-border bg-bg-secondary p-5">
  <div class="mb-4">
    <h2 class="text-lg font-semibold">Chronological log</h2>
    <p class="text-sm text-fg-muted">Posts and source events sorted oldest to newest for correlation review.</p>
  </div>
  <ol data-testid="timeline-log" class="space-y-3">
    {#each items as item (`${item.type}-${item.source_id}-${item.ts}-${item.title}`)}
      <li class="rounded-lg border border-border bg-bg-primary p-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="text-xs uppercase tracking-wide {item.type === 'event' ? 'text-event' : 'text-post'}">{item.type} · {sourceName(timeline, item.source_id)}</p>
            <h3 class="mt-1 font-medium">
              {#if item.url}
                <a class="hover:underline" href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
              {:else}
                {item.title}
              {/if}
            </h3>
            {#if item.subtitle}<p class="mt-1 text-sm text-fg-muted">{item.subtitle}</p>{/if}
          </div>
          <time class="shrink-0 text-sm text-fg-muted" datetime={new Date(item.ts).toISOString()}>{formatTimelineDate(item.ts)}</time>
        </div>
      </li>
    {:else}
      <li class="rounded-lg border border-dashed border-border p-6 text-center text-fg-muted">No posts or events match this timeline filter.</li>
    {/each}
  </ol>
</section>
