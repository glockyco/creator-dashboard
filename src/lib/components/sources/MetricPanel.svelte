<script lang="ts">
  import type { SparkPoint } from '$lib/dashboard/types';
  import { formatMetricValue } from '$lib/dashboard/format';
  import Sparkline from '$lib/components/dashboard/Sparkline.svelte';

  let { metric, points }: { metric: string; points: SparkPoint[] } = $props();
  const latest = $derived(points.at(-1));
</script>

<section class="rounded-xl border border-border bg-bg-secondary p-5">
  <div class="mb-4 flex items-center justify-between gap-4">
    <h2 class="text-lg font-semibold capitalize">{metric.replaceAll('_', ' ')}</h2>
    <p class="text-2xl font-semibold">{formatMetricValue(latest?.value)}</p>
  </div>
  <Sparkline {points} />
</section>
