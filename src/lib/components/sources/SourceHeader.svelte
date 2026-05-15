<script lang="ts">
  import { resolve } from '$app/paths';
  import type { SourceDetail } from '$lib/server/source-detail';

  let { detail }: { detail: SourceDetail } = $props();
</script>

<section class="rounded-xl border border-border bg-bg-secondary p-5">
  <a class="text-sm text-fg-muted hover:text-fg-primary" href={resolve('/')}>← Dashboard</a>
  <div class="mt-4 flex flex-wrap items-start justify-between gap-4">
    <div>
      <div class="flex items-center gap-2">
        <span class={`h-3 w-3 rounded-full ${detail.source.identity === 'glockyco' ? 'bg-glockyco' : 'bg-wowmuch'}`}
        ></span>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">{detail.source.identity}</p>
      </div>
      <h1 class="mt-2 text-3xl font-semibold">{detail.source.name}</h1>
      <p class="mt-2 text-sm text-fg-muted">
        {detail.source.category.replaceAll('_', ' ')} · {detail.source.cadenceHours}h cadence
      </p>
    </div>
    <code class="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-fg-muted">{detail.source.id}</code
    >
  </div>
</section>
