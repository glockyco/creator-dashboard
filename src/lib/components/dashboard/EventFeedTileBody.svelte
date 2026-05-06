<script lang="ts">
  import type { TileSnapshot } from '$lib/dashboard/types';
  import Sparkline from './Sparkline.svelte';

  let { snapshot }: { snapshot: TileSnapshot } = $props();
</script>

<div class="space-y-4">
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {#each snapshot.metrics as metric}
      <div class="rounded-lg bg-bg-primary p-3">
        <p class="text-xs uppercase tracking-wide text-fg-muted">{metric.metric.replaceAll('_', ' ')}</p>
        <p class="mt-1 text-2xl font-semibold">{metric.value ?? '—'}</p>
      </div>
    {/each}
  </div>
  <Sparkline points={snapshot.sparkline} />
  <div class="space-y-2">
    {#each snapshot.latestEvents as event}
      <a class="block rounded-lg border border-border p-3 text-sm hover:bg-bg-primary" href={event.url ?? '#'}>
        <span class="text-xs uppercase tracking-wide text-event">{event.kind}</span>
        <span class="mt-1 block font-medium">{event.title ?? 'Untitled event'}</span>
        {#if event.author}<span class="text-xs text-fg-muted">{event.author}</span>{/if}
      </a>
    {:else}
      <p class="rounded-lg border border-dashed border-border p-3 text-sm text-fg-muted">No recent events</p>
    {/each}
  </div>
</div>
