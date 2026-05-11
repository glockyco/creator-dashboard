<script lang="ts">
  import { page } from "$app/state";

  const items = [
    { href: "/", label: "Dashboard", eyebrow: "Ops" },
    { href: "/health", label: "Health", eyebrow: "Runs" },
    { href: "/posts", label: "Posts", eyebrow: "Content" },
    { href: "/timeline", label: "Timeline", eyebrow: "Signals" },
    { href: "/settings", label: "Settings", eyebrow: "System" },
  ];

  function isActive(href: string, pathname: string) {
    return href === "/"
      ? pathname === "/" || pathname.startsWith("/sources/")
      : pathname === href || pathname.startsWith(`${href}/`);
  }
</script>

<nav class="w-full shrink-0 md:w-56" aria-label="Primary">
  <div
    class="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-bg-secondary/80 p-2 text-sm shadow-sm shadow-black/5 backdrop-blur md:sticky md:top-5 md:block md:space-y-1.5 md:overflow-visible md:p-2"
  >
    {#each items as item}
      {@const active = isActive(item.href, page.url.pathname)}
      <a
        class={`group flex min-h-11 shrink-0 items-center justify-between gap-4 rounded-xl px-3 py-2.5 font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-glockyco focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary md:w-full ${active ? "border border-glockyco/30 bg-bg-primary text-fg-primary shadow-sm" : "border border-transparent text-fg-muted hover:border-border hover:bg-bg-primary/70 hover:text-fg-primary focus-visible:border-glockyco focus-visible:text-fg-primary"}`}
        href={item.href}
        aria-current={active ? "page" : undefined}
      >
        <span>{item.label}</span>
        <span
          class={`text-[0.65rem] uppercase tracking-[0.18em] ${active ? "text-glockyco" : "text-fg-muted group-hover:text-fg-primary"}`}
          >{item.eyebrow}</span
        >
      </a>
    {/each}
  </div>
</nav>
