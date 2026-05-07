import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type SmokeMode = 'public' | 'authenticated' | 'all';

export type SmokeArgs = {
  mode: SmokeMode;
  sourceIds: string[];
  json: boolean;
  strict: boolean;
};

type SmokeSource = {
  id: string;
  name: string;
  identity: string;
  category: string;
  cadenceHours: number;
  config: Record<string, unknown>;
  fetcher: (input: { source: SmokeSource; env: Env; now: number }) => Promise<{ metric_points: SmokeMetric[]; events: SmokeEvent[] }>;
};

type SmokeMetric = { source_id: string; metric: string; ts: number; value: number; dimensions: Record<string, unknown> | null };
type SmokeEvent = { source_id: string; external_id: string; ts: number; kind: string; author: string | null; title: string | null; body: string | null; url: string | null; metadata: Record<string, unknown> | null };

export type SmokeResult = {
  source_id: string;
  name: string;
  status: 'ok' | 'skipped' | 'failed';
  metric_points: number;
  events: number;
  duration_ms: number;
  missing_secrets?: string[];
  error?: string;
  sample_metrics: Array<{ metric: string; value: number; dimensions: Record<string, unknown> | null }>;
  sample_events: Array<{ kind: string; title: string | null; ts: number }>;
};

export function parseSmokeArgs(argv: string[]): SmokeArgs {
  const parsed: SmokeArgs = { mode: 'public', sourceIds: [], json: false, strict: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--public') parsed.mode = 'public';
    else if (arg === '--authenticated') parsed.mode = 'authenticated';
    else if (arg === '--all') parsed.mode = 'all';
    else if (arg === '--json') parsed.json = true;
    else if (arg === '--strict') parsed.strict = true;
    else if (arg === '--source') {
      const value = argv[index + 1];
      if (!value) throw new Error('--source requires a value');
      parsed.sourceIds.push(value);
      index += 1;
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return parsed;
}

export function parseDevVars(text: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    if (equals <= 0) continue;
    const key = line.slice(0, equals).trim();
    vars[key] = stripQuotes(line.slice(equals + 1).trim());
  }
  return vars;
}

export function secretRequirements(sourceId: string): string[] {
  if (sourceId.startsWith('github-')) return ['GITHUB_PAT'];
  if (sourceId.startsWith('steam-guide-')) return ['STEAM_WEB_API_KEY'];
  if (sourceId.startsWith('gsc-')) return ['GOOGLE_SERVICE_ACCOUNT'];
  if (sourceId.startsWith('bing-')) return ['BING_WEBMASTER_API_KEY'];
  if (sourceId.startsWith('cf-analytics-')) return ['CF_API_TOKEN', 'CF_ANALYTICS_SITE_TAGS'];
  if (sourceId.startsWith('ga4') || sourceId.includes('-ga4-')) return ['GOOGLE_SERVICE_ACCOUNT', 'GA4_PROPERTY_ID'];
  return [];
}

export async function runSmokeSources(options: { sources: SmokeSource[]; env: Record<string, string>; args: SmokeArgs; now?: number }): Promise<SmokeResult[]> {
  const selected = selectSources(options.sources, options.args);
  const results: SmokeResult[] = [];
  for (const source of selected) {
    const missing = secretRequirements(source.id).filter((key) => !options.env[key]);
    if (missing.length > 0) {
      results.push(skipped(source, missing));
      continue;
    }

    const started = Date.now();
    try {
      const output = await source.fetcher({ source, env: options.env as unknown as Env, now: options.now ?? Date.now() });
      results.push({
        source_id: source.id,
        name: source.name,
        status: 'ok',
        metric_points: output.metric_points.length,
        events: output.events.length,
        duration_ms: Date.now() - started,
        sample_metrics: output.metric_points.slice(0, 3).map((point) => ({ metric: point.metric, value: point.value, dimensions: point.dimensions })),
        sample_events: output.events.slice(0, 3).map((event) => ({ kind: event.kind, title: event.title, ts: event.ts }))
      });
    } catch (error) {
      results.push({
        source_id: source.id,
        name: source.name,
        status: 'failed',
        metric_points: 0,
        events: 0,
        duration_ms: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
        sample_metrics: [],
        sample_events: []
      });
    }
  }
  return results;
}

async function main(): Promise<void> {
  const args = parseSmokeArgs(process.argv.slice(2));
  const env = { ...process.env, ...(await readDevVarsIfPresent('.dev.vars')) } as Record<string, string>;
  const sources = await loadRegistrySources();
  const results = await runSmokeSources({ sources, env, args });
  if (args.json) console.log(JSON.stringify(results, null, 2));
  else printResults(results);
  if (results.some((result) => result.status === 'failed') || (args.strict && results.some((result) => result.status === 'skipped'))) process.exitCode = 1;
}

async function readDevVarsIfPresent(path: string): Promise<Record<string, string>> {
  if (!existsSync(path)) return {};
  return parseDevVars(await readFile(path, 'utf8'));
}

async function loadRegistrySources(): Promise<SmokeSource[]> {
  const { createServer } = await import('vite');
  const server = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
  try {
    const module = (await server.ssrLoadModule('/src/lib/sources/registry.ts')) as { sources: SmokeSource[] };
    return module.sources;
  } finally {
    await server.close();
  }
}

function selectSources(sources: SmokeSource[], args: SmokeArgs): SmokeSource[] {
  const sourceIds = new Set(args.sourceIds);
  return sources.filter((source) => {
    if (sourceIds.size > 0) return sourceIds.has(source.id);
    const hasSecrets = secretRequirements(source.id).length > 0;
    if (args.mode === 'public') return !hasSecrets;
    if (args.mode === 'authenticated') return hasSecrets;
    return true;
  });
}

function skipped(source: SmokeSource, missing: string[]): SmokeResult {
  return { source_id: source.id, name: source.name, status: 'skipped', metric_points: 0, events: 0, duration_ms: 0, missing_secrets: missing, sample_metrics: [], sample_events: [] };
}

function printResults(results: SmokeResult[]): void {
  for (const result of results) {
    if (result.status === 'ok') {
      console.log(`ok ${result.source_id}: ${result.metric_points} metric points, ${result.events} events (${result.duration_ms}ms)`);
      for (const metric of result.sample_metrics) console.log(`  metric ${metric.metric}=${metric.value}${metric.dimensions ? ` ${JSON.stringify(metric.dimensions)}` : ''}`);
      for (const event of result.sample_events) console.log(`  event ${event.kind}: ${event.title ?? '<untitled>'}`);
    } else if (result.status === 'skipped') console.log(`skipped ${result.source_id}: missing ${result.missing_secrets?.join(', ')}`);
    else console.log(`failed ${result.source_id}: ${result.error}`);
  }
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
  return value;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
