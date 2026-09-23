<script lang="ts">
  import { resolve } from '$app/paths';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const timestampFormat = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  const stateTone: Record<string, string> = {
    'never-run': 'border-border bg-bg-primary text-fg-muted',
    stale: 'border-warning/40 bg-warning/10 text-warning',
    healthy: 'border-success/30 bg-success/10 text-success',
    retrying: 'border-warning/40 bg-warning/10 text-warning',
    failed: 'border-danger/40 bg-danger/10 text-danger',
    recovered: 'border-success/30 bg-success/10 text-success'
  };

  function formatTimestamp(value: number | null): string {
    return value === null ? 'Never' : timestampFormat.format(new Date(value));
  }
</script>

<svelte:head>
  <title>Issues · Creator Pulse</title>
</svelte:head>

<section class="space-y-6">
  <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <h1 class="text-2xl font-semibold tracking-tight text-fg-primary sm:text-3xl">Issues</h1>
    <dl class="flex w-fit overflow-hidden rounded-lg border border-border bg-bg-secondary text-sm">
      <div class="border-r border-border px-4 py-2.5">
        <dt class="text-xs text-fg-muted">Active</dt>
        <dd
          class={`mt-0.5 font-semibold tabular-nums ${data.activeIssues.length > 0 ? 'text-danger' : 'text-success'}`}
        >
          {data.activeIssues.length}
        </dd>
      </div>
      <div class="px-4 py-2.5">
        <dt class="text-xs text-fg-muted">Collectors</dt>
        <dd class="mt-0.5 font-semibold tabular-nums text-fg-primary">{data.collectors.length}</dd>
      </div>
    </dl>
  </header>

  <section
    aria-labelledby="active-issues-heading"
    class="overflow-hidden rounded-xl border border-border bg-bg-secondary"
  >
    <div class="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
      <h2 id="active-issues-heading" class="text-lg font-semibold tracking-tight text-fg-primary">Active issues</h2>
      <span class={`text-xs font-medium ${data.activeIssues.length > 0 ? 'text-danger' : 'text-success'}`}>
        {data.activeIssues.length > 0 ? `${data.activeIssues.length} need attention` : 'All collectors clear'}
      </span>
    </div>

    {#if data.activeIssues.length === 0}
      <div class="flex items-center gap-3 px-5 py-4 text-sm text-fg-muted">
        <span class="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden="true"></span>
        <p>No active failures.</p>
      </div>
    {:else}
      <div class="divide-y divide-border">
        {#each data.activeIssues as issue (issue.id)}
          <a
            class={`group block border-l-2 px-5 py-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-glockyco ${
              issue.state === 'failed'
                ? 'border-l-danger bg-danger/5 hover:bg-danger/10'
                : 'border-l-warning bg-warning/5 hover:bg-warning/10'
            }`}
            href={resolve('/issues/[incident_id]', { incident_id: String(issue.id) })}
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="font-semibold text-fg-primary transition-colors group-hover:text-glockyco">
                    {issue.name}
                  </h3>
                  <span class={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${stateTone[issue.state]}`}>
                    {issue.state}
                  </span>
                </div>
                <p class="mt-1 font-mono text-xs text-fg-muted">Issue #{issue.id} · {issue.sourceId}</p>
              </div>
              <time class="shrink-0 text-xs text-fg-muted" datetime={new Date(issue.lastFailureAt).toISOString()}>
                {formatTimestamp(issue.lastFailureAt)}
              </time>
            </div>
            <p class="mt-3 break-words font-mono text-sm leading-6 text-fg-primary">{issue.latestError}</p>
            <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
              <span>{issue.attemptCount} failed {issue.attemptCount === 1 ? 'attempt' : 'attempts'}</span>
              {#if issue.nextRetryAt !== null && issue.nextRetryAt > data.now}
                <span class="font-medium text-warning">Automatic retry {formatTimestamp(issue.nextRetryAt)}</span>
              {/if}
              <span class="ml-auto font-medium text-glockyco">Review issue →</span>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </section>

  <section
    aria-labelledby="collector-freshness-heading"
    class="overflow-hidden rounded-xl border border-border bg-bg-secondary"
  >
    <div
      class="flex min-h-14 flex-col justify-center gap-1 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      <h2 id="collector-freshness-heading" class="text-lg font-semibold tracking-tight text-fg-primary">
        Collector ledger
      </h2>
      <p class="text-xs text-fg-muted">Stale after two expected collection intervals.</p>
    </div>

    <div class="divide-y divide-border md:hidden">
      {#each data.collectors as collector (collector.sourceId)}
        <article class="p-5">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              {#if collector.incidentId !== null}
                <a
                  class="font-semibold text-glockyco hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glockyco"
                  href={resolve('/issues/[incident_id]', { incident_id: String(collector.incidentId) })}
                >
                  {collector.name}
                </a>
              {:else}
                <h3 class="font-semibold text-fg-primary">{collector.name}</h3>
              {/if}
              <p class="mt-1 break-all font-mono text-xs text-fg-muted">{collector.sourceId}</p>
            </div>
            <span
              class={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${stateTone[collector.state]}`}
            >
              {collector.state}
            </span>
          </div>
          <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-sm">
            <div>
              <dt class="text-xs text-fg-muted">Last run</dt>
              <dd class="mt-1 text-fg-primary">{formatTimestamp(collector.lastRunAt)}</dd>
            </div>
            <div>
              <dt class="text-xs text-fg-muted">Last success</dt>
              <dd class="mt-1 text-fg-primary">{formatTimestamp(collector.lastSuccessAt)}</dd>
            </div>
            <div class="col-span-2">
              <dt class="text-xs text-fg-muted">Expected cadence</dt>
              <dd class="mt-1 text-fg-primary">Every {collector.cadenceHours}h</dd>
            </div>
          </dl>
        </article>
      {/each}
    </div>

    <div class="hidden overflow-x-auto md:block">
      <table class="w-full min-w-[720px] text-left text-sm">
        <thead class="bg-bg-primary text-xs uppercase tracking-[0.08em] text-fg-muted">
          <tr>
            <th scope="col" class="px-5 py-3 font-semibold">Collector</th>
            <th scope="col" class="px-4 py-3 font-semibold">State</th>
            <th scope="col" class="px-4 py-3 font-semibold">Last run</th>
            <th scope="col" class="px-4 py-3 font-semibold">Last success</th>
            <th scope="col" class="px-5 py-3 text-right font-semibold">Cadence</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          {#each data.collectors as collector (collector.sourceId)}
            <tr class="transition-colors hover:bg-bg-primary/60">
              <th scope="row" class="px-5 py-4 font-normal">
                {#if collector.incidentId !== null}
                  <a
                    class="font-semibold text-glockyco hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glockyco"
                    href={resolve('/issues/[incident_id]', { incident_id: String(collector.incidentId) })}
                  >
                    {collector.name}
                  </a>
                {:else}
                  <span class="font-semibold text-fg-primary">{collector.name}</span>
                {/if}
                <p class="mt-1 font-mono text-xs text-fg-muted">{collector.sourceId}</p>
              </th>
              <td class="px-4 py-4">
                <span class={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${stateTone[collector.state]}`}>
                  {collector.state}
                </span>
              </td>
              <td class="px-4 py-4 text-fg-muted">{formatTimestamp(collector.lastRunAt)}</td>
              <td class="px-4 py-4 text-fg-muted">{formatTimestamp(collector.lastSuccessAt)}</td>
              <td class="px-5 py-4 text-right text-fg-muted">Every {collector.cadenceHours}h</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section
    aria-labelledby="recovered-issues-heading"
    class="overflow-hidden rounded-xl border border-border bg-bg-secondary"
  >
    <div class="flex min-h-14 items-center justify-between gap-3 border-b border-border px-5 py-3">
      <h2 id="recovered-issues-heading" class="text-lg font-semibold tracking-tight text-fg-primary">
        Recovered incidents
      </h2>
      <span class="text-xs tabular-nums text-fg-muted">{data.recoveredIssues.length}</span>
    </div>
    {#if data.recoveredIssues.length === 0}
      <p class="px-5 py-4 text-sm text-fg-muted">No recovered incidents are recorded.</p>
    {:else}
      <div class="divide-y divide-border">
        {#each data.recoveredIssues as issue (issue.id)}
          <a
            class="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-bg-primary/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-glockyco sm:flex-row sm:items-center sm:justify-between"
            href={resolve('/issues/[incident_id]', { incident_id: String(issue.id) })}
          >
            <span class="flex min-w-0 items-start gap-3">
              <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden="true"></span>
              <span class="min-w-0">
                <span class="block font-medium text-fg-primary transition-colors group-hover:text-glockyco"
                  >{issue.name}</span
                >
                <span class="mt-1 block font-mono text-xs text-fg-muted">Issue #{issue.id} · {issue.sourceId}</span>
              </span>
            </span>
            <span class="pl-5 text-sm text-fg-muted sm:pl-0">Recovered {formatTimestamp(issue.resolvedAt)}</span>
          </a>
        {/each}
      </div>
    {/if}
  </section>
</section>
