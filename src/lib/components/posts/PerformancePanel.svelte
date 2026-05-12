<script lang="ts">
  import type { PostPerformance } from '$lib/server/posts';
  import { formatMetricDelta, formatMetricValue } from '$lib/dashboard/format';

  let { performance }: { performance: PostPerformance[] } = $props();
</script>

<section class="rounded-xl border border-border bg-bg-secondary p-5">
  <h2 class="mb-4 text-lg font-semibold">Performance window</h2>
  <div class="space-y-2">
    {#each performance as row}
      <div class="rounded-lg border border-border bg-bg-primary p-3 text-sm">
        <div class="flex items-center justify-between gap-3">
          <span class="font-medium">{row.source_id} · {row.metric.replaceAll('_', ' ')}</span>
          <span class="text-fg-muted">{formatMetricDelta(row.delta)}</span>
        </div>
        <p class="mt-1 text-xs text-fg-muted">before {formatMetricValue(row.before_value)} · after {formatMetricValue(row.after_value)}</p>
      </div>
    {:else}
      <p class="rounded-lg border border-dashed border-border p-4 text-sm text-fg-muted">No linked source metrics are available for this post yet.</p>
    {/each}
  </div>
</section>
