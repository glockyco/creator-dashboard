<script lang="ts" module>
  export const SIDEBAR_WIDTH_EXPANDED = 224;
  export const SIDEBAR_WIDTH_COLLAPSED = 56;
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { Drawer } from "vaul-svelte";
  import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
  import Activity from "@lucide/svelte/icons/activity";
  import FileText from "@lucide/svelte/icons/file-text";
  import LineChart from "@lucide/svelte/icons/line-chart";
  import Settings from "@lucide/svelte/icons/settings";
  import PanelLeftClose from "@lucide/svelte/icons/panel-left-close";
  import PanelLeftOpen from "@lucide/svelte/icons/panel-left-open";
  import Menu from "@lucide/svelte/icons/menu";

  type Item = {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    /** Optional alternate path prefix that should still mark this item active. */
    altPrefix?: string;
  };

  const items: Item[] = [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
      altPrefix: "/sources/",
    },
    { href: "/health", label: "Health", icon: Activity },
    { href: "/posts", label: "Posts", icon: FileText },
    { href: "/timeline", label: "Timeline", icon: LineChart },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  let isCollapsed = $state(false);
  let drawerOpen = $state(false);
  let initialized = $state(false);

  onMount(() => {
    const saved = localStorage.getItem("creator-dashboard-sidebar-collapsed");
    if (saved !== null) isCollapsed = saved === "true";
    initialized = true;
  });

  function toggleCollapsed() {
    isCollapsed = !isCollapsed;
    localStorage.setItem(
      "creator-dashboard-sidebar-collapsed",
      String(isCollapsed),
    );
  }

  function isActive(item: Item, pathname: string): boolean {
    if (item.href === "/") {
      return pathname === "/" || (item.altPrefix !== undefined && pathname.startsWith(item.altPrefix));
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  function handleKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
      event.preventDefault();
      toggleCollapsed();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Mobile: hamburger trigger + drawer with full nav -->
<Drawer.Root bind:open={drawerOpen} direction="left">
  <Drawer.Trigger
    class="fixed left-4 top-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg-secondary text-fg-muted shadow-sm hover:text-fg-primary md:hidden"
    aria-label="Open navigation"
  >
    <Menu class="h-5 w-5" aria-hidden="true" />
  </Drawer.Trigger>
  <Drawer.Portal>
    <Drawer.Overlay class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
    <Drawer.Content
      class="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-bg-secondary outline-none"
    >
      <div
        class="flex h-14 shrink-0 items-center justify-between border-b border-border px-4"
      >
        <Drawer.Title
          class="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-fg-muted"
        >
          Creator Dashboard
        </Drawer.Title>
        <Drawer.Description class="sr-only">
          Primary navigation
        </Drawer.Description>
      </div>
      <nav class="flex-1 p-3" aria-label="Primary">
        <ul class="flex flex-col gap-1">
          {#each items as item (item.href)}
            {@const Icon = item.icon}
            {@const active = isActive(item, page.url.pathname)}
            <li>
              <a
                href={item.href}
                aria-current={active ? "page" : undefined}
                onclick={() => (drawerOpen = false)}
                class={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-glockyco focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary ${active ? "bg-bg-primary text-fg-primary" : "text-fg-muted hover:bg-bg-primary/70 hover:text-fg-primary"}`}
              >
                <Icon class="h-5 w-5" aria-hidden="true" />
                <span>{item.label}</span>
              </a>
            </li>
          {/each}
        </ul>
      </nav>
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>

<!-- Desktop: collapsible sticky sidebar -->
<nav
  class="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-bg-secondary/80 backdrop-blur md:flex"
  style="width: {isCollapsed
    ? SIDEBAR_WIDTH_COLLAPSED
    : SIDEBAR_WIDTH_EXPANDED}px"
  aria-label="Primary"
>
  <div
    class={`flex h-14 shrink-0 items-center border-b border-border ${isCollapsed ? "justify-center" : "justify-between px-4"}`}
  >
    {#if !isCollapsed}
      <span
        class="truncate text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-fg-muted"
        >Creator Dashboard</span
      >
    {/if}
    <button
      type="button"
      onclick={toggleCollapsed}
      class="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-bg-primary hover:text-fg-primary"
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={isCollapsed ? "Expand sidebar (⌘B)" : "Collapse sidebar (⌘B)"}
      aria-expanded={!isCollapsed}
    >
      {#if isCollapsed}
        <PanelLeftOpen class="h-4 w-4" aria-hidden="true" />
      {:else}
        <PanelLeftClose class="h-4 w-4" aria-hidden="true" />
      {/if}
    </button>
  </div>

  <ul
    class={`flex flex-1 flex-col gap-1 py-3 ${isCollapsed ? "items-center px-2" : "px-3"}`}
  >
    {#each items as item (item.href)}
      {@const Icon = item.icon}
      {@const active = isActive(item, page.url.pathname)}
      <li class={isCollapsed ? "" : "w-full"}>
        <a
          href={item.href}
          aria-current={active ? "page" : undefined}
          title={isCollapsed ? item.label : undefined}
          class={`flex items-center gap-3 rounded-xl text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-glockyco focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary ${isCollapsed ? "h-10 w-10 justify-center" : "min-h-11 w-full px-3 py-2"} ${active ? "bg-bg-primary text-fg-primary" : "text-fg-muted hover:bg-bg-primary/70 hover:text-fg-primary"}`}
        >
          <Icon class="h-5 w-5 shrink-0" aria-hidden="true" />
          {#if !isCollapsed}<span class="truncate">{item.label}</span>{/if}
          {#if isCollapsed}<span class="sr-only">{item.label}</span>{/if}
        </a>
      </li>
    {/each}
  </ul>
</nav>
