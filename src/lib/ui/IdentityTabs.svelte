<script lang="ts">
  import type { IdentityFilter } from '$lib/types/domain';
  import { setSearchParam } from './url-state';
  import { resolve } from '$app/paths';

  let { active, url }: { active: IdentityFilter; url: URL } = $props();

  const tabs: { value: IdentityFilter; label: string; className: string }[] = [
    { value: 'all', label: 'All sources', className: 'border-border text-fg-muted' },
    { value: 'glockyco', label: 'glockyco', className: 'border-glockyco text-glockyco' },
    { value: 'WoW_Much', label: 'WoW_Much', className: 'border-wowmuch text-wowmuch' }
  ];
</script>

<div class="flex flex-wrap gap-2" role="tablist" aria-label="Creator identity">
  {#each tabs as tab (tab.value)}
    <a
      role="tab"
      aria-selected={active === tab.value}
      class={`rounded-full border px-4 py-2 text-sm font-medium transition ${active === tab.value ? `${tab.className} bg-bg-secondary` : 'border-border text-fg-muted hover:bg-bg-secondary hover:text-fg-primary'}`}
      href={resolve(setSearchParam(url, 'identity', tab.value) as '/')}>{tab.label}</a
    >
  {/each}
</div>
