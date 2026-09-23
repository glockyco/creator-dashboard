<script lang="ts">
  import { resolve } from '$app/paths';
  import DateRangePicker from '$lib/ui/DateRangePicker.svelte';
  import type { PageData } from './$types';
  import type { PerformanceAsset } from '$lib/server/performance';
  import type { PerformanceSeriesSummary } from '$lib/performance/series';

  type ReviewRow = PerformanceSeriesSummary & {
    id: string;
    name: string;
    platform: string;
    kind: 'review';
    sentiment: 'positive' | 'negative';
    reviewId: string;
  };
  type OverviewRow = PerformanceAsset | ReviewRow;
  type OverviewGroup = { title: string; totalLabel: string; countLabel: string; rows: OverviewRow[] };

  let { data }: { data: PageData } = $props();
  let sortBy = $state<'name' | 'total' | 'periodGain'>('name');
  const reviewRows = $derived(
    data.performance.reviews.flatMap((review) => [
      {
        ...review.positive,
        id: `${review.id}:positive`,
        name: review.name,
        platform: 'Positive reviews',
        kind: 'review' as const,
        sentiment: 'positive' as const,
        reviewId: review.id
      },
      {
        ...review.negative,
        id: `${review.id}:negative`,
        name: review.name,
        platform: 'Negative reviews',
        kind: 'review' as const,
        sentiment: 'negative' as const,
        reviewId: review.id
      }
    ])
  );
  const thunderstoreMods = $derived(data.performance.mods.filter((asset) => asset.platform === 'Thunderstore'));
  const vaultMods = $derived(data.performance.mods.filter((asset) => asset.platform === 'Erenshor Vault'));
  const groups: OverviewGroup[] = $derived([
    {
      title: 'Steam guides',
      totalLabel: 'Total views',
      countLabel: `${data.performance.guides.length} guides`,
      rows: data.performance.guides
    },
    {
      title: 'Thunderstore mods',
      totalLabel: 'Total downloads',
      countLabel: `${thunderstoreMods.length} mods`,
      rows: thunderstoreMods
    },
    {
      title: 'Erenshor Vault mods',
      totalLabel: 'Total downloads',
      countLabel: `${vaultMods.length} mods`,
      rows: vaultMods
    },
    {
      title: 'Steam reviews',
      totalLabel: 'Total reviews',
      countLabel: `${data.performance.reviews.length} games · positive and negative`,
      rows: reviewRows
    }
  ]);

  function ordered(rows: OverviewRow[]) {
    return [...rows].sort((a, b) => {
      const byName = a.name.localeCompare(b.name);
      const bySentiment =
        a.kind === 'review' && b.kind === 'review'
          ? (a.sentiment === 'positive' ? -1 : 1) - (b.sentiment === 'positive' ? -1 : 1)
          : 0;
      if (sortBy === 'name') return byName || bySentiment;
      const left = sortBy === 'total' ? a.total : a.periodGain;
      const right = sortBy === 'total' ? b.total : b.periodGain;
      return (right ?? -1) - (left ?? -1) || byName || bySentiment;
    });
  }

  const guideSignals = [
    { key: 'favorites', label: 'Favorites' },
    { key: 'rating', label: 'Rating' },
    { key: 'ratings', label: 'Votes' },
    { key: 'awards', label: 'Awards' }
  ] as const;

  const numberFormatter = new Intl.NumberFormat();

  function number(value: number) {
    return numberFormatter.format(value);
  }

  function engagementValue(value: number | null, rating: boolean) {
    if (value === null) return 'Unavailable';
    return rating ? `${(value * 100).toFixed(1)}%` : number(value);
  }

  function engagementChange(value: number | null, rating: boolean) {
    if (value === null) return 'Unavailable';
    return `${value > 0 ? '+' : ''}${rating ? `${(value * 100).toFixed(1)} pp` : number(value)}`;
  }

  function changeTone(value: number | null) {
    return value === null || value === 0 ? 'text-fg-muted' : value < 0 ? 'text-danger' : 'text-success';
  }

  function trend(points: PerformanceAsset['points']) {
    if (points.length < 2) return '';
    let low = Infinity;
    let high = -Infinity;
    for (const point of points) {
      low = Math.min(low, point.value);
      high = Math.max(high, point.value);
    }
    const start = points[0].ts;
    const duration = points[points.length - 1].ts - start || 1;
    const span = high - low || 1;
    const step = Math.max(1, Math.ceil(points.length / 32));
    const samples: string[] = [];
    for (let index = 0; index < points.length; index += step) {
      const point = points[index];
      samples.push(`${((point.ts - start) / duration) * 100},${30 - ((point.value - low) / span) * 26}`);
    }
    if ((points.length - 1) % step !== 0) {
      const last = points[points.length - 1];
      samples.push(`${((last.ts - start) / duration) * 100},${30 - ((last.value - low) / span) * 26}`);
    }
    return samples.join(' ');
  }
</script>

<svelte:head><title>Overview · Creator Pulse</title></svelte:head>

<div class="space-y-5 pb-6">
  <header class="flex flex-wrap items-end justify-between gap-5 pb-1">
    <div>
      <h1 class="text-3xl font-bold tracking-tight text-fg-primary">Overview</h1>
      <p class="mt-1 text-xs text-fg-muted">
        {data.issueSummary.latestSuccessAt === null
          ? 'No successful collection yet'
          : `Last successful collection ${new Date(data.issueSummary.latestSuccessAt).toLocaleString()}`}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <label class="sr-only" for="overview-sort">Sort assets</label>
      <select
        id="overview-sort"
        bind:value={sortBy}
        class="min-h-10 rounded-lg border border-border bg-bg-secondary px-3 text-xs font-semibold text-fg-primary focus-visible:outline-2 focus-visible:outline-glockyco"
      >
        <option value="name">Sort: name</option>
        <option value="total">Sort: total</option>
        <option value="periodGain">Sort: range gain</option>
      </select>
      <DateRangePicker selected={data.range} />
    </div>
  </header>

  {#if data.issueSummary.activeCount > 0}
    <a
      href={data.issueSummary.activeCount === 1
        ? resolve('/issues/[incident_id]', { incident_id: String(data.issueSummary.issues[0].id) })
        : resolve('/issues')}
      class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-fg-primary hover:border-warning focus-visible:outline-2 focus-visible:outline-glockyco"
    >
      <span class="size-2 rounded-full bg-warning" aria-hidden="true"></span>
      <strong
        >{data.issueSummary.activeCount} collection {data.issueSummary.activeCount === 1 ? 'issue' : 'issues'}</strong
      >
      <span class="ml-auto font-semibold text-warning"
        >Review {data.issueSummary.activeCount === 1 ? 'issue' : 'issues'} →</span
      >
    </a>
  {/if}

  <p class="text-xs text-fg-muted sm:hidden">Swipe tables for gains and trends →</p>

  {#each groups as group (group.title)}
    <section class="overflow-hidden rounded-xl border border-border bg-bg-secondary" aria-label={group.title}>
      <div class="flex min-h-14 items-center justify-between gap-4 px-5">
        <h2 class="text-lg font-bold tracking-tight text-fg-primary">{group.title}</h2>
        <span class="text-xs text-fg-muted">{group.countLabel}</span>
      </div>
      <div class="overflow-x-auto">
        <table class="asset-table w-full table-fixed text-left text-sm">
          <thead class="bg-glockyco/5 text-xs font-bold uppercase tracking-[0.08em] text-fg-muted">
            <tr>
              <th scope="col" class="px-4 py-3"
                >{group.title === 'Steam guides'
                  ? 'Guide'
                  : group.title === 'Steam reviews'
                    ? 'Game / sentiment'
                    : 'Mod'}</th
              >
              <th scope="col" class="px-3 py-3 text-right">{group.totalLabel}</th>
              <th scope="col" class="px-3 py-3 text-right">24h gain</th>
              <th scope="col" class="px-3 py-3 text-right">{data.range} gain</th>
              <th scope="col" class="px-4 py-3 text-right">{data.range} trend</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each ordered(group.rows) as asset (asset.id)}
              <tr class="transition-colors hover:bg-glockyco/5">
                <th scope="row" class="asset-name px-4 py-3 font-semibold">
                  <!-- eslint-disable svelte/no-navigation-without-resolve -- The internal URL appends a range to a resolved route. -->
                  <a
                    href={asset.kind === 'review'
                      ? `${resolve('/activity')}?type=review&subject=${encodeURIComponent(asset.reviewId)}`
                      : `${resolve('/performance/[asset_id]', { asset_id: asset.id })}?range=${data.range}`}
                    class="text-fg-primary underline-offset-4 hover:text-glockyco hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-glockyco"
                    >{asset.name}</a
                  >
                  <!-- eslint-enable svelte/no-navigation-without-resolve -->
                  {#if asset.kind === 'guide'}
                    <span class="mt-1 block text-xs font-normal text-fg-muted">Steam</span>
                  {:else}
                    <span
                      class={`mt-1 block text-xs font-normal ${asset.kind === 'review' ? (asset.sentiment === 'positive' ? 'text-success' : 'text-danger') : 'text-fg-muted'}`}
                      >{asset.platform}</span
                    >
                  {/if}
                </th>
                <td class="px-3 py-3 text-right font-bold text-fg-primary"
                  >{asset.total === null ? 'Awaiting data' : number(asset.total)}</td
                >
                <td
                  class={`px-3 py-3 text-right font-semibold ${asset.dayGain === null ? 'text-fg-muted' : asset.kind === 'review' && asset.sentiment === 'negative' ? 'text-danger' : 'text-success'}`}
                  >{asset.dayGain === null ? 'Unavailable' : `+${number(asset.dayGain)}`}</td
                >
                <td
                  class={`px-3 py-3 text-right font-semibold ${asset.periodGain === null ? 'text-fg-muted' : asset.kind === 'review' && asset.sentiment === 'negative' ? 'text-danger' : 'text-success'}`}
                  >{asset.periodGain === null ? 'Unavailable' : `+${number(asset.periodGain)}`}</td
                >
                <td class="px-4 py-3 text-right">
                  {#if asset.points.length > 1}
                    <svg
                      viewBox="0 0 100 32"
                      preserveAspectRatio="none"
                      class={`ml-auto h-7 w-24 ${asset.kind === 'review' && asset.sentiment === 'negative' ? 'text-danger' : 'text-glockyco'}`}
                      role="img"
                      aria-label={`${asset.name} ${asset.platform} trend`}
                    >
                      <polyline
                        points={trend(asset.points)}
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        vector-effect="non-scaling-stroke"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  {:else}
                    <span class="text-xs text-fg-muted">No trend yet</span>
                  {/if}
                </td>
              </tr>
              {#if asset.kind === 'guide' && asset.guideMetrics}
                <tr aria-label={`${asset.name} engagement changes`}>
                  <td colspan="5" class="px-4 pb-3 pt-0">
                    <div class="grid grid-cols-4 divide-x divide-border">
                      {#each guideSignals as signal (signal.key)}
                        {@const metric = asset.guideMetrics[signal.key]}
                        <div class="min-w-0 px-3 py-2 first:pl-0 last:pr-0">
                          <p class="text-xs font-bold uppercase tracking-wide text-fg-muted">{signal.label}</p>
                          <p class="mt-1 font-semibold tabular-nums text-fg-primary">
                            {engagementValue(metric.total, signal.key === 'rating')}
                          </p>
                          <p class="mt-1 text-xs text-fg-muted">
                            24h <span class={changeTone(metric.dayGain)}
                              >{engagementChange(metric.dayGain, signal.key === 'rating')}</span
                            >
                          </p>
                          <p class="text-xs text-fg-muted">
                            {data.range}
                            <span class={changeTone(metric.periodGain)}
                              >{engagementChange(metric.periodGain, signal.key === 'rating')}</span
                            >
                          </p>
                        </div>
                      {/each}
                    </div>
                  </td>
                </tr>
              {/if}
            {:else}
              <tr><td colspan="5" class="px-5 py-8 text-center text-fg-muted">No assets are configured.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/each}

  <section aria-labelledby="recent-activity-heading">
    <div class="mb-3 flex items-center justify-between gap-4">
      <h2 id="recent-activity-heading" class="text-lg font-bold tracking-tight">Activity</h2>
      <a
        href={resolve('/activity')}
        class="text-xs font-semibold text-glockyco hover:underline focus-visible:outline-2 focus-visible:outline-glockyco"
        >View all →</a
      >
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      {#each data.activity as item (item.id)}
        <article class="min-w-0 rounded-xl border border-border bg-bg-secondary p-4">
          <span class="text-xs font-bold uppercase tracking-[0.08em] text-glockyco"
            >{item.kind === 'review' ? 'Steam review' : 'Wiki edit'}</span
          >
          <p class="mt-2 text-sm font-semibold text-fg-primary">{item.title || item.sourceName}</p>
          <p class="mt-1 line-clamp-2 text-xs text-fg-muted">{item.body || 'No summary available.'}</p>
          <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-fg-muted">
            <span>{item.sourceName} · {new Date(item.ts).toLocaleString()}</span>
            {#if item.href}
              <!-- eslint-disable svelte/no-navigation-without-resolve -- Validated native destination, never a local route. -->
              <a
                href={item.href}
                class="font-semibold text-glockyco hover:underline focus-visible:outline-2 focus-visible:outline-glockyco"
                >{item.hrefLabel || 'Native context'} ↗</a
              >
              <!-- eslint-enable svelte/no-navigation-without-resolve -->
            {/if}
          </div>
        </article>
      {:else}
        <p class="col-span-full rounded-xl border border-border bg-bg-secondary px-5 py-6 text-sm text-fg-muted">
          No reviews or wiki changes in this range.
        </p>
      {/each}
    </div>
  </section>
</div>

<style>
  .asset-table {
    min-width: 820px;
  }
  .asset-table thead th:nth-child(1) {
    width: 40%;
  }
  .asset-table thead th:nth-child(2),
  .asset-table thead th:nth-child(3),
  .asset-table thead th:nth-child(4) {
    width: 16%;
  }
  .asset-table thead th:nth-child(5) {
    width: 12%;
  }
  @media (max-width: 480px) {
    .asset-table {
      width: 760px;
      min-width: 760px;
    }
    .asset-table thead th:nth-child(1) {
      width: 175px;
    }
    .asset-table thead th:nth-child(2) {
      width: 125px;
    }
    .asset-table thead th:nth-child(3) {
      width: 125px;
    }
    .asset-table thead th:nth-child(4) {
      width: 125px;
    }
    .asset-table thead th:nth-child(5) {
      width: 210px;
    }
    .asset-table tbody th {
      position: sticky;
      left: 0;
      z-index: 1;
      background: var(--color-bg-secondary);
    }
    .asset-table thead th:first-child {
      position: sticky;
      left: 0;
      z-index: 2;
      background: color-mix(in srgb, var(--color-glockyco) 5%, var(--color-bg-secondary));
    }
  }
</style>
