<script lang="ts">
  import { formatMetricValue } from '$lib/dashboard/format';
  import type { SteamGuideAward } from '$lib/types/domain';

  let { awards }: { awards: SteamGuideAward[] } = $props();
</script>

<section class="rounded-xl border border-border bg-bg-secondary p-5">
  <div class="mb-4 flex items-center justify-between gap-3">
    <h2 class="text-lg font-semibold">Steam awards</h2>
    {#if awards.length > 0}
      <span class="text-sm text-fg-muted">{awards.length} types</span>
    {/if}
  </div>
  {#if awards.length > 0}
    <div class="flex flex-wrap gap-2">
      {#each awards as award (award.reaction_id)}
        <div class="flex items-center gap-2 rounded-lg border border-border bg-bg-primary px-3 py-2">
          <img class="h-8 w-8" src={award.icon_url} alt={`Steam award ${award.reaction_id}`} loading="lazy" />
          <span class="font-semibold">{formatMetricValue(award.count)}</span>
        </div>
      {/each}
    </div>
  {:else}
    <p class="rounded-lg border border-dashed border-border p-4 text-sm text-fg-muted">No Steam awards captured yet.</p>
  {/if}
</section>
