<script lang="ts">
  import type { Snippet } from "svelte";
  import HeaderBar from "./HeaderBar.svelte";
  import SidebarNav from "./SidebarNav.svelte";

  let { children }: { children: Snippet } = $props();
</script>

<div class="min-h-screen bg-bg-primary text-fg-primary">
  <HeaderBar />
  <div
    class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:px-5 md:flex-row md:gap-5 md:py-5 lg:px-8"
  >
    <SidebarNav />
    <main class="min-w-0 flex-1 pb-8">{@render children()}</main>
  </div>
</div>
