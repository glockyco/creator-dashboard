import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const D1_PLACEHOLDER = '<replace with wrangler d1 create creator-dashboard database_id>';

export function requiredProductionSecrets(): string[] {
  return ['ACCESS_TEAM_DOMAIN', 'ACCESS_AUD', 'DISCORD_ALERTS_WEBHOOK', 'STEAM_WEB_API_KEY'];
}

/** Compares the Worker's secret names with what the code reads: a missing one breaks it, an extra one is an unused credential. */
export function deployedSecretErrors(names: string[]): string[] {
  const required = new Set(requiredProductionSecrets());
  const deployed = new Set(names);
  return [
    ...[...required].filter((name) => !deployed.has(name)).map((name) => `production Worker is missing secret ${name}`),
    ...[...deployed]
      .filter((name) => !required.has(name))
      .map((name) => `production Worker holds unused secret ${name}; delete it and revoke the credential`)
  ];
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

export function parseWranglerPreflight(text: string): { errors: string[] } {
  const errors: string[] = [];
  if (text.includes(D1_PLACEHOLDER)) errors.push('wrangler.toml still contains the placeholder D1 database_id');
  if (!text.includes('binding       = "DB"') && !text.includes('binding = "DB"'))
    errors.push('wrangler.toml is missing DB D1 binding');
  if (!text.includes('binding = "FETCHER_QUEUE"'))
    errors.push('wrangler.toml is missing FETCHER_QUEUE producer binding');
  if (
    !text.includes('queue   = "creator-dashboard-fetchers"') &&
    !text.includes('queue = "creator-dashboard-fetchers"')
  )
    errors.push('wrangler.toml is missing creator-dashboard-fetchers queue');
  if (
    !text.includes('dead_letter_queue  = "creator-dashboard-fetcher-dlq"') &&
    !text.includes('dead_letter_queue = "creator-dashboard-fetcher-dlq"')
  )
    errors.push('wrangler.toml is missing creator-dashboard-fetcher-dlq dead-letter binding');
  if (!text.includes('"0 * * * *"')) errors.push('wrangler.toml is missing hourly fetch cron');
  return { errors };
}

function deployedSecretNames(): string[] {
  const output = execFileSync('wrangler', ['secret', 'list', '--format', 'json'], { encoding: 'utf8' });
  const parsed = JSON.parse(output.slice(output.indexOf('['))) as { name: string }[];
  return parsed.map((secret) => secret.name);
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    return value.slice(1, -1);
  return value;
}

async function main(): Promise<void> {
  const errors = parseWranglerPreflight(await readFile('wrangler.toml', 'utf8')).errors;
  // Deploy ships the working tree, so uncommitted edits would reach production without review.
  if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '')
    errors.push('working tree has uncommitted changes');
  errors.push(...deployedSecretErrors(deployedSecretNames()));
  if (errors.length > 0) throw new Error(errors.join('\n'));
  console.log('deploy preflight passed');
}

if (process.argv[1]?.endsWith('deploy-preflight.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
