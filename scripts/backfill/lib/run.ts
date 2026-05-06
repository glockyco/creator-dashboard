import { writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import type { MetricPoint } from '../../../src/lib/types/domain';
import { metricInsertSql, transaction } from './sql';

export type BackfillArgs = { dryRun: boolean; executeRemote: boolean; out: string };

export function parseBackfillArgs(args: string[], defaultOut: string): BackfillArgs {
  const parsed: BackfillArgs = { dryRun: false, executeRemote: false, out: defaultOut };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') parsed.dryRun = true;
    else if (arg === '--execute-remote') parsed.executeRemote = true;
    else if (arg === '--out') {
      const value = args[index + 1];
      if (!value) throw new Error('--out requires a value');
      parsed.out = value;
      index += 1;
    } else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.dryRun && !parsed.executeRemote) throw new Error('pass --dry-run or --execute-remote');
  return parsed;
}

export async function writeMetricBackfill(rows: MetricPoint[], out: string, batchSize = 500): Promise<string> {
  const chunks: string[] = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    chunks.push(metricInsertSql(rows.slice(index, index + batchSize)));
  }
  const sql = transaction(chunks);
  await writeFile(out, sql);
  return sql;
}

export function executeRemote(file: string): void {
  const result = spawnSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'creator-dashboard', '--remote', '--file', file], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`wrangler d1 execute failed with status ${result.status ?? 'unknown'}`);
}
