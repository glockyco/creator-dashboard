import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { exportJWK, generateKeyPair } from 'jose';

const issuerDomain = 'team.cloudflareaccess.com';
const issuer = `https://${issuerDomain}`;
const audience = 'creator-dashboard-e2e';
const jwksPort = 8790;
const workerPort = 8788;
const authPath = '.tmp/e2e-access.json';

const pair = await generateKeyPair('RS256', { extractable: true });
const publicJwk = await exportJWK(pair.publicKey);
const privateJwk = await exportJWK(pair.privateKey);
const jwks = { keys: [{ ...publicJwk, kid: 'e2e-key', alg: 'RS256', use: 'sig' }] };

await mkdir('.tmp', { recursive: true });
await writeFile(authPath, JSON.stringify({ privateJwk, issuer, audience, kid: 'e2e-key' }, null, 2));

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
    '.tmp/e2e-wrangler',
    '--show-interactive-dev-session',
    'false',
    '--log-level',
    'error',
    '--var',
    `ACCESS_TEAM_DOMAIN:${issuerDomain}`,
    '--var',
    `ACCESS_AUD:${audience}`,
    '--var',
    `ACCESS_JWKS_URL:http://127.0.0.1:${jwksPort}/jwks`
  ],
  { stdio: 'inherit' }
);

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
