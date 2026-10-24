<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { Range } from '$lib/performance/series';

  const ranges: Range[] = ['7d', '30d', '90d'];
  let { selected }: { selected: Range } = $props();

  // The server remembers an explicit range in a cookie, so later pages open with it.
  function change(value: Range) {
    const url = new URL(page.url);
    url.searchParams.set('range', value);
    // The URL comes from the current page and already includes the configured base path.
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    void goto(url, { noScroll: true, keepFocus: true });
  }
</script>

<div class="flex items-center gap-2" role="group" aria-label="Comparison range">
  {#each ranges as range (range)}
    <button
      type="button"
      aria-pressed={selected === range}
      onclick={() => change(range)}
      class={`min-h-10 min-w-16 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-glockyco ${selected === range ? 'border-glockyco bg-glockyco/20 text-fg-primary' : 'border-border bg-bg-secondary text-fg-muted hover:border-glockyco hover:text-fg-primary'}`}
      >{range}</button
    >
  {/each}
</div>
