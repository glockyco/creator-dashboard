<script lang="ts">
  let { data } = $props();

  const statusTone = (status: unknown) => {
    if (status === 'success') return 'border-success/40 bg-success/10 text-success';
    if (typeof status === 'string' && status !== 'success') return 'border-danger/40 bg-danger/10 text-danger';
    return 'border-border bg-bg-primary text-fg-muted';
  };

  const formatTimestamp = (value: unknown) => {
    if (typeof value !== 'number') return '—';
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Vienna'
    }).format(new Date(value));
  };
</script>

<svelte:head>
  <title>Health · Creator Dashboard</title>
</svelte:head>

<section class="space-y-6">
  <div
    class="flex flex-col gap-4 rounded-xl border border-border bg-bg-secondary p-5 sm:flex-row sm:items-start sm:justify-between"
  >
    <div>
      <p class="text-sm uppercase tracking-wide text-fg-muted">Operations health</p>
      <h1 class="mt-2 text-3xl font-semibold">Fetcher status</h1>
      <p class="mt-2 max-w-2xl text-sm text-fg-muted">
        Review source freshness, recent ingestion failures, and alert delivery from one recovery surface.
      </p>
    </div>
    <div class="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-fg-muted">
      {data.runs.length} tracked runs · {data.failures.length} recent failures
    </div>
  </div>

  <section class="rounded-xl border border-border bg-bg-secondary p-5">
    <div class="mb-4">
      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Freshness</p>
      <h2 class="mt-1 text-lg font-semibold">Fetcher runs</h2>
      <p class="text-sm text-fg-muted">
        Use consecutive failures and last success to decide what needs manual recovery.
      </p>
    </div>
    {#if data.runs.length === 0}
      <div class="rounded-lg border border-dashed border-border bg-bg-primary p-6 text-center text-sm text-fg-muted">
        No fetcher runs have been recorded yet. Trigger a refresh, then return here to confirm source health.
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="border-b border-border text-xs uppercase tracking-wide text-fg-muted">
            <tr
              ><th class="px-3 py-3">Source</th><th class="px-3 py-3">Status</th><th class="px-3 py-3">Last run</th><th
                class="px-3 py-3">Last success</th
              ><th class="px-3 py-3">Failures</th><th class="px-3 py-3">Latest error</th></tr
            >
          </thead>
          <tbody class="divide-y divide-border">
            {#each data.runs as run (run.source_id)}
              <tr class="align-top">
                <td class="px-3 py-3 font-mono text-fg-primary">{run.source_id}</td>
                <td class="px-3 py-3"
                  ><span
                    class={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(run.last_status)}`}
                    >{run.last_status ?? 'unknown'}</span
                  ></td
                >
                <td class="px-3 py-3 text-fg-muted">{formatTimestamp(run.last_run_at)}</td>
                <td class="px-3 py-3 text-fg-muted">{formatTimestamp(run.last_success_at)}</td>
                <td class="px-3 py-3 font-medium">{run.consecutive_failures}</td>
                <td class="max-w-sm px-3 py-3 text-fg-muted">{run.last_error ?? '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  <div class="grid gap-4 xl:grid-cols-[2fr_1fr]">
    <section class="rounded-xl border border-border bg-bg-secondary p-5">
      <div class="mb-4">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Recovery queue</p>
        <h2 class="mt-1 text-lg font-semibold">Recent failures</h2>
        <p class="text-sm text-fg-muted">
          Newest failed ingest attempts with source, tier, HTTP status, and captured error.
        </p>
      </div>
      {#if data.failures.length === 0}
        <div class="rounded-lg border border-dashed border-border bg-bg-primary p-6 text-center text-sm text-fg-muted">
          No recent failures. Current ingestion checks have not produced recovery work.
        </div>
      {:else}
        <div class="space-y-3">
          {#each data.failures as failure (`${failure.source_id}::${failure.ts}`)}
            <article class="rounded-lg border border-border bg-bg-primary p-4">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p class="font-mono text-sm text-fg-primary">
                    {failure.source_id}
                  </p>
                  <p class="mt-1 text-sm text-fg-muted">
                    {failure.tier} · status {failure.status_code ?? '—'}
                  </p>
                </div>
                <time class="text-sm text-fg-muted">{formatTimestamp(failure.ts)}</time>
              </div>
              <p class="mt-3 text-sm text-fg-muted">{failure.error_message}</p>
            </article>
          {/each}
        </div>
      {/if}
    </section>

    <section class="rounded-xl border border-border bg-bg-secondary p-5">
      <div class="mb-4">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Notification audit</p>
        <h2 class="mt-1 text-lg font-semibold">Alerts sent</h2>
        <p class="text-sm text-fg-muted">Recent alert keys and delivery timestamps.</p>
      </div>
      {#if data.alerts.length === 0}
        <div class="rounded-lg border border-dashed border-border bg-bg-primary p-6 text-center text-sm text-fg-muted">
          No alerts have been sent yet.
        </div>
      {:else}
        <div class="space-y-3">
          {#each data.alerts as alert (alert.alert_key)}
            <div class="rounded-lg border border-border bg-bg-primary p-4">
              <p class="font-mono text-sm text-fg-primary">{alert.alert_key}</p>
              <p class="mt-1 text-sm text-fg-muted">
                {formatTimestamp(alert.sent_at)}
              </p>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  </div>
</section>
