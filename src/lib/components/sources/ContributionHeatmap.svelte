<script lang="ts">
  import type { SparkPoint } from '$lib/dashboard/types';

  let { points }: { points: SparkPoint[] } = $props();
</script>

<section class="rounded-xl border border-border bg-bg-secondary p-5">
  <h2 class="mb-4 text-lg font-semibold">Contribution heatmap</h2>
  <div class="grid grid-cols-14 gap-1" aria-label="Contribution heatmap">
    {#each points as point (point.ts)}
      <div
        class={`h-4 rounded-sm ${point.value === 0 ? 'bg-bg-primary' : point.value < 3 ? 'bg-glockyco/40' : point.value < 6 ? 'bg-glockyco/70' : 'bg-glockyco'}`}
        title={`${new Date(point.ts).toISOString().slice(0, 10)}: ${point.value}`}
      ></div>
    {:else}
      <p class="col-span-14 rounded-lg border border-dashed border-border p-4 text-sm text-fg-muted">
        No contribution history captured yet.
      </p>
    {/each}
  </div>
</section>
