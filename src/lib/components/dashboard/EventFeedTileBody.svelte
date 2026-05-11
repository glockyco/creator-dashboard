<script lang="ts">
  import type { TileSnapshot } from "$lib/dashboard/types";
  import Sparkline from "./Sparkline.svelte";

  let { snapshot }: { snapshot: TileSnapshot } = $props();
</script>

<div class="space-y-4">
  <div class="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
    {#each snapshot.metrics as metric}
      <div class="min-w-0 rounded-xl border border-border bg-bg-primary p-3">
        <p
          class="truncate text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-fg-muted"
        >
          {metric.metric.replaceAll("_", " ")}
        </p>
        <p class="mt-2 text-2xl font-semibold tracking-tight">
          {metric.value ?? "—"}
        </p>
        <p class="mt-1 text-xs text-fg-muted">Latest capture</p>
      </div>
    {:else}
      <p
        class="col-span-2 rounded-xl border border-dashed border-border bg-bg-primary p-4 text-sm text-fg-muted sm:col-span-3"
      >
        No event metrics captured yet.
      </p>
    {/each}
  </div>
  <div class="rounded-xl border border-border bg-bg-primary p-3">
    <div class="mb-2 flex items-center justify-between text-xs text-fg-muted">
      <span class="font-semibold uppercase tracking-[0.18em]">Event pace</span>
      <span>{snapshot.sparkline.length} points</span>
    </div>
    <Sparkline points={snapshot.sparkline} />
  </div>
</div>
