<script lang="ts">
  import SourceTile from '$lib/components/dashboard/SourceTile.svelte';
  import DateRangePicker from '$lib/ui/DateRangePicker.svelte';
  import IdentityTabs from '$lib/ui/IdentityTabs.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.title}</title>
</svelte:head>

<section class="space-y-6">
  <div class="flex flex-col gap-4 rounded-xl border border-border bg-bg-secondary p-5 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p class="text-sm uppercase tracking-wide text-fg-muted">Private dashboard</p>
      <h1 class="mt-2 text-3xl font-semibold">{data.title}</h1>
      <p class="mt-2 text-sm text-fg-muted">Source metrics, events, and refresh controls for both creator identities.</p>
    </div>
    <DateRangePicker />
  </div>

  <IdentityTabs active={data.identity} url={new URL(data.url)} />

  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {#each data.snapshots as snapshot (snapshot.source.id)}
      <SourceTile {snapshot} />
    {:else}
      <div class="rounded-xl border border-dashed border-border bg-bg-secondary p-8 text-center text-fg-muted">No dashboard sources match this filter.</div>
    {/each}
  </div>
</section>
