<script lang="ts">
  import type { IndexedPost } from '$lib/server/posts';

  let { post }: { post: IndexedPost } = $props();
</script>

<section class="rounded-xl border border-border bg-bg-secondary p-5">
  <a class="text-sm text-fg-muted hover:text-fg-primary" href="/posts">← Posts</a>
  <p class="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">{post.author} · {post.platform} · {new Date(post.posted_at).toLocaleDateString()}</p>
  <h1 class="mt-2 text-3xl font-semibold">{post.title}</h1>
  <div class="mt-4 flex flex-wrap gap-2">
    {#each post.tags as tag}<span class="rounded-full border border-border px-3 py-1 text-xs text-fg-muted">{tag}</span>{/each}
    {#each post.related_sources as source}<a class="rounded-full border border-border px-3 py-1 text-xs text-fg-muted hover:text-fg-primary" href={`/sources/${source}`}>{source}</a>{/each}
  </div>
  <a class="mt-4 inline-block text-sm text-glockyco hover:underline" href={post.url}>Open original</a>
</section>
