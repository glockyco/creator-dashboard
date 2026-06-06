<script lang="ts">
  import type { MetricBreakdown } from '$lib/dashboard/types';
  import { formatMetricDelta, formatMetricValue } from '$lib/dashboard/format';
  import Sparkline from '$lib/components/dashboard/Sparkline.svelte';

  let { breakdown }: { breakdown: MetricBreakdown } = $props();
</script>

<section class="rounded-xl border border-border bg-bg-secondary p-5">
  <h2 class="mb-4 text-lg font-semibold capitalize">{breakdown.label}</h2>
  {#if breakdown.items.length > 0}
    <ul class="space-y-3">
      {#each breakdown.items as item (item.key)}
        <li class="rounded-lg border border-border bg-bg-primary p-3">
          <div class="mb-2 flex items-baseline justify-between gap-3">
            <span class="min-w-0 truncate font-medium text-fg-primary">{item.key}</span>
            <span class="flex shrink-0 items-baseline gap-2">
              <span class="text-lg font-semibold tabular-nums">{formatMetricValue(item.latest.value)}</span>
              {#if item.latest.delta !== null}
                <span class="text-xs tabular-nums text-fg-muted">{formatMetricDelta(item.latest.delta)} · 24h</span>
              {/if}
            </span>
          </div>
          <Sparkline points={item.points} />
        </li>
      {/each}
    </ul>
  {:else}
    <p class="rounded-lg border border-dashed border-border bg-bg-primary p-4 text-sm text-fg-muted">
      No per-item data captured yet.
    </p>
  {/if}
</section>
