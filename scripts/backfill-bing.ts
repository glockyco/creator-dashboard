import { fileURLToPath } from 'node:url';
import { readBackfillEnv } from './backfill/lib/env.ts';
import { singleWindow, type DateWindow } from './backfill/lib/windows.ts';
import { executeRemote, parseBackfillArgs, writeMetricBackfill } from './backfill/lib/run.ts';
import { fetchBingWebmasterRange } from '../src/lib/connectors/fetchers/bing-webmaster.ts';
import type { MetricPoint } from '../src/lib/types/domain';

export type BackfillSource = { id: string; category: string; config: Record<string, unknown> };
export type BackfillResult = { out: string; rowCount: number; sourceCount: number; executed: boolean };
export type BingBackfillOptions = {
  args?: string[];
  env?: Env;
  sources?: BackfillSource[];
  windows?: DateWindow[];
  writer?: typeof writeMetricBackfill;
  executor?: typeof executeRemote;
};

export async function runBingBackfill(options: BingBackfillOptions = {}): Promise<BackfillResult> {
  const parsed = parseBackfillArgs(options.args ?? process.argv.slice(2), '.tmp/backfill-bing.sql');
  const env = readBackfillEnvForMode(parsed, options.env);
  const sources = env ? filterBingSources(options.sources ?? (await loadSourceRecords()), env) : [];
  const windows =
    options.windows ?? singleWindow('1970-01-01', new Date(Date.now() - 86_400_000).toISOString().slice(0, 10));
  const rows: MetricPoint[] = [];

  if (env) {
    for (const source of sources) {
      for (const window of windows) {
        const output = await fetchBingWebmasterRange({
          source: source as never,
          env,
          startDate: window.startDate,
          endDate: window.endDate
        });
        rows.push(...output.metric_points);
      }
    }
  }

  const writer = options.writer ?? writeMetricBackfill;
  await writer(rows, parsed.out, 500);
  if (parsed.executeRemote) (options.executor ?? executeRemote)(parsed.out);
  return { out: parsed.out, rowCount: rows.length, sourceCount: sources.length, executed: parsed.executeRemote };
}

async function loadSourceRecords(): Promise<BackfillSource[]> {
  const module = (await import(new URL('../src/lib/sources/registry-data.ts', import.meta.url).href)) as {
    sourceRecords: BackfillSource[];
  };
  return module.sourceRecords;
}

function filterBingSources(sources: BackfillSource[], env: Pick<Env, 'BING_PROPERTIES'>): BackfillSource[] {
  const allowed = parseStringSet(env.BING_PROPERTIES);
  return sources.filter(
    (source) => source.id.startsWith('bing-') && (allowed.size === 0 || allowed.has(String(source.config.siteUrl)))
  );
}

function parseStringSet(value: string): Set<string> {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) throw new Error('BING_PROPERTIES must be a JSON array');
  return new Set(parsed.map((item) => String(item)));
}

function readBackfillEnvForMode(
  parsed: { dryRun: boolean; executeRemote: boolean },
  env: NodeJS.ProcessEnv | Env | undefined
): Env | null {
  try {
    return readBackfillEnv(env ?? process.env);
  } catch (error) {
    if (
      parsed.dryRun &&
      !parsed.executeRemote &&
      error instanceof Error &&
      error.message.startsWith('missing required env var ')
    )
      return null;
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runBingBackfill()
    .then((result) =>
      console.log(`wrote ${result.rowCount} Bing metric rows for ${result.sourceCount} sources to ${result.out}`)
    )
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
