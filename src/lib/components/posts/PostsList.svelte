<script lang="ts">
  import type { IndexedPost } from "$lib/server/posts";

  let { posts }: { posts: IndexedPost[] } = $props();

  const formatPostedDate = (timestamp: number) =>
    new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(timestamp));
</script>

<section
  class="overflow-hidden rounded-xl border border-border bg-bg-secondary"
>
  <div class="border-b border-border p-5">
    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">
      Library
    </p>
    <h2 class="mt-1 text-lg font-semibold">Posts</h2>
    <p class="text-sm text-fg-muted">
      Each row opens the post detail with source performance context.
    </p>
  </div>

  {#if posts.length === 0}
    <div class="p-5">
      <div
        class="rounded-lg border border-dashed border-border bg-bg-primary p-8 text-center"
      >
        <h3 class="font-medium text-fg-primary">
          No posts match these filters
        </h3>
        <p class="mt-2 text-sm text-fg-muted">
          Clear the active author, tag, or source filter to recover the full
          content index.
        </p>
      </div>
    </div>
  {:else}
    <div class="hidden md:block">
      <div
        class="grid grid-cols-[1.5fr_0.8fr_0.9fr_1fr] border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wide text-fg-muted"
      >
        <span>Post</span>
        <span>Author / platform</span>
        <span>Posted</span>
        <span>Related sources</span>
      </div>
      <div class="divide-y divide-border">
        {#each posts as post}
          <a
            class="grid grid-cols-[1.5fr_0.8fr_0.9fr_1fr] gap-4 px-5 py-4 transition hover:bg-bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-fg-primary"
            href={`/posts/${post.slug}`}
          >
            <div>
              <h3 class="font-medium text-fg-primary">{post.title}</h3>
              {#if post.body_excerpt}
                <p class="mt-1 line-clamp-2 text-sm text-fg-muted">
                  {post.body_excerpt}
                </p>
              {/if}
            </div>
            <div class="text-sm text-fg-muted">
              <p class="font-medium text-fg-primary">{post.author}</p>
              <p>{post.platform}</p>
            </div>
            <time
              class="text-sm text-fg-muted"
              datetime={new Date(post.posted_at).toISOString()}
              >{formatPostedDate(post.posted_at)}</time
            >
            <p class="text-sm text-fg-muted">
              {post.related_sources.join(", ") || "No linked sources"}
            </p>
          </a>
        {/each}
      </div>
    </div>

    <div class="divide-y divide-border md:hidden">
      {#each posts as post}
        <a
          class="block p-4 transition hover:bg-bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-fg-primary"
          href={`/posts/${post.slug}`}
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-wide text-fg-muted">
                {post.author} · {post.platform}
              </p>
              <h3 class="mt-1 font-medium text-fg-primary">{post.title}</h3>
            </div>
            <time
              class="shrink-0 text-xs text-fg-muted"
              datetime={new Date(post.posted_at).toISOString()}
              >{formatPostedDate(post.posted_at)}</time
            >
          </div>
          {#if post.body_excerpt}
            <p class="mt-2 text-sm text-fg-muted">{post.body_excerpt}</p>
          {/if}
          <p class="mt-3 text-xs text-fg-muted">
            Sources: {post.related_sources.join(", ") || "No linked sources"}
          </p>
        </a>
      {/each}
    </div>
  {/if}
</section>
