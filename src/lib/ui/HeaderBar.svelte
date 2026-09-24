<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { nativeDestinations } from '$lib/native-links';

  const navigation = [
    { href: '/', label: 'Overview' },
    { href: '/activity', label: 'Activity' },
    { href: '/issues', label: 'Issues' }
  ] as const;
  const activeCount = $derived(page.data.issueSummary?.activeCount ?? 0);

  function active(href: string): boolean {
    return href === '/'
      ? page.url.pathname === '/' || page.url.pathname.startsWith('/performance/')
      : page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }
</script>

<header class="border-b border-border bg-bg-secondary">
  <div class="mx-auto hidden max-w-7xl justify-center px-4 py-3 sm:px-6 md:flex">
    <nav class="flex items-center gap-1" aria-label="Primary">
      {#each navigation as item (item.href)}
        <a
          href={resolve(item.href)}
          aria-current={active(item.href) ? 'page' : undefined}
          class={`inline-flex min-h-10 min-w-24 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-glockyco ${active(item.href) ? 'bg-glockyco/20 text-fg-primary' : 'text-fg-muted hover:bg-bg-primary hover:text-fg-primary'}`}
        >
          {item.label}{#if item.href === '/issues' && activeCount > 0}<span
              class="inline-grid min-w-5 place-items-center rounded-full border border-warning px-1 text-xs text-warning"
              >{activeCount}</span
            >{/if}
        </a>
      {/each}
    </nav>
  </div>
  <div class="md:border-t md:border-border/70">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 text-xs sm:px-6">
      <span class="font-semibold text-fg-muted">Native tools</span>
      {#each nativeDestinations as destination (destination.href)}
        <!-- eslint-disable svelte/no-navigation-without-resolve -- Verified native service URL. -->
        <a
          href={destination.href}
          class="font-medium text-glockyco underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-glockyco"
          >{destination.label} <span aria-hidden="true">↗</span></a
        >
        <!-- eslint-enable svelte/no-navigation-without-resolve -->
      {/each}
    </div>
  </div>
</header>
