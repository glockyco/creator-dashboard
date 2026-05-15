<script lang="ts">
  import type { SparkPoint } from '$lib/dashboard/types';

  let { points }: { points: SparkPoint[] } = $props();

  const width = 240;
  const height = 64;

  function pathFor(points: SparkPoint[]): string {
    if (points.length === 0) return '';
    const minTs = Math.min(...points.map((point) => point.ts));
    const maxTs = Math.max(...points.map((point) => point.ts));
    const minValue = Math.min(...points.map((point) => point.value));
    const maxValue = Math.max(...points.map((point) => point.value));
    return points
      .map((point, index) => {
        const x = maxTs === minTs ? width / 2 : ((point.ts - minTs) / (maxTs - minTs)) * width;
        const y =
          maxValue === minValue ? height / 2 : height - ((point.value - minValue) / (maxValue - minValue)) * height;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }
</script>

{#if points.length > 0}
  <svg class="h-16 w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Metric sparkline">
    <path
      d={pathFor(points)}
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="text-glockyco"
    />
  </svg>
{:else}
  <div
    class="flex h-16 items-center justify-center rounded-lg border border-dashed border-border text-xs text-fg-muted"
  >
    No sparkline data
  </div>
{/if}
