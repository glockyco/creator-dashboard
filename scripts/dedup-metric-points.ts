import { spawnSync } from 'node:child_process';

export type DedupTarget = 'remote' | 'local';
export type DedupArgs = { target: DedupTarget; batchSize: number };
export type Executor = (sql: string) => number;

export function parseDedupArgs(argv: string[]): DedupArgs {
  let target: DedupTarget | null = null;
  let batchSize = 2000;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') continue;
    else if (arg === '--remote') target = 'remote';
    else if (arg === '--local') target = 'local';
    else if (arg === '--batch-size') {
      const value = argv[index + 1];
      if (!value) throw new Error('--batch-size requires a value');
      batchSize = Number(value);
      index += 1;
    } else throw new Error(`unknown or incomplete argument: ${arg}`);
  }
  if (!target) throw new Error('pass --remote or --local');
  if (!Number.isInteger(batchSize) || batchSize <= 0) throw new Error('--batch-size must be a positive integer');
  return { target, batchSize };
}

// Delete every row that is NOT the most-recently-inserted (MAX(rowid)) row for its logical key
// (source_id, metric, ts, dimensions with NULL == ''), capped at batchSize rows per call. D1
// cannot delete hundreds of thousands of rows in one statement, so callers loop this.
export function dedupBatchSql(batchSize: number): string {
  return (
    'DELETE FROM metric_points WHERE rowid IN (' +
    'SELECT rowid FROM metric_points m WHERE rowid <> (' +
    'SELECT MAX(rowid) FROM metric_points m2 ' +
    'WHERE m2.source_id = m.source_id AND m2.metric = m.metric AND m2.ts = m.ts ' +
    "AND COALESCE(m2.dimensions, '') = COALESCE(m.dimensions, '')" +
    `) LIMIT ${batchSize})`
  );
}

export function runDedup(executor: Executor, batchSize: number, log: (message: string) => void = console.log): number {
  const sql = dedupBatchSql(batchSize);
  let total = 0;
  let changed = executor(sql);
  while (changed > 0) {
    total += changed;
    log(`deleted ${changed} duplicate rows (running total ${total})`);
    changed = executor(sql);
  }
  return total;
}

function changesFromOutput(stdout: string): number {
  const parsed: unknown = JSON.parse(stdout);
  if (!Array.isArray(parsed) || parsed.length === 0) return 0;
  const first: unknown = parsed[0];
  if (!first || typeof first !== 'object' || !('meta' in first)) return 0;
  const meta: unknown = (first as { meta: unknown }).meta;
  if (!meta || typeof meta !== 'object' || !('changes' in meta)) return 0;
  const changes: unknown = (meta as { changes: unknown }).changes;
  return typeof changes === 'number' ? changes : 0;
}

function wranglerExecutor(target: DedupTarget): Executor {
  const flag = target === 'remote' ? '--remote' : '--local';
  return (sql) => {
    const result = spawnSync(
      'pnpm',
      ['exec', 'wrangler', 'd1', 'execute', 'creator-dashboard', flag, '--json', '--command', sql],
      { encoding: 'utf8' }
    );
    if (result.status !== 0) {
      throw new Error(`wrangler d1 execute failed: ${result.stderr || result.stdout || 'unknown error'}`);
    }
    return changesFromOutput(result.stdout);
  };
}

async function main(): Promise<void> {
  const args = parseDedupArgs(process.argv.slice(2));
  const total = runDedup(wranglerExecutor(args.target), args.batchSize);
  console.log(`dedup complete: removed ${total} duplicate metric_points rows from the ${args.target} database`);
}

if (process.argv[1]?.endsWith('dedup-metric-points.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
