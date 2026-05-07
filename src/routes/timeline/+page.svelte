<script lang="ts">
  import TimelineChart from '$lib/components/timeline/TimelineChart.svelte';
  import TimelineEventLog from '$lib/components/timeline/TimelineEventLog.svelte';
  import TimelineFilterBar from '$lib/components/timeline/TimelineFilterBar.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.title} · Creator Dashboard</title></svelte:head>

<section class="space-y-6">
  <div class="rounded-xl border border-border bg-bg-secondary p-5">
    <p class="text-sm uppercase tracking-wide text-fg-muted">Correlation view</p>
    <h1 class="mt-2 text-3xl font-semibold">Timeline</h1>
    <p class="mt-2 text-sm text-fg-muted">Compare source metrics with posts and external content events across the selected date range.</p>
  </div>

  <TimelineFilterBar filters={data.filters} timeline={data.timeline} />

  {#if data.timeline.metricSeries.length > 0}
    <TimelineChart timeline={data.timeline} overlays={data.filters.overlays} />
  {:else}
    <section class="rounded-xl border border-dashed border-border bg-bg-secondary p-8 text-center text-fg-muted">No metric points match this timeline filter.</section>
  {/if}

  <TimelineEventLog timeline={data.timeline} overlays={data.filters.overlays} />
</section>
