import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { exportJWK, generateKeyPair } from 'jose';

const issuerDomain = 'team.cloudflareaccess.com';
const issuer = `https://${issuerDomain}`;
const audience = 'creator-dashboard-e2e';
const jwksPort = 8790;
const workerPort = 8788;
const authPath = '.tmp/e2e-access.json';
const persistPath = '.tmp/e2e-wrangler';
const seedPath = '.tmp/e2e-seed.sql';

const pair = await generateKeyPair('RS256', { extractable: true });
const publicJwk = await exportJWK(pair.publicKey);
const privateJwk = await exportJWK(pair.privateKey);
const jwks = { keys: [{ ...publicJwk, kid: 'e2e-key', alg: 'RS256', use: 'sig' }] };

const seedSql = `DELETE FROM posts_sources;
DELETE FROM posts_index;
DELETE FROM events;
DELETE FROM metric_points;
INSERT OR IGNORE INTO metric_points (source_id, metric, ts, value, dimensions) VALUES ('github-glockyco', 'followers', 1775088000000, 10, NULL);
INSERT OR IGNORE INTO metric_points (source_id, metric, ts, value, dimensions) VALUES ('github-glockyco', 'followers', 1775952000000, 14, NULL);
INSERT OR IGNORE INTO metric_points (source_id, metric, ts, value, dimensions) VALUES ('steam-reviews-erenshor', 'review_total', 1776124800000, 7, NULL);
INSERT OR IGNORE INTO events (source_id, external_id, ts, kind, author, title, body, url, metadata) VALUES ('steam-reviews-erenshor', 'review-1', 1776211200000, 'review', 'player', 'Great update', 'Loved it', 'https://example.test/review', '{\"rating\":\"positive\"}');
INSERT INTO posts_index (slug, posted_at, author, platform, url, title, tags, body_excerpt, body_hash) VALUES ('release-notes', 1775952000000, 'glockyco', 'site', 'https://example.test/post', 'Release notes', '[\"release\"]', 'Shipped timeline seed.', 'e2e-seed');
INSERT INTO posts_sources (slug, source_id) VALUES ('release-notes', 'github-glockyco');
`;

await rm(persistPath, { force: true, recursive: true });
await mkdir('.tmp', { recursive: true });
await writeFile(authPath, JSON.stringify({ privateJwk, issuer, audience, kid: 'e2e-key' }, null, 2));
await writeFile(seedPath, seedSql);
runChecked(['exec', 'wrangler', 'd1', 'migrations', 'apply', 'creator-dashboard', '--local', '--persist-to', persistPath]);
runChecked(['exec', 'wrangler', 'd1', 'execute', 'creator-dashboard', '--local', '--persist-to', persistPath, '--file', seedPath]);

const jwksServer = createServer((request, response) => {
  if (request.url !== '/jwks') {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(jwks));
});
await new Promise<void>((resolve) => jwksServer.listen(jwksPort, '127.0.0.1', resolve));

const wrangler = spawn(
  'pnpm',
  [
    'exec',
    'wrangler',
    'dev',
    '--port',
    String(workerPort),
    '--persist-to',
    persistPath,
    '--show-interactive-dev-session',
    'false',
    '--log-level',
    'error',
    '--var',
    `ACCESS_TEAM_DOMAIN:${issuerDomain}`,
    '--var',
    `ACCESS_AUD:${audience}`,
    '--var',
    `ACCESS_JWKS_URL:http://127.0.0.1:${jwksPort}/jwks`,
    '--var',
    'SMOKE_ENDPOINTS_ENABLED:true',
  ],
  { stdio: 'inherit' }
);

function runChecked(args: string[]): void {
  const result = spawnSync('pnpm', args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`pnpm ${args.join(' ')} failed with status ${result.status ?? 'unknown'}`);
}

function stop(signal: NodeJS.Signals): void {
  wrangler.kill(signal);
  jwksServer.close();
}

process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
wrangler.on('exit', (code) => {
  jwksServer.close();
  process.exitCode = code ?? 1;
});
