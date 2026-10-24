import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// Runs one collector with config overrides, such as a longer wiki lookback, and writes its events as
// INSERT OR IGNORE statements. Apply the file with `wrangler d1 execute creator-dashboard --remote --file`.
// Existing events are left untouched, and no metrics or run state are written.

export type BackfillArgs = { sourceId: string; overrides: Record<string, unknown>; output: string };

type BackfillEvent = {
  source_id: string;
  external_id: string;
  ts: number;
  kind: string;
  author: string | null;
  title: string | null;
  body: string | null;
  url: string | null;
  metadata: Record<string, unknown> | null;
};
type BackfillSource = {
  id: string;
  config: Record<string, unknown>;
  fetcher: (input: { source: BackfillSource; env: Env; now: number }) => Promise<{ events: BackfillEvent[] }>;
};

export function parseBackfillArgs(argv: string[]): BackfillArgs {
  const args: BackfillArgs = { sourceId: '', overrides: {}, output: '.tmp/backfill-events.sql' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === '--') continue;
    if (value === undefined) throw new Error(`${arg} requires a value`);
    if (arg === '--source') args.sourceId = value;
    else if (arg === '--output') args.output = value;
    else if (arg === '--set') {
      const separator = value.indexOf('=');
      if (separator < 1) throw new Error('--set expects key=json');
      args.overrides[value.slice(0, separator)] = JSON.parse(value.slice(separator + 1));
    } else throw new Error(`unknown argument: ${arg}`);
    index += 1;
  }
  if (!args.sourceId) throw new Error('--source is required');
  return args;
}

export function sqlLiteral(value: string | number | null): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${value.replaceAll("'", "''")}'`;
}

export function insertStatement(event: BackfillEvent): string {
  const values = [
    event.source_id,
    event.external_id,
    event.ts,
    event.kind,
    event.author,
    event.title,
    event.body,
    event.url,
    event.metadata ? JSON.stringify(event.metadata) : null
  ].map(sqlLiteral);
  return `INSERT OR IGNORE INTO events (source_id, external_id, ts, kind, author, title, body, url, metadata) VALUES (${values.join(', ')});`;
}

async function main(): Promise<void> {
  const args = parseBackfillArgs(process.argv.slice(2));
  const server = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
  let sources: BackfillSource[];
  try {
    // Vite resolves the app's $lib aliases; ssrLoadModule returns an untyped module record.
    const registry = (await server.ssrLoadModule('/src/lib/sources/registry.ts')) as { sources: BackfillSource[] };
    sources = registry.sources;
  } finally {
    await server.close();
  }
  const source = sources.find((candidate) => candidate.id === args.sourceId);
  if (!source) throw new Error(`unknown source: ${args.sourceId}`);

  const configured = { ...source, config: { ...source.config, ...args.overrides } };
  const { events } = await source.fetcher({ source: configured, env: process.env as unknown as Env, now: Date.now() });
  await writeFile(args.output, `${events.map(insertStatement).join('\n')}\n`);
  console.log(`wrote ${events.length} events for ${source.id} to ${args.output}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
