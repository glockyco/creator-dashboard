<script lang="ts">
  import type { TileSnapshot } from '$lib/dashboard/types';
  import { formatMetricDelta, formatMetricValue } from '$lib/dashboard/format';
  import Sparkline from './Sparkline.svelte';

  let { snapshot }: { snapshot: TileSnapshot } = $props();
</script>

<div class="space-y-4">
  <div class="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
    {#each snapshot.metrics as metric (metric.metric)}
      <div class="min-w-0 rounded-xl border border-border bg-bg-primary p-3">
        <p class="truncate text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-fg-muted">
          {metric.metric.replaceAll('_', ' ')}
        </p>
        <p class="mt-2 text-2xl font-semibold tracking-tight">
          {formatMetricValue(metric.value)}
        </p>
        {#if metric.delta !== null}
          <p class="mt-1 text-xs font-medium text-fg-muted">
            {formatMetricDelta(metric.delta)} vs 24h ago
          </p>
        {:else}
          <p class="mt-1 text-xs text-fg-muted">No 24h baseline</p>
        {/if}
      </div>
    {:else}
      <p
        class="col-span-2 rounded-xl border border-dashed border-border bg-bg-primary p-4 text-sm text-fg-muted sm:col-span-3"
      >
        No metrics captured yet.
      </p>
    {/each}
  </div>
  {#if snapshot.breakdown && snapshot.breakdown.items.length > 0}
    <div class="rounded-xl border border-border bg-bg-primary p-3">
      <p class="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-fg-muted">
        {snapshot.breakdown.label}
      </p>
      <ul class="space-y-1.5">
        {#each snapshot.breakdown.items as item (item.key)}
          <li class="flex min-w-0 items-baseline justify-between gap-3 text-sm">
            <span class="min-w-0 truncate text-fg-primary">{item.key}</span>
            <span class="flex shrink-0 items-baseline gap-2">
              <span class="font-semibold tabular-nums">{formatMetricValue(item.latest.value)}</span>
              {#if item.latest.delta !== null}
                <span class="text-xs tabular-nums text-fg-muted">{formatMetricDelta(item.latest.delta)}</span>
              {/if}
            </span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
  <div class="rounded-xl border border-border bg-bg-primary p-3">
    <div class="mb-2 flex items-center justify-between text-xs text-fg-muted">
      <span class="font-semibold uppercase tracking-[0.18em]">Freshness trend</span>
      <span>{snapshot.sparkline.length} points</span>
    </div>
    <Sparkline points={snapshot.sparkline} />
  </div>
</div>
