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
        {#if metric.delta !== null}<p class="text-xs text-fg-muted">{metric.delta >= 0 ? '+' : ''}{metric.delta}</p>{/if}
      </div>
    {/each}
  </div>
  <Sparkline points={snapshot.sparkline} />
</div>
