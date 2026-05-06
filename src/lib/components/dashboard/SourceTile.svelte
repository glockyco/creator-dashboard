<script lang="ts">
  import type { FetcherStatus, TileSnapshot } from '$lib/dashboard/types';
  import AnalyticsTileBody from './AnalyticsTileBody.svelte';
  import EventFeedTileBody from './EventFeedTileBody.svelte';
  import ManualRefreshButton from './ManualRefreshButton.svelte';
  import PlatformTileBody from './PlatformTileBody.svelte';

  let { snapshot }: { snapshot: TileSnapshot } = $props();
  let latestStatus = $state<FetcherStatus | null>(null);
  const status = $derived(latestStatus ?? snapshot.status);

  function updateStatus(next: FetcherStatus) {
    latestStatus = next;
  }
</script>

<article class="rounded-xl border border-border bg-bg-secondary p-5 shadow-sm" data-source-id={snapshot.source.id}>
  <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div>
      <div class="flex items-center gap-2">
        <span class={`h-2.5 w-2.5 rounded-full ${snapshot.source.identity === 'glockyco' ? 'bg-glockyco' : 'bg-wowmuch'}`}></span>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">{snapshot.source.identity}</p>
      </div>
      <h2 class="mt-2 text-lg font-semibold text-fg-primary">{snapshot.source.name}</h2>
      <p class="text-xs text-fg-muted">{status.last_status ?? 'not run yet'}{status.consecutive_failures > 0 ? ` · ${status.consecutive_failures} failures` : ''}</p>
    </div>
    <ManualRefreshButton sourceId={snapshot.source.id} onStatus={updateStatus} />
  </div>

  {#if snapshot.source.category === 'analytics'}
    <AnalyticsTileBody {snapshot} />
  {:else if snapshot.source.category === 'event_feed'}
    <EventFeedTileBody {snapshot} />
  {:else}
    <PlatformTileBody {snapshot} />
  {/if}
</article>
