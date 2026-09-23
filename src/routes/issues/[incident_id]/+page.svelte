<script lang="ts">
  import { resolve } from '$app/paths';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let submitting = $state(false);
  let locallyQueued = $state(false);
  const retryQueued = $derived(data.retryQueued || locallyQueued);
  let retryError = $state<string | null>(null);

  const timestampFormat = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  function formatTimestamp(value: number | null): string {
    return value === null ? 'Not available' : timestampFormat.format(new Date(value));
  }

  function notificationTone(state: string): string {
    if (state === 'sent') return 'border-success/30 bg-success/10 text-success';
    if (state === 'failed') return 'border-danger/40 bg-danger/10 text-danger';
    if (state === 'pending' || state === 'sending') return 'border-warning/40 bg-warning/10 text-warning';
    return 'border-border bg-bg-primary text-fg-muted';
  }

  async function requestRetry(): Promise<void> {
    if (submitting || retryQueued || data.incident.resolvedAt !== null) return;
    submitting = true;
    retryError = null;
    try {
      const response = await fetch(resolve('/api/refresh/[source_id]', { source_id: data.incident.sourceId }), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId: data.incident.id })
      });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(body?.message ?? `Retry request failed with status ${response.status}`);
      locallyQueued = true;
    } catch (error) {
      retryError = error instanceof Error ? error.message : 'The retry request failed';
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Issue #{data.incident.id} · Creator Pulse</title>
</svelte:head>

<section class="space-y-6">
  <a
    class="inline-flex items-center gap-2 text-sm font-medium text-glockyco hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-glockyco"
    href={resolve('/issues')}
  >
    <span aria-hidden="true">←</span> All issues
  </a>

  <header
    class={`rounded-xl border p-5 sm:p-6 ${
      data.incident.state === 'failed'
        ? 'border-danger/40 bg-danger/5'
        : data.incident.state === 'retrying'
          ? 'border-warning/40 bg-warning/5'
          : 'border-border bg-bg-secondary'
    }`}
  >
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-2xl font-semibold tracking-tight text-fg-primary sm:text-3xl">{data.incident.name}</h1>
          <span class="text-sm text-fg-muted">Issue #{data.incident.id}</span>
        </div>
        <p class="mt-2 break-all font-mono text-xs text-fg-muted">{data.incident.sourceId}</p>
      </div>
      <span
        class={`w-fit shrink-0 rounded-full border px-3 py-1 text-sm font-semibold ${
          data.incident.state === 'failed'
            ? 'border-danger/40 bg-danger/10 text-danger'
            : data.incident.state === 'retrying'
              ? 'border-warning/40 bg-warning/10 text-warning'
              : 'border-success/30 bg-success/10 text-success'
        }`}
      >
        {data.incident.state}
      </span>
    </div>
  </header>

  <div class="grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(17rem,0.75fr)]">
    <section
      aria-labelledby="latest-failure-heading"
      class="overflow-hidden rounded-xl border border-border bg-bg-secondary"
    >
      <div class="flex min-h-14 items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 id="latest-failure-heading" class="text-lg font-semibold tracking-tight text-fg-primary">
          Failure evidence
        </h2>
        <span class="text-xs font-medium text-danger">Latest failure</span>
      </div>

      <dl class="grid grid-cols-2 border-b border-border sm:grid-cols-3">
        <div class="border-b border-r border-border px-4 py-3.5 sm:border-b-0 sm:px-5">
          <dt class="text-xs text-fg-muted">Failure tier</dt>
          <dd class="mt-1 font-semibold text-fg-primary">{data.incident.latestTier}</dd>
        </div>
        <div class="border-b border-border px-4 py-3.5 sm:border-b-0 sm:border-r sm:px-5">
          <dt class="text-xs text-fg-muted">HTTP status</dt>
          <dd class="mt-1 font-semibold tabular-nums text-fg-primary">
            {data.incident.latestStatusCode ?? 'Not available'}
          </dd>
        </div>
        <div class="col-span-2 px-4 py-3.5 sm:col-span-1 sm:px-5">
          <dt class="text-xs text-fg-muted">Failed attempts</dt>
          <dd class="mt-1 font-semibold tabular-nums text-fg-primary">{data.incident.attemptCount}</dd>
        </div>
      </dl>

      <dl class="grid gap-x-6 gap-y-4 px-5 py-4 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-xs text-fg-muted">First failure</dt>
          <dd class="mt-1 text-fg-primary">{formatTimestamp(data.incident.firstFailureAt)}</dd>
        </div>
        <div>
          <dt class="text-xs text-fg-muted">Last failure</dt>
          <dd class="mt-1 text-fg-primary">{formatTimestamp(data.incident.lastFailureAt)}</dd>
        </div>
        <div>
          <dt class="text-xs text-fg-muted">Last success before issue</dt>
          <dd class="mt-1 text-fg-primary">{formatTimestamp(data.incident.lastSuccessAt)}</dd>
        </div>
        {#if data.incident.nextRetryAt !== null && data.incident.nextRetryAt > data.now}
          <div class="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5">
            <dt class="text-xs text-warning">Automatic next retry</dt>
            <dd class="mt-1 font-semibold text-warning">{formatTimestamp(data.incident.nextRetryAt)}</dd>
          </div>
        {/if}
      </dl>

      <div class="border-t border-border px-5 py-4">
        <h3 class="text-sm font-semibold text-fg-primary">Complete error</h3>
        <pre
          class="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg-primary p-4 font-mono text-sm leading-6 text-fg-primary">{data
            .incident.latestError}</pre>
      </div>
    </section>

    <aside class="space-y-5">
      <section aria-labelledby="recovery-heading" class="rounded-xl border border-border bg-bg-secondary p-5">
        <h2 id="recovery-heading" class="text-lg font-semibold tracking-tight text-fg-primary">Recovery</h2>
        {#if data.incident.resolvedAt !== null}
          <div class="mt-4 flex gap-3 rounded-lg border border-success/30 bg-success/10 p-3.5">
            <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden="true"></span>
            <p class="text-sm leading-6 text-fg-muted">
              <span class="font-semibold text-success">Recovered.</span>
              The collector succeeded on {formatTimestamp(data.incident.resolvedAt)}.
            </p>
          </div>
        {:else if !data.collectorExists}
          <p class="mt-4 rounded-lg border border-border bg-bg-primary p-3.5 text-sm leading-6 text-fg-muted">
            This collector is no longer registered. A manual retry is not available.
          </p>
        {:else}
          <p class="mt-3 text-sm leading-6 text-fg-muted">
            A manual retry queues one forced collection. The issue remains active until that collection succeeds.
          </p>
          <button
            class="mt-4 w-full rounded-lg bg-glockyco px-4 py-2.5 text-sm font-semibold text-bg-primary outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-glockyco focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={submitting || retryQueued}
            aria-busy={submitting}
            onclick={requestRetry}
          >
            {submitting ? 'Queueing retry…' : retryQueued ? 'Retry queued' : 'Retry now'}
          </button>
          {#if retryQueued && !submitting}
            <p class="mt-3 text-xs leading-5 text-fg-muted" role="status">
              The forced collection is queued. This page will show recovery after a successful run.
            </p>
          {/if}
          {#if retryError}
            <p class="mt-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger" role="alert">
              {retryError}
            </p>
          {/if}
        {/if}
      </section>

      <section aria-labelledby="notifications-heading" class="rounded-xl border border-border bg-bg-secondary p-5">
        <h2 id="notifications-heading" class="text-lg font-semibold tracking-tight text-fg-primary">Notifications</h2>
        <dl class="mt-3 divide-y divide-border text-sm">
          <div class="flex items-center justify-between gap-4 py-3 first:pt-0">
            <dt class="text-fg-muted">Failure</dt>
            <dd
              class={`rounded-full border px-2.5 py-1 font-medium ${notificationTone(data.incident.failureNotificationState)}`}
            >
              {data.incident.failureNotificationState}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4 py-3 last:pb-0">
            <dt class="text-fg-muted">Recovery</dt>
            <dd
              class={`rounded-full border px-2.5 py-1 font-medium ${notificationTone(data.incident.recoveryNotificationState)}`}
            >
              {data.incident.recoveryNotificationState}
            </dd>
          </div>
        </dl>
      </section>
    </aside>
  </div>

  <section
    aria-labelledby="attempt-history-heading"
    class="overflow-hidden rounded-xl border border-border bg-bg-secondary"
  >
    <div class="flex min-h-14 items-center justify-between gap-3 border-b border-border px-5 py-3">
      <h2 id="attempt-history-heading" class="text-lg font-semibold tracking-tight text-fg-primary">Attempt history</h2>
      <span class="text-xs text-fg-muted">
        {data.attempts.length} linked {data.attempts.length === 1 ? 'attempt' : 'attempts'}
      </span>
    </div>
    {#if data.attempts.length === 0}
      <p class="px-5 py-4 text-sm text-fg-muted">No linked attempts are available for this incident.</p>
    {:else}
      <ol class="divide-y divide-border">
        {#each data.attempts as attempt (attempt.id)}
          <li>
            <article class="px-5 py-4">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="font-semibold text-fg-primary">{attempt.tier}</h3>
                    <span
                      class="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger"
                    >
                      HTTP {attempt.statusCode ?? 'not available'}
                    </span>
                  </div>
                  {#if attempt.retryScheduledAt !== null}
                    <p class="mt-2 text-xs text-warning">
                      Retry scheduled for {formatTimestamp(attempt.retryScheduledAt)}
                    </p>
                  {/if}
                </div>
                <time class="shrink-0 text-xs text-fg-muted" datetime={new Date(attempt.ts).toISOString()}>
                  {formatTimestamp(attempt.ts)}
                </time>
              </div>
              <pre
                class="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg-primary p-4 font-mono text-sm leading-6 text-fg-muted">{attempt.error}</pre>
            </article>
          </li>
        {/each}
      </ol>
    {/if}
  </section>
</section>
