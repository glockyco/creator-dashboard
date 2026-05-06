<script lang="ts">
  import type { Snippet } from 'svelte';
  import HeaderBar from './HeaderBar.svelte';
  import SidebarNav from './SidebarNav.svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div class="min-h-screen bg-bg-primary text-fg-primary">
  <HeaderBar />
  <div class="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
    <SidebarNav />
    <div class="min-w-0 flex-1">{@render children()}</div>
  </div>
</div>
