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

const seedNow = Date.now();
const dayMs = 86_400_000;
const hourMs = 3_600_000;
const boundaryDays = [180, 90, 60, 30, 14, 7, 1, 0];
const performanceSeries = [
  { sourceId: 'steam-guide-erenshor', metric: 'views', dimensions: null, start: 2_000, step: 80 },
  { sourceId: 'steam-guide-ak', metric: 'views', dimensions: null, start: 1_600, step: 60 },
  { sourceId: 'steam-guide-fractured-realms', metric: 'views', dimensions: null, start: 900, step: 45 },
  { sourceId: 'steam-guide-afallon', metric: 'views', dimensions: null, start: 700, step: 50 },
  {
    sourceId: 'thunderstore-wowmuch',
    metric: 'package_downloads',
    dimensions: { package: 'AdventureGuide' },
    start: 1_200,
    step: 90
  },
  {
    sourceId: 'thunderstore-wowmuch',
    metric: 'package_downloads',
    dimensions: { package: 'InteractiveMapCompanion' },
    start: 800,
    step: 70
  },
  {
    sourceId: 'thunderstore-wowmuch',
    metric: 'package_downloads',
    dimensions: { package: 'Sprint' },
    start: 600,
    step: 55
  },
  {
    sourceId: 'thunderstore-wowmuch',
    metric: 'package_downloads',
    dimensions: { package: 'JusticeForF7' },
    start: 400,
    step: 40
  },
  {
    sourceId: 'erenshor-vault-wowmuch',
    metric: 'mod_downloads',
    dimensions: { mod: 'Adventure Guide', slug: 'adventure-guide' },
    start: 500,
    step: 35
  },
  {
    sourceId: 'erenshor-vault-wowmuch',
    metric: 'mod_downloads',
    dimensions: { mod: 'Interactive Map Companion', slug: 'interactive-map-companion' },
    start: 350,
    step: 30
  },
  {
    sourceId: 'erenshor-vault-wowmuch',
    metric: 'mod_downloads',
    dimensions: { mod: 'Sprint', slug: 'sprint' },
    start: 300,
    step: 25
  },
  {
    sourceId: 'erenshor-vault-wowmuch',
    metric: 'mod_downloads',
    dimensions: { mod: 'Justice for F7', slug: 'justice-for-f7' },
    start: 200,
    step: 20
  },
  { sourceId: 'steam-reviews-erenshor', metric: 'review_positive', dimensions: null, start: 1_200, step: 17 },
  { sourceId: 'steam-reviews-erenshor', metric: 'review_negative', dimensions: null, start: 190, step: 4 },
  { sourceId: 'steam-reviews-ak', metric: 'review_positive', dimensions: null, start: 840, step: 11 },
  { sourceId: 'steam-reviews-ak', metric: 'review_negative', dimensions: null, start: 125, step: 3 },
  { sourceId: 'steam-reviews-afallon', metric: 'review_positive', dimensions: null, start: 560, step: 9 },
  { sourceId: 'steam-reviews-afallon', metric: 'review_negative', dimensions: null, start: 85, step: 2 }
];
// Each series has distinct sample growth; these local-only captures are not production data.
const growthProfiles = [
  [1, 2, 2, 1, 3, 2, 1],
  [2, 1, 3, 2, 1, 1, 3],
  [1, 3, 1, 3, 2, 1, 2],
  [2, 2, 1, 1, 2, 3, 1],
  [1, 2, 3, 2, 2, 2, 1],
  [3, 1, 2, 1, 3, 1, 2],
  [1, 1, 3, 2, 1, 3, 2],
  [2, 3, 1, 1, 1, 2, 3],
  [3, 2, 1, 2, 1, 1, 2],
  [1, 3, 2, 1, 2, 3, 1],
  [2, 1, 1, 3, 2, 2, 2],
  [1, 2, 1, 2, 3, 1, 3],
  [2, 1, 3, 1, 2, 4, 2],
  [1, 2, 1, 2, 3, 1, 2],
  [2, 2, 1, 3, 1, 2, 1],
  [1, 3, 2, 1, 2, 1, 3],
  [3, 1, 2, 2, 1, 3, 1],
  [2, 1, 3, 1, 2, 2, 1]
];
const performanceSeedSql = performanceSeries
  .flatMap((series, seriesIndex) => {
    let value = series.start;
    return boundaryDays.map((daysAgo, index) => {
      if (index > 0) value += series.step * growthProfiles[seriesIndex][index - 1];
      const dimensions =
        series.dimensions === null ? 'NULL' : `'${JSON.stringify(series.dimensions)!.replaceAll("'", "''")}'`;
      return `INSERT INTO metric_points (source_id, metric, ts, value, dimensions) VALUES ('${series.sourceId}', '${series.metric}', ${seedNow - daysAgo * dayMs}, ${value}, ${dimensions});`;
    });
  })
  .join('\n');
const guideSignalSeedSql = performanceSeries
  .slice(0, 4)
  .flatMap((series, index) =>
    (
      [
        ['favorite_count', 52 + index * 17, 4 + index],
        ['rating', 0.92 - index * 0.07, index === 3 ? -0.004 : 0.004],
        ['ratings', 38 + index * 13, 4],
        ['award_count', 12 + index * 5, 1]
      ] as const
    ).flatMap(([metric, latest, step]) =>
      boundaryDays.map((daysAgo, sampleIndex) => {
        const value = latest - (boundaryDays.length - 1 - sampleIndex) * step;
        return `INSERT INTO metric_points (source_id, metric, ts, value, dimensions) VALUES ('${series.sourceId}', '${metric}', ${seedNow - daysAgo * dayMs}, ${value}, NULL);`;
      })
    )
  )
  .join('\n');
const retainedSourceIds = [
  'steam-guide-erenshor',
  'steam-guide-ak',
  'steam-guide-fractured-realms',
  'steam-guide-afallon',
  'steam-reviews-erenshor',
  'steam-reviews-ak',
  'steam-reviews-afallon',
  'thunderstore-wowmuch',
  'erenshor-vault-wowmuch',
  'erenshor-wiki-recent'
];
const runSeedSql = retainedSourceIds
  .map((sourceId) =>
    sourceId === 'erenshor-wiki-recent'
      ? `INSERT INTO fetcher_runs VALUES ('${sourceId}', ${seedNow - hourMs}, ${seedNow - 2 * dayMs}, 'permanent_failure', 'Preview seed: wiki request rejected.', 2);`
      : `INSERT INTO fetcher_runs VALUES ('${sourceId}', ${seedNow - hourMs}, ${seedNow - hourMs}, 'success', NULL, 0);`
  )
  .join('\n');

export const e2eSeedSql = `DELETE FROM fetcher_failures;
DELETE FROM collection_incidents;
DELETE FROM fetcher_runs;
DELETE FROM events;
DELETE FROM metric_points;
${performanceSeedSql}
${guideSignalSeedSql}
INSERT INTO metric_points (source_id, metric, ts, value, dimensions) VALUES ('erenshor-wiki-recent', 'wiki_change_count', ${seedNow - hourMs}, 12, NULL);
INSERT INTO events (source_id, external_id, ts, kind, author, title, body, url, metadata) VALUES ('steam-reviews-erenshor', 'review-positive', ${seedNow - 2 * hourMs}, 'review', NULL, 'Positive review', 'The latest update works well.', 'https://steamcommunity.com/app/2382520/reviews/?browsefilter=mostrecent', '{"native_link_kind":"review_list","voted_up":true,"playtime_at_review":600}');
INSERT INTO events (source_id, external_id, ts, kind, author, title, body, url, metadata) VALUES ('steam-reviews-afallon', 'review-negative', ${seedNow - 3 * hourMs}, 'review', NULL, 'Negative review', 'The current build needs more polish.', 'https://steamcommunity.com/app/2597810/reviews/?browsefilter=mostrecent', '{"native_link_kind":"review_list","voted_up":false,"playtime_at_review":180}');
INSERT INTO events (source_id, external_id, ts, kind, author, title, body, url, metadata) VALUES ('erenshor-wiki-recent', 'wiki-edit-1', ${seedNow - hourMs}, 'wiki_edit', 'Preview editor', 'Erenshor map route', 'Updated a route description.', 'https://erenshor.wiki.gg/wiki/Special:Diff/100/101', '{"native_link_kind":"diff","old_revid":100,"revid":101,"size_delta":42}');
${runSeedSql}
INSERT INTO collection_incidents (id, source_id, first_failure_at, last_failure_at, latest_tier, latest_status_code, latest_error, attempt_count, last_success_at, failure_notification_state, failure_notified_at) VALUES (1001, 'erenshor-wiki-recent', ${seedNow - 2 * hourMs}, ${seedNow - hourMs}, 'permanent', 403, 'Preview seed: upstream rejected the wiki request.', 2, ${seedNow - 2 * dayMs}, 'sent', ${seedNow - hourMs});
INSERT INTO fetcher_failures (source_id, ts, tier, status_code, error_message, incident_id, retry_scheduled_at) VALUES ('erenshor-wiki-recent', ${seedNow - 2 * hourMs}, 'transient', 503, 'Preview seed: upstream unavailable.', 1001, ${seedNow - hourMs});
INSERT INTO fetcher_failures (source_id, ts, tier, status_code, error_message, incident_id, retry_scheduled_at) VALUES ('erenshor-wiki-recent', ${seedNow - hourMs}, 'permanent', 403, 'Preview seed: upstream rejected the wiki request.', 1001, NULL);
INSERT INTO collection_incidents (id, source_id, first_failure_at, last_failure_at, latest_tier, latest_error, attempt_count, last_success_at, resolved_at, failure_notification_state, failure_notified_at, recovery_notification_state, recovery_notified_at) VALUES (1002, 'steam-reviews-ak', ${seedNow - 3 * dayMs}, ${seedNow - 2 * dayMs}, 'transient', 'Preview seed: temporary review outage.', 1, ${seedNow - 4 * dayMs}, ${seedNow - dayMs}, 'sent', ${seedNow - 2 * dayMs}, 'sent', ${seedNow - dayMs});
INSERT INTO fetcher_failures (source_id, ts, tier, status_code, error_message, incident_id, retry_scheduled_at) VALUES ('steam-reviews-ak', ${seedNow - 2 * dayMs}, 'transient', 503, 'Preview seed: temporary review outage.', 1002, ${seedNow - 2 * dayMs + 300_000});
`;

export const previewSeedSql = e2eSeedSql;

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
