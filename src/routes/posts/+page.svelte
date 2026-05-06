<script lang="ts">
  import PostsFilterBar from '$lib/components/posts/PostsFilterBar.svelte';
  import PostsList from '$lib/components/posts/PostsList.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Posts · Creator Dashboard</title></svelte:head>

<section class="space-y-6">
  <div class="rounded-xl border border-border bg-bg-secondary p-5">
    <p class="text-sm uppercase tracking-wide text-fg-muted">Posts</p>
    <h1 class="mt-2 text-3xl font-semibold">Content index</h1>
    <p class="mt-2 text-sm text-fg-muted">Markdown posts synced into D1 and linked to source metrics.</p>
  </div>
  <PostsFilterBar filters={data.filters} url={new URL(data.url)} />
  <PostsList posts={data.posts} />
</section>
