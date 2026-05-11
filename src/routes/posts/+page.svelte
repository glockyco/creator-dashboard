<script lang="ts">
  import PostsFilterBar from "$lib/components/posts/PostsFilterBar.svelte";
  import PostsList from "$lib/components/posts/PostsList.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Posts · Creator Dashboard</title></svelte:head>

<section class="space-y-6">
  <div
    class="flex flex-col gap-4 rounded-xl border border-border bg-bg-secondary p-5 sm:flex-row sm:items-start sm:justify-between"
  >
    <div>
      <p class="text-sm uppercase tracking-wide text-fg-muted">
        Content operations
      </p>
      <h1 class="mt-2 text-3xl font-semibold">Post index</h1>
      <p class="mt-2 max-w-2xl text-sm text-fg-muted">
        Find published markdown by author, platform, source relationship, and
        excerpt without leaving the dashboard flow.
      </p>
    </div>
    <div
      class="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-fg-muted"
    >
      {data.posts.length} matching posts
    </div>
  </div>

  <section
    class="space-y-3 rounded-xl border border-border bg-bg-secondary p-5"
  >
    <div>
      <p
        class="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted"
      >
        Filters
      </p>
      <h2 class="mt-1 text-lg font-semibold">Narrow the content set</h2>
    </div>
    <PostsFilterBar filters={data.filters} url={new URL(data.url)} />
  </section>

  <PostsList posts={data.posts} />
</section>
