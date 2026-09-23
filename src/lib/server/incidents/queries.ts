import { sources, type SourceDef } from '$lib/sources/registry';
import { incidentColumns, mapIncident, type CollectionIncident, type IncidentRow } from './model';

export type IssueState = 'retrying' | 'failed' | 'recovered';
export type CollectorState = 'never-run' | 'stale' | 'healthy' | 'retrying' | 'failed' | 'recovered';

export type IssueListItem = CollectionIncident & {
  name: string;
  state: IssueState;
};

export type CollectorStatus = {
  sourceId: string;
  name: string;
  cadenceHours: number;
  state: CollectorState;
  lastRunAt: number | null;
  lastSuccessAt: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  incidentId: number | null;
};

export type CollectionAttempt = {
  id: number;
  ts: number;
  tier: string;
  statusCode: number | null;
  error: string;
  retryScheduledAt: number | null;
};

export type IssueDetail = {
  incident: IssueListItem;
  attempts: CollectionAttempt[];
  collectorExists: boolean;
};

export type IssueSummary = {
  activeCount: number;
  issues: Array<{ id: number; sourceId: string; name: string }>;
  latestSuccessAt: number | null;
};

type RunRow = {
  source_id: string;
  last_run_at: number;
  last_success_at: number | null;
  last_status: string;
  last_error: string | null;
  consecutive_failures: number;
};

type AttemptRow = {
  id: number;
  ts: number;
  tier: string;
  status_code: number | null;
  error_message: string;
  retry_scheduled_at: number | null;
};

const sourceById: Record<string, SourceDef> = Object.fromEntries(sources.map((source) => [source.id, source]));

function issueState(incident: CollectionIncident, now: number): IssueState {
  if (incident.resolvedAt !== null) return 'recovered';
  return incident.nextRetryAt !== null && incident.nextRetryAt > now ? 'retrying' : 'failed';
}

function issueItem(incident: CollectionIncident, now: number): IssueListItem {
  return {
    ...incident,
    name: sourceById[incident.sourceId]?.name ?? incident.sourceId,
    state: issueState(incident, now)
  };
}

export async function getIssues(
  db: D1Database,
  now = Date.now()
): Promise<{
  activeIssues: IssueListItem[];
  recoveredIssues: IssueListItem[];
  collectors: CollectorStatus[];
}> {
  const [activeResult, recoveredResult, latestResult, runsResult] = await Promise.all([
    db
      .prepare(
        `SELECT ${incidentColumns}
         FROM collection_incidents
         WHERE resolved_at IS NULL
         ORDER BY last_failure_at DESC, id DESC`
      )
      .all<IncidentRow>(),
    db
      .prepare(
        `SELECT ${incidentColumns}
         FROM collection_incidents
         WHERE resolved_at IS NOT NULL
         ORDER BY resolved_at DESC, id DESC
         LIMIT 100`
      )
      .all<IncidentRow>(),
    db
      .prepare(
        `SELECT ${incidentColumns}
         FROM collection_incidents AS incident
         WHERE id = (
           SELECT latest.id
           FROM collection_incidents AS latest
           WHERE latest.source_id = incident.source_id
           ORDER BY latest.last_failure_at DESC, latest.id DESC
           LIMIT 1
         )`
      )
      .all<IncidentRow>(),
    db
      .prepare(
        `SELECT source_id, last_run_at, last_success_at, last_status, last_error, consecutive_failures
         FROM fetcher_runs`
      )
      .all<RunRow>()
  ]);

  const active = activeResult.results.map(mapIncident);
  const recovered = recoveredResult.results.map(mapIncident);
  const latestBySource = new Map(latestResult.results.map((row) => [row.source_id, mapIncident(row)]));
  const runBySource = new Map(runsResult.results.map((run) => [run.source_id, run]));
  const activeBySource = new Map(active.map((incident) => [incident.sourceId, incident]));

  const collectors = sources.map<CollectorStatus>((source) => {
    const run = runBySource.get(source.id);
    const currentIncident = activeBySource.get(source.id);
    const latestIncident = latestBySource.get(source.id);
    let state: CollectorState;

    if (currentIncident) {
      state = issueState(currentIncident, now);
    } else if (!run) {
      state = 'never-run';
    } else if (run.last_status !== 'success' || run.last_success_at === null) {
      state = 'failed';
    } else if (now - run.last_success_at > source.cadenceHours * 2 * 3_600_000) {
      state = 'stale';
    } else if (latestIncident?.resolvedAt === run.last_success_at) {
      state = 'recovered';
    } else {
      state = 'healthy';
    }

    return {
      sourceId: source.id,
      name: source.name,
      cadenceHours: source.cadenceHours,
      state,
      lastRunAt: run?.last_run_at ?? null,
      lastSuccessAt: run?.last_success_at ?? null,
      lastError: run?.last_error ?? null,
      consecutiveFailures: run?.consecutive_failures ?? 0,
      incidentId: currentIncident?.id ?? null
    };
  });

  return {
    activeIssues: active.map((incident) => issueItem(incident, now)),
    recoveredIssues: recovered.map((incident) => issueItem(incident, now)),
    collectors
  };
}

export async function getIssue(db: D1Database, incidentId: number, now = Date.now()): Promise<IssueDetail | null> {
  const row = await db
    .prepare(`SELECT ${incidentColumns} FROM collection_incidents WHERE id = ?`)
    .bind(incidentId)
    .first<IncidentRow>();
  if (!row) return null;

  const attemptResult = await db
    .prepare(
      `SELECT id, ts, tier, status_code, error_message, retry_scheduled_at
       FROM fetcher_failures
       WHERE incident_id = ?
       ORDER BY ts DESC, id DESC`
    )
    .bind(incidentId)
    .all<AttemptRow>();
  const incident = mapIncident(row);

  return {
    incident: issueItem(incident, now),
    attempts: attemptResult.results.map((attempt) => ({
      id: attempt.id,
      ts: attempt.ts,
      tier: attempt.tier,
      statusCode: attempt.status_code,
      error: attempt.error_message,
      retryScheduledAt: attempt.retry_scheduled_at
    })),
    collectorExists: sourceById[incident.sourceId] !== undefined
  };
}

export async function getIssueSummary(db: D1Database, _now = Date.now()): Promise<IssueSummary> {
  const [incidentsResult, runsResult] = await Promise.all([
    db
      .prepare(
        `SELECT id, source_id
         FROM collection_incidents
         WHERE resolved_at IS NULL
         ORDER BY last_failure_at DESC, id DESC`
      )
      .all<{ id: number; source_id: string }>(),
    db.prepare('SELECT source_id, last_success_at FROM fetcher_runs').all<{
      source_id: string;
      last_success_at: number | null;
    }>()
  ]);

  const issues = incidentsResult.results
    .filter((incident) => sourceById[incident.source_id] !== undefined)
    .map((incident) => ({
      id: incident.id,
      sourceId: incident.source_id,
      name: sourceById[incident.source_id]?.name ?? incident.source_id
    }));
  const latestSuccessAt = runsResult.results
    .filter((run) => sourceById[run.source_id] !== undefined)
    .reduce<number | null>(
      (latest, run) =>
        run.last_success_at !== null && (latest === null || run.last_success_at > latest)
          ? run.last_success_at
          : latest,
      null
    );

  return { activeCount: issues.length, issues, latestSuccessAt };
}
