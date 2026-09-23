<script lang="ts">
  import { resolve } from '$app/paths';
  import DateRangePicker from '$lib/ui/DateRangePicker.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const chart = $derived.by(() => {
    const rows = data.asset.points;
    if (rows.length < 2) return '';
    const first = rows[0].ts;
    const span = rows[rows.length - 1].ts - first || 1;
    let floor = Infinity;
    let ceiling = -Infinity;
    for (const point of rows) {
      floor = Math.min(floor, point.value);
      ceiling = Math.max(ceiling, point.value);
    }
    const height = ceiling - floor || 1;
    return rows
      .map((point) => `${((point.ts - first) / span) * 100},${94 - ((point.value - floor) / height) * 82}`)
      .join(' ');
  });
  function signed(value: number): string {
    return `${value > 0 ? '+' : ''}${value.toLocaleString()}`;
  }

  const metrics = $derived([
    {
      label: 'Total',
      value: data.asset.total === null ? 'Unavailable' : data.asset.total.toLocaleString(),
      note: 'Latest cumulative count',
      tone: data.asset.total === null ? 'text-fg-muted' : 'text-fg-primary'
    },
    {
      label: 'Rolling 24h',
      value: data.asset.dayGain === null ? 'Unavailable' : signed(data.asset.dayGain),
      note: 'Latest 24-hour gain',
      tone: data.asset.dayGain === null ? 'text-fg-muted' : data.asset.dayGain < 0 ? 'text-danger' : 'text-success'
    },
    {
      label: `${data.range} gain`,
      value: data.asset.periodGain === null ? 'Unavailable' : signed(data.asset.periodGain),
      note: 'Selected range',
      tone:
        data.asset.periodGain === null ? 'text-fg-muted' : data.asset.periodGain < 0 ? 'text-danger' : 'text-success'
    },
    {
      label: 'Vs prior',
      value:
        data.asset.comparisonPct === null
          ? 'Unavailable'
          : `${data.asset.comparisonPct > 0 ? '+' : ''}${data.asset.comparisonPct.toFixed(1)}%`,
      note:
        data.asset.previousGain === null
          ? 'Prior gain unavailable'
          : `Prior gain ${data.asset.previousGain.toLocaleString()}`,
      tone:
        data.asset.comparisonPct === null
          ? 'text-fg-muted'
          : data.asset.comparisonPct < 0
            ? 'text-danger'
            : 'text-success'
    }
  ]);
</script>

<svelte:head><title>{data.asset.name} · Creator Pulse</title></svelte:head>

<div class="space-y-5 pb-6">
  <!-- eslint-disable svelte/no-navigation-without-resolve -- The URL appends a range to a resolved local route. -->
  <a
    href={`${resolve('/')}?range=${data.range}`}
    class="inline-flex items-center gap-2 text-sm font-semibold text-glockyco hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glockyco"
    >← Back to overview</a
  >
  <!-- eslint-enable svelte/no-navigation-without-resolve -->

  <header class="rounded-xl border border-border bg-bg-secondary p-5 sm:p-6">
    <div class="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div class="min-w-0">
        <p class="text-sm text-fg-muted">
          {data.asset.platform} <span aria-hidden="true">·</span>
          {data.asset.kind === 'guide' ? 'Guide' : 'Mod'}
        </p>
        <h1 class="mt-1 text-2xl leading-tight font-semibold tracking-tight text-fg-primary sm:text-3xl">
          {data.asset.name}
        </h1>
        {#if data.asset.href}
          <!-- eslint-disable svelte/no-navigation-without-resolve -- Curated native destination, not a local route. -->
          <a
            href={data.asset.href}
            class="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-glockyco hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glockyco"
          >
            View on {data.asset.platform} <span aria-hidden="true">↗</span>
          </a>
          <!-- eslint-enable svelte/no-navigation-without-resolve -->
        {/if}
      </div>
      <div class="shrink-0"><DateRangePicker selected={data.range} /></div>
    </div>
  </header>

  <section class="overflow-hidden rounded-xl border border-border bg-bg-secondary" aria-label="Performance metrics">
    <div class="grid sm:grid-cols-2 lg:grid-cols-4">
      {#each metrics as metric, index (metric.label)}
        <div
          class={`border-border p-5 ${index === 0 ? '' : 'border-t'} ${index % 2 === 1 ? 'sm:border-l' : ''} ${index === 1 ? 'sm:border-t-0' : ''} ${index > 0 ? 'lg:border-l lg:border-t-0' : ''}`}
        >
          <p class="text-xs font-semibold uppercase tracking-[0.08em] text-fg-muted">{metric.label}</p>
          <p class={`mt-3 text-2xl font-semibold tabular-nums ${metric.tone}`}>{metric.value}</p>
          <p class="mt-1 text-xs text-fg-muted">{metric.note}</p>
        </div>
      {/each}
    </div>
  </section>

  {#if data.asset.kind === 'guide'}
    <section
      class="overflow-hidden rounded-xl border border-border bg-bg-secondary"
      aria-labelledby="guide-engagement-heading"
    >
      <h2 id="guide-engagement-heading" class="border-b border-border px-5 py-4 text-lg font-semibold">
        Guide engagement
      </h2>
      <div class="grid sm:grid-cols-3">
        <div class="p-5">
          <p class="text-xs font-semibold uppercase tracking-[0.08em] text-fg-muted">Favorites</p>
          <p class="mt-2 text-xl font-semibold text-fg-primary">
            {data.asset.favorites === null ? 'Unavailable' : data.asset.favorites.toLocaleString()}
          </p>
        </div>
        <div class="border-t border-border p-5 sm:border-l sm:border-t-0">
          <p class="text-xs font-semibold uppercase tracking-[0.08em] text-fg-muted">Rating</p>
          <p class="mt-2 text-xl font-semibold text-fg-primary">
            {data.asset.rating === null ? 'Unavailable' : `${Math.round(data.asset.rating * 100)}%`}
          </p>
          <p class="mt-1 text-xs text-fg-muted">
            {data.asset.ratings === null ? 'Vote count unavailable' : `${data.asset.ratings.toLocaleString()} votes`}
          </p>
        </div>
        <div class="border-t border-border p-5 sm:border-l sm:border-t-0">
          <p class="text-xs font-semibold uppercase tracking-[0.08em] text-fg-muted">Awards</p>
          <p class="mt-2 text-xl font-semibold text-fg-primary">
            {data.asset.awards === null ? 'Unavailable' : data.asset.awards.toLocaleString()}
          </p>
        </div>
      </div>
    </section>
  {/if}

  <section class="rounded-xl border border-border bg-bg-secondary" aria-labelledby="history-heading">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
      <h2 id="history-heading" class="text-lg font-semibold tracking-tight text-fg-primary">Cumulative history</h2>
      <span class="text-xs font-semibold text-fg-muted">Last {data.range}</span>
    </div>

    <div class="p-5 sm:p-6">
      {#if chart}
        <div class="rounded-xl border border-border bg-bg-primary p-4 sm:p-5">
          <svg
            class="h-64 w-full overflow-visible text-glockyco"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label={`Cumulative ${data.asset.kind} history for ${data.range}`}
          >
            <line
              x1="0"
              y1="94"
              x2="100"
              y2="94"
              stroke="currentColor"
              stroke-opacity="0.18"
              stroke-width="0.5"
              vector-effect="non-scaling-stroke"
            />
            <line
              x1="0"
              y1="53"
              x2="100"
              y2="53"
              stroke="currentColor"
              stroke-opacity="0.12"
              stroke-width="0.5"
              vector-effect="non-scaling-stroke"
            />
            <line
              x1="0"
              y1="12"
              x2="100"
              y2="12"
              stroke="currentColor"
              stroke-opacity="0.12"
              stroke-width="0.5"
              vector-effect="non-scaling-stroke"
            />
            <polyline
              points={chart}
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              vector-effect="non-scaling-stroke"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      {:else}
        <p class="rounded-xl border border-dashed border-border bg-bg-primary p-8 text-sm text-fg-muted">
          Trend unavailable. At least two captures are required.
        </p>
      {/if}

      <div
        class="mt-4 flex flex-col gap-1 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <p>
          Source updated:
          <strong class="font-semibold text-fg-primary"
            >{data.asset.lastCapturedAt === null
              ? 'Not captured yet'
              : new Date(data.asset.lastCapturedAt).toLocaleString()}</strong
          >
        </p>
        <p>Missing boundaries and counter resets make gains unavailable.</p>
      </div>
    </div>
  </section>
</div>
