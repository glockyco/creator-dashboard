<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import HeaderBar from './HeaderBar.svelte';

  let { children }: { children: Snippet } = $props();
  const activeCount = $derived(page.data.issueSummary?.activeCount ?? 0);
  const navigation = [
    { href: '/', label: 'Overview' },
    { href: '/activity', label: 'Activity' },
    { href: '/issues', label: 'Issues' }
  ] as const;

  function active(href: string): boolean {
    return href === '/'
      ? page.url.pathname === '/' || page.url.pathname.startsWith('/performance/')
      : page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }
</script>

<div class="min-h-screen bg-bg-primary text-fg-primary">
  <HeaderBar />
  <main class="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 md:pb-10">
    {@render children()}
  </main>
  <nav
    class="fixed inset-x-3 z-30 grid grid-cols-3 gap-1 rounded-xl border border-border bg-bg-secondary p-1.5 shadow-lg shadow-black/20 md:hidden"
    style="bottom: calc(0.75rem + env(safe-area-inset-bottom))"
    aria-label="Mobile primary"
  >
    {#each navigation as item (item.href)}
      <a
        href={resolve(item.href)}
        aria-current={active(item.href) ? 'page' : undefined}
        class={`flex min-h-12 items-center justify-center gap-1 rounded-lg text-sm font-semibold focus-visible:outline-2 focus-visible:outline-glockyco ${active(item.href) ? 'bg-glockyco/20 text-fg-primary' : 'text-fg-muted hover:bg-bg-primary hover:text-fg-primary'}`}
      >
        {item.label}{#if item.href === '/issues' && activeCount > 0}<span
            class="inline-grid min-w-5 place-items-center rounded-full border border-warning px-1 text-xs text-warning"
            >{activeCount}</span
          >{/if}
      </a>
    {/each}
  </nav>
</div>
