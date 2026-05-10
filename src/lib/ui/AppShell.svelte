<script lang="ts">
  import type { Snippet } from 'svelte';
  import HeaderBar from './HeaderBar.svelte';
  import SidebarNav from './SidebarNav.svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div class="min-h-screen bg-bg-primary text-fg-primary">
  <HeaderBar />
  <div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:gap-6 md:py-6 lg:px-8">
    <SidebarNav />
    <div class="min-w-0 flex-1">{@render children()}</div>
  </div>
</div>
