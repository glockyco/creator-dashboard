<script lang="ts">
  import type { Snippet } from 'svelte';
  import HeaderBar from './HeaderBar.svelte';
  import Sidebar from './Sidebar.svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div class="flex min-h-screen bg-bg-primary text-fg-primary">
  <Sidebar />
  <div class="flex min-w-0 flex-1 flex-col">
    <HeaderBar />
    <main class="flex-1 px-3 py-4 pb-8 sm:px-5 md:py-5 lg:px-8">
      {@render children()}
    </main>
  </div>
</div>
