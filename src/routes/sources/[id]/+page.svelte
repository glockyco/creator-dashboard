<script lang="ts">
  import ContributionHeatmap from '$lib/components/sources/ContributionHeatmap.svelte';
  import EventsFeed from '$lib/components/sources/EventsFeed.svelte';
  import LinkedPosts from '$lib/components/sources/LinkedPosts.svelte';
  import MetricPanel from '$lib/components/sources/MetricPanel.svelte';
  import MetricBreakdown from '$lib/components/sources/MetricBreakdown.svelte';
  import SteamGuideAwards from '$lib/components/sources/SteamGuideAwards.svelte';
  import SourceHeader from '$lib/components/sources/SourceHeader.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const metricEntries = $derived(Object.entries(data.detail.metricHistory));
</script>

<svelte:head>
  <title>{data.detail.source.name} · Creator Dashboard</title>
</svelte:head>

<div class="space-y-6">
  <SourceHeader detail={data.detail} />

  {#if data.detail.source.id === 'github-glockyco' && data.detail.metricHistory.contributions}
    <ContributionHeatmap points={data.detail.metricHistory.contributions} />
  {/if}

  <div class="grid gap-4 xl:grid-cols-2">
    {#each metricEntries as [metric, points] (metric)}
      {#if !(data.detail.source.id === 'github-glockyco' && metric === 'contributions')}
        <MetricPanel {metric} {points} />
      {/if}
    {/each}
  </div>

  {#if data.detail.breakdown && data.detail.breakdown.items.length > 0}
    <MetricBreakdown breakdown={data.detail.breakdown} />
  {/if}

  <div class="grid gap-4 xl:grid-cols-[2fr_1fr]">
    <EventsFeed sourceId={data.detail.source.id} events={data.detail.events} />
    <div class="space-y-4">
      {#if data.detail.source.id.startsWith('steam-guide-')}
        <SteamGuideAwards awards={data.detail.steamGuideAwards} />
      {/if}
      <LinkedPosts posts={data.detail.linkedPosts} />
    </div>
  </div>
</div>
