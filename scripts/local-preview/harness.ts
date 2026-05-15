import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { exportJWK, generateKeyPair, type JWK } from 'jose';

export type AccessFixture = {
  issuerDomain: string;
  issuer: string;
  audience: string;
  kid: string;
  jwks: { keys: JWK[] };
  privateJwk: JWK;
};

export type WranglerDevOptions = {
  workerPort: number;
  persistPath: string;
  issuerDomain: string;
  audience: string;
  jwksUrl: string;
  smokeEndpointsEnabled: boolean;
};

export type StartedServer = {
  server: Server;
  stop: () => Promise<void>;
};

export type StartedProcess = {
  process: ChildProcess;
  stop: () => void;
};

export const defaultIssuerDomain = 'team.cloudflareaccess.com';
export const defaultAudience = 'creator-dashboard-e2e';
export const defaultKid = 'e2e-key';

export const e2eSeedSql = `DELETE FROM posts_sources;
DELETE FROM posts_index;
DELETE FROM events;
DELETE FROM metric_points;
INSERT OR IGNORE INTO metric_points (source_id, metric, ts, value, dimensions) VALUES ('github-glockyco', 'followers', 1775088000000, 10, NULL);
INSERT OR IGNORE INTO metric_points (source_id, metric, ts, value, dimensions) VALUES ('github-glockyco', 'followers', 1775952000000, 14, NULL);
INSERT OR IGNORE INTO metric_points (source_id, metric, ts, value, dimensions) VALUES ('steam-reviews-erenshor', 'review_total', 1776124800000, 7, NULL);
INSERT OR IGNORE INTO events (source_id, external_id, ts, kind, author, title, body, url, metadata) VALUES ('steam-reviews-erenshor', 'review-1', 1776211200000, 'review', 'player', 'Great update', 'Loved it', 'https://example.test/review', '{"rating":"positive"}');
INSERT INTO posts_index (slug, posted_at, author, platform, url, title, tags, body_excerpt, body_hash) VALUES ('release-notes', 1775952000000, 'glockyco', 'site', 'https://example.test/post', 'Release notes', '["release"]', 'Shipped timeline seed.', 'e2e-seed');
INSERT INTO posts_sources (slug, source_id) VALUES ('release-notes', 'github-glockyco');
`;

export const previewSeedSql = `${e2eSeedSql}
DELETE FROM fetcher_failures;
DELETE FROM alerts_sent;
DELETE FROM fetcher_runs;
INSERT OR REPLACE INTO fetcher_runs (source_id, last_run_at, last_success_at, last_status, last_error, consecutive_failures) VALUES ('github-glockyco', 1778500800000, 1778500800000, 'success', NULL, 0);
INSERT OR REPLACE INTO fetcher_runs (source_id, last_run_at, last_success_at, last_status, last_error, consecutive_failures) VALUES ('erenshor-wiki-recent', 1778497200000, NULL, 'permanent_failure', 'Preview seed: MediaWiki rejected the request before a descriptive user agent was sent.', 3);
INSERT INTO fetcher_failures (source_id, ts, tier, status_code, error_message) VALUES ('erenshor-wiki-recent', 1778497200000, 'permanent', 403, 'Preview seed: upstream rejected the local request.');
INSERT INTO alerts_sent (alert_key, sent_at) VALUES ('preview:erenshor-wiki-recent:permanent', 1778497200000);
INSERT OR IGNORE INTO metric_points (source_id, metric, ts, value, dimensions) VALUES ('github-glockyco', 'followers', 1776816000000, 11, NULL);
INSERT OR IGNORE INTO metric_points (source_id, metric, ts, value, dimensions) VALUES ('github-glockyco', 'followers', 1777680000000, 13, NULL);
INSERT OR IGNORE INTO metric_points (source_id, metric, ts, value, dimensions) VALUES ('github-glockyco', 'total_stars', 1778500800000, 42, NULL);
INSERT OR IGNORE INTO metric_points (source_id, metric, ts, value, dimensions) VALUES ('github-glockyco', 'public_repos', 1778500800000, 18, NULL);
INSERT OR IGNORE INTO metric_points (source_id, metric, ts, value, dimensions) VALUES ('erenshor-wiki-recent', 'wiki_change_count', 1778400000000, 5, NULL);
INSERT OR IGNORE INTO events (source_id, external_id, ts, kind, author, title, body, url, metadata) VALUES ('erenshor-wiki-recent', 'preview-wiki-1', 1778400000000, 'wiki_edit', 'Preview editor', 'Updated Erenshor map route', 'Preview local edit event.', NULL, '{}');
`;

export function buildWranglerDevArgs(options: WranglerDevOptions): string[] {
  return [
    'exec',
    'wrangler',
    'dev',
    '--port',
    String(options.workerPort),
    '--persist-to',
    options.persistPath,
    '--show-interactive-dev-session',
    'false',
    '--log-level',
    'error',
    '--var',
    `ACCESS_TEAM_DOMAIN:${options.issuerDomain}`,
    '--var',
    `ACCESS_AUD:${options.audience}`,
    '--var',
    `ACCESS_JWKS_URL:${options.jwksUrl}`,
    '--var',
    `SMOKE_ENDPOINTS_ENABLED:${String(options.smokeEndpointsEnabled)}`
  ];
}

export async function createAccessFixture(options: {
  authPath: string;
  issuerDomain?: string;
  audience?: string;
  kid?: string;
}): Promise<AccessFixture> {
  const issuerDomain = options.issuerDomain ?? defaultIssuerDomain;
  const audience = options.audience ?? defaultAudience;
  const kid = options.kid ?? defaultKid;
  const issuer = `https://${issuerDomain}`;
  const pair = await generateKeyPair('RS256', { extractable: true });
  const publicJwk = await exportJWK(pair.publicKey);
  const privateJwk = await exportJWK(pair.privateKey);
  const jwks = { keys: [{ ...publicJwk, kid, alg: 'RS256', use: 'sig' }] };
  await mkdir('.tmp', { recursive: true });
  await writeFile(options.authPath, JSON.stringify({ privateJwk, issuer, audience, kid }, null, 2));
  return { issuerDomain, issuer, audience, kid, jwks, privateJwk };
}

export async function resetAndSeedD1(options: {
  persistPath: string;
  seedPath: string;
  seedSql: string;
  reset: boolean;
}): Promise<void> {
  if (options.reset) await rm(options.persistPath, { force: true, recursive: true });
  await mkdir('.tmp', { recursive: true });
  await writeFile(options.seedPath, options.seedSql);
  runChecked([
    'exec',
    'wrangler',
    'd1',
    'migrations',
    'apply',
    'creator-dashboard',
    '--local',
    '--persist-to',
    options.persistPath
  ]);
  runChecked([
    'exec',
    'wrangler',
    'd1',
    'execute',
    'creator-dashboard',
    '--local',
    '--persist-to',
    options.persistPath,
    '--file',
    options.seedPath
  ]);
}

export async function startJwksServer(options: {
  host: string;
  port: number;
  jwks: { keys: JWK[] };
}): Promise<StartedServer> {
  const server = createServer((request, response) => {
    if (request.url !== '/jwks') {
      response.writeHead(404).end('not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(options.jwks));
  });
  await new Promise<void>((resolve) => server.listen(options.port, options.host, resolve));
  return { server, stop: () => closeServer(server) };
}

export function startWranglerDev(args: string[]): StartedProcess {
  const child = spawn('pnpm', args, { stdio: 'inherit' });
  return { process: child, stop: () => child.kill('SIGTERM') };
}

export async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

export async function assertPortsAvailable(ports: number[], host = '127.0.0.1'): Promise<void> {
  for (const port of ports) {
    const server = createServer();
    server.on('error', () => undefined);
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, resolve);
      });
    } catch {
      throw new Error(`port ${port} is already in use; stop the existing process or choose another port`);
    } finally {
      if (server.listening) await closeServer(server);
    }
  }
}

function runChecked(args: string[]): void {
  const result = spawnSync('pnpm', args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`pnpm ${args.join(' ')} failed with status ${result.status ?? 'unknown'}`);
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, 'close');
}
