<script lang="ts">
  import type { EventsPage } from '$lib/server/source-detail';

  let { events, sourceId }: { events: EventsPage; sourceId: string } = $props();
</script>

<section class="rounded-xl border border-border bg-bg-secondary p-5">
  <div class="mb-4 flex items-center justify-between gap-3">
    <h2 class="text-lg font-semibold">Recent events</h2>
    {#if events.nextCursor}<a
        class="text-sm text-fg-muted hover:text-fg-primary"
        href={`/api/sources/${sourceId}/events?cursor=${events.nextCursor}`}>Next page</a
      >{/if}
  </div>
  <div class="space-y-3">
    {#each events.items as event}
      <article class="rounded-lg border border-border bg-bg-primary p-4">
        <div class="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
          <span class="font-semibold uppercase tracking-wide text-event">{event.kind}</span>
          <span>{new Date(event.ts).toLocaleString()}</span>
          {#if event.author}<span>{event.author}</span>{/if}
        </div>
        <h3 class="mt-2 font-medium">{event.title ?? event.external_id}</h3>
        {#if event.body}<p class="mt-2 text-sm text-fg-muted">{event.body}</p>{/if}
        {#if event.url}<a class="mt-2 inline-block text-sm text-glockyco hover:underline" href={event.url}
            >Open upstream</a
          >{/if}
      </article>
    {:else}
      <p class="rounded-lg border border-dashed border-border p-4 text-sm text-fg-muted">
        No events captured for this source yet.
      </p>
    {/each}
  </div>
</section>
