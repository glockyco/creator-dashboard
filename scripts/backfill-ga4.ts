import { fileURLToPath } from 'node:url';
import { readBackfillEnv } from './backfill/lib/env.ts';
import { ga4MonthlyWindows, type DateWindow } from './backfill/lib/windows.ts';
import { executeRemote, parseBackfillArgs, writeMetricBackfill } from './backfill/lib/run.ts';
import { fetchGa4Range } from '../src/lib/connectors/fetchers/ga4.ts';
import type { MetricPoint } from '../src/lib/types/domain';

export type BackfillSource = { id: string; category: string; config: Record<string, unknown> };
export type BackfillResult = { out: string; rowCount: number; sourceCount: number; executed: boolean };
export type Ga4BackfillOptions = {
  args?: string[];
  env?: Env;
  sources?: BackfillSource[];
  windows?: DateWindow[];
  writer?: typeof writeMetricBackfill;
  executor?: typeof executeRemote;
};

export async function runGa4Backfill(options: Ga4BackfillOptions = {}): Promise<BackfillResult> {
  const parsed = parseBackfillArgs(options.args ?? process.argv.slice(2), '.tmp/backfill-ga4.sql');
  const sources = filterGa4Sources(options.sources ?? (await loadSourceRecords()));
  const env =
    sources.length > 0
      ? readBackfillEnv(options.env ?? process.env, { includeGa4: true })
      : ((options.env ?? process.env) as Env);
  const windows = options.windows ?? ga4MonthlyWindows();
  const rows: MetricPoint[] = [];

  for (const source of sources) {
    for (const window of windows) {
      const output = await fetchGa4Range({
        source: source as never,
        env,
        startDate: window.startDate,
        endDate: window.endDate
      });
      rows.push(...output.metric_points);
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

function filterGa4Sources(sources: BackfillSource[]): BackfillSource[] {
  return sources.filter((source) => source.id.startsWith('ga4-') || source.id === 'ga4');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runGa4Backfill()
    .then((result) =>
      console.log(`wrote ${result.rowCount} GA4 metric rows for ${result.sourceCount} sources to ${result.out}`)
    )
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
