<script lang="ts">
  import TimelineChart from '$lib/components/timeline/TimelineChart.svelte';
  import TimelineEventLog from '$lib/components/timeline/TimelineEventLog.svelte';
  import TimelineFilterBar from '$lib/components/timeline/TimelineFilterBar.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.title} · Creator Dashboard</title></svelte:head>

<section class="space-y-6">
  <div
    class="flex flex-col gap-4 rounded-xl border border-border bg-bg-secondary p-5 sm:flex-row sm:items-start sm:justify-between"
  >
    <div>
      <p class="text-sm uppercase tracking-wide text-fg-muted">Investigation workspace</p>
      <h1 class="mt-2 text-3xl font-semibold">Timeline</h1>
      <p class="mt-2 max-w-2xl text-sm text-fg-muted">
        Correlate source metrics, content events, and posts across the selected window.
      </p>
    </div>
    <div class="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-fg-muted">
      {data.timeline.sources.length} sources · {data.timeline.metricSeries.length} metric series
    </div>
  </div>

  <section class="space-y-3 rounded-xl border border-border bg-bg-secondary p-5">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Scope</p>
      <h2 class="mt-1 text-lg font-semibold">Investigation filters</h2>
      <p class="text-sm text-fg-muted">
        Adjust the date range, source IDs, and overlays before reading the chart and log.
      </p>
    </div>
    <TimelineFilterBar filters={data.filters} timeline={data.timeline} />
  </section>

  <div class="space-y-4">
    <div class="flex flex-col gap-1">
      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Evidence</p>
      <h2 class="text-xl font-semibold">Metric chart and chronological log</h2>
    </div>

    {#if data.timeline.metricSeries.length > 0}
      <TimelineChart timeline={data.timeline} overlays={data.filters.overlays} />
    {:else}
      <section class="rounded-xl border border-dashed border-border bg-bg-secondary p-8 text-center">
        <h3 class="font-medium text-fg-primary">No metric points in this investigation window</h3>
        <p class="mt-2 text-sm text-fg-muted">
          Widen the date range or add source IDs to recover trend evidence before comparing events.
        </p>
      </section>
    {/if}

    <TimelineEventLog timeline={data.timeline} overlays={data.filters.overlays} />
  </div>
</section>
