import { readFile } from 'node:fs/promises';

const D1_PLACEHOLDER = '<replace with wrangler d1 create creator-dashboard database_id>';

export function requiredProductionSecrets(): string[] {
  return [
    'ACCESS_TEAM_DOMAIN',
    'ACCESS_AUD',
    'DISCORD_ALERTS_WEBHOOK',
    'DISCORD_DIGEST_WEBHOOK',
    'GITHUB_PAT',
    'STEAM_WEB_API_KEY',
    'GOOGLE_OAUTH_CLIENT_ID',
    'GOOGLE_OAUTH_CLIENT_SECRET',
    'GOOGLE_OAUTH_REFRESH_TOKEN',
    'GSC_PROPERTIES',
    'BING_WEBMASTER_API_KEY',
    'BING_PROPERTIES',
    'CF_API_TOKEN',
    'GA4_PROPERTY_ID',
    'CF_ACCOUNT_ID',
    'CF_ANALYTICS_SITE_TAGS'
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

export function missingProductionSecrets(source: Record<string, string | undefined>): string[] {
  return requiredProductionSecrets().filter((name) => isMissingOrPlaceholder(source[name]));
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
  if (!text.includes('"0 4,5 * * *"')) errors.push('wrangler.toml is missing Vienna digest cron');
  return { errors };
}

async function readDevVarsIfPresent(path = '.dev.vars'): Promise<Record<string, string>> {
  try {
    return parseDevVars(await readFile(path, 'utf8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    throw error;
  }
}

function isMissingOrPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  return /(?:replace|example\.|\/example\/|<replace)/i.test(value);
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    return value.slice(1, -1);
  return value;
}

async function main(): Promise<void> {
  const wrangler = await readFile('wrangler.toml', 'utf8');
  const localVars = await readDevVarsIfPresent();
  const source = { ...localVars, ...process.env } as Record<string, string | undefined>;
  const errors = parseWranglerPreflight(wrangler).errors;
  const missingSecrets = missingProductionSecrets(source);
  for (const secret of missingSecrets) errors.push(`missing production env var ${secret}`);
  if (errors.length > 0) throw new Error(errors.join('\n'));
  console.log('deploy preflight passed');
}

if (process.argv[1]?.endsWith('deploy-preflight.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
