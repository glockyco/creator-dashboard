import { fileURLToPath } from 'node:url';
import { readBackfillEnv } from './backfill/lib/env.ts';
import { cfDailyWindows, type DateWindow } from './backfill/lib/windows.ts';
import { executeRemote, parseBackfillArgs, writeMetricBackfill } from './backfill/lib/run.ts';
import { fetchCfAnalyticsRange } from '../src/lib/connectors/fetchers/cf-analytics.ts';
import type { MetricPoint } from '../src/lib/types/domain';

export type BackfillSource = { id: string; category: string; config: Record<string, unknown> };
export type BackfillResult = { out: string; rowCount: number; sourceCount: number; executed: boolean };
export type CfBackfillOptions = {
  args?: string[];
  env?: Env;
  sources?: BackfillSource[];
  windows?: DateWindow[];
  writer?: typeof writeMetricBackfill;
  executor?: typeof executeRemote;
};

export async function runCfBackfill(options: CfBackfillOptions = {}): Promise<BackfillResult> {
  const parsed = parseBackfillArgs(options.args ?? process.argv.slice(2), '.tmp/backfill-cf.sql');
  const env = readBackfillEnvForMode(parsed, options.env);
  const sources = env ? filterCfSources(options.sources ?? (await loadSourceRecords()), env) : [];
  const windows = options.windows ?? cfDailyWindows();
  const rows: MetricPoint[] = [];

  if (env) {
    for (const source of sources) {
      for (const window of windows) {
        const output = await fetchCfAnalyticsRange({ source: source as never, env, startDate: window.startDate, endDate: window.endDate });
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
  const module = (await import(new URL('../src/lib/sources/registry-data.ts', import.meta.url).href)) as { sourceRecords: BackfillSource[] };
  return module.sourceRecords;
}

function filterCfSources(sources: BackfillSource[], env: Pick<Env, 'CF_ANALYTICS_SITE_TAGS'>): BackfillSource[] {
  const siteTags = JSON.parse(env.CF_ANALYTICS_SITE_TAGS) as Record<string, string>;
  return sources.filter((source) => source.id.startsWith('cf-analytics-') && Boolean(siteTags[source.id]));
}

function readBackfillEnvForMode(parsed: { dryRun: boolean; executeRemote: boolean }, env: NodeJS.ProcessEnv | Env | undefined): Env | null {
  try {
    return readBackfillEnv(env ?? process.env);
  } catch (error) {
    if (parsed.dryRun && !parsed.executeRemote && error instanceof Error && error.message.startsWith('missing required env var ')) return null;
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCfBackfill()
    .then((result) => console.log(`wrote ${result.rowCount} Cloudflare metric rows for ${result.sourceCount} sources to ${result.out}`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
