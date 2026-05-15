<script lang="ts">
  import type { PostsFilters } from '$lib/server/posts';
  import { setSearchParam } from '$lib/ui/url-state';
  import { resolve } from '$app/paths';

  let { filters, url }: { filters: PostsFilters; url: URL } = $props();
</script>

<div class="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg-secondary p-4">
  <a
    class={`rounded-full border px-3 py-1.5 text-sm ${!filters.author ? 'border-fg-primary text-fg-primary' : 'border-border text-fg-muted'}`}
    href={resolve(setSearchParam(url, 'author', null) as '/')}>All authors</a
  >
  <a
    class={`rounded-full border px-3 py-1.5 text-sm ${filters.author === 'glockyco' ? 'border-glockyco text-glockyco' : 'border-border text-fg-muted'}`}
    href={resolve(setSearchParam(url, 'author', 'glockyco') as '/')}>glockyco</a
  >
  <a
    class={`rounded-full border px-3 py-1.5 text-sm ${filters.author === 'WoW_Much' ? 'border-wowmuch text-wowmuch' : 'border-border text-fg-muted'}`}
    href={resolve(setSearchParam(url, 'author', 'WoW_Much') as '/')}>WoW_Much</a
  >
  {#if filters.tag}<a
      class="rounded-full border border-border px-3 py-1.5 text-sm text-fg-muted"
      href={resolve(setSearchParam(url, 'tag', null) as '/')}>Clear tag: {filters.tag}</a
    >{/if}
  {#if filters.related_source}<a
      class="rounded-full border border-border px-3 py-1.5 text-sm text-fg-muted"
      href={resolve(setSearchParam(url, 'related_source', null) as '/')}>Clear source: {filters.related_source}</a
    >{/if}
</div>
