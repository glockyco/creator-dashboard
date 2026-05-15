import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const connectorKinds = [
  'github',
  'steam-guide',
  'steam-reviews',
  'thunderstore-team',
  'mediawiki-recent-changes',
  'gsc',
  'bing-webmaster',
  'ga4',
  'cf-analytics'
] as const;

export type ConnectorKind = (typeof connectorKinds)[number];

export type CaptureArgs = {
  connector: ConnectorKind;
  sourceId?: string;
};

type Writer = (path: string, content: string) => Promise<void>;

type CaptureSource = {
  id: string;
  connector?: ConnectorKind;
  fixturePath?: string;
  config?: Record<string, unknown>;
  fetcher?: (input: { source: CaptureSource; env: Env; now: number }) => Promise<unknown>;
  capture?: (input: { source: CaptureSource; env: Env; now: number }) => Promise<void>;
};

type CaptureFixtureOptions = {
  args: string[];
  sources?: CaptureSource[];
  env?: Env;
  now?: number;
  fetchImpl?: typeof fetch;
  writer?: Writer;
};

const connectorSet = new Set<string>(connectorKinds);

export const redactionPatterns = [
  /ghp_[A-Za-z0-9_]+/g,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  /\b7656119\d{10}\b/g,
  /Bearer\s+[A-Za-z0-9._-]+/g
];

export function parseCaptureArgs(args: string[]): CaptureArgs {
  const [connector, ...rest] = args;
  if (!connector || !connectorSet.has(connector)) throw new Error(`unsupported connector: ${connector ?? '<missing>'}`);

  let sourceId: string | undefined;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg !== '--source-id') throw new Error(`unsupported option: ${arg}`);
    const value = rest[index + 1];
    if (!value) throw new Error('--source-id requires a value');
    sourceId = value;
    index += 1;
  }

  return { connector: connector as ConnectorKind, sourceId };
}

export function redactFixtureText(input: string): string {
  return redactionPatterns.reduce((text, pattern) => text.replace(pattern, '[redacted]'), input);
}

export async function captureFixture(options: CaptureFixtureOptions): Promise<{ path: string; sourceId: string }> {
  const parsed = parseCaptureArgs(options.args);
  const sources = options.sources ?? defaultSources;
  const source = selectSource(sources, parsed);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const writer = options.writer ?? ((path, content) => writeFile(path, content));
  const originalFetch = globalThis.fetch;
  let capturedText: string | undefined;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetchImpl(input, init);
    capturedText = await response.clone().text();
    return response;
  }) as typeof fetch;

  try {
    if (source.capture)
      await source.capture({ source, env: options.env ?? (process.env as Env), now: options.now ?? Date.now() });
    else if (source.fetcher)
      await source.fetcher({ source, env: options.env ?? (process.env as Env), now: options.now ?? Date.now() });
    else throw new Error(`source has no capture function: ${source.id}`);
  } finally {
    globalThis.fetch = originalFetch;
  }

  if (capturedText === undefined) throw new Error(`no upstream response captured for ${source.id}`);
  const path = source.fixturePath ?? `src/lib/connectors/fetchers/${parsed.connector}.fixture.json`;
  await writer(path, formatFixture(redactFixtureText(capturedText)));
  return { path, sourceId: source.id };
}

function selectSource(sources: CaptureSource[], parsed: CaptureArgs): CaptureSource {
  const matches = sources.filter((source) => sourceConnector(source) === parsed.connector);
  if (parsed.sourceId) {
    const source = matches.find((candidate) => candidate.id === parsed.sourceId);
    if (!source) throw new Error(`source ${parsed.sourceId} is not registered for ${parsed.connector}`);
    return source;
  }
  if (matches.length === 0) throw new Error(`no source registered for ${parsed.connector}`);
  if (matches.length > 1) throw new Error(`${parsed.connector} has multiple sources; pass --source-id`);
  return matches[0];
}

function sourceConnector(source: CaptureSource): ConnectorKind | undefined {
  if (source.connector) return source.connector;
  if (source.id.startsWith('github-')) return 'github';
  if (source.id.startsWith('steam-guide-')) return 'steam-guide';
  if (source.id.startsWith('steam-reviews-')) return 'steam-reviews';
  if (source.id.startsWith('thunderstore-')) return 'thunderstore-team';
  if (source.id.includes('wiki-recent')) return 'mediawiki-recent-changes';
  if (source.id.startsWith('gsc-')) return 'gsc';
  if (source.id.startsWith('bing-')) return 'bing-webmaster';
  if (source.id.startsWith('ga4')) return 'ga4';
  if (source.id.startsWith('cf-analytics-')) return 'cf-analytics';
}

function formatFixture(text: string): string {
  try {
    return `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
  } catch {
    return text.endsWith('\n') ? text : `${text}\n`;
  }
}

function required(env: Env, key: keyof Env): string {
  const value = env[key];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`missing required env var ${String(key)}`);
  return value;
}

function source(
  id: string,
  connector: ConnectorKind,
  config: Record<string, unknown>,
  capture: CaptureSource['capture']
): CaptureSource {
  return { id, connector, config, capture };
}

const defaultSources: CaptureSource[] = [
  source('github-glockyco', 'github', {}, async ({ env }) => {
    await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${required(env, 'GITHUB_PAT')}`,
        'Content-Type': 'application/json',
        'User-Agent': 'creator-dashboard-fixture-capture'
      },
      body: JSON.stringify({
        query:
          'query($login:String!){ user(login:$login){ followers{totalCount} repositories(first:100,ownerAffiliations:OWNER){ totalCount nodes{name stargazerCount isArchived} } contributionsCollection{ contributionCalendar{ weeks{ contributionDays{ date contributionCount } } } } } }',
        variables: { login: 'glockyco' }
      })
    });
  }),
  source('steam-guide-erenshor', 'steam-guide', { publishedfileid: '3500398991' }, captureSteamGuide),
  source('steam-guide-ak', 'steam-guide', { publishedfileid: '3616580411' }, captureSteamGuide),
  source('steam-reviews-erenshor', 'steam-reviews', { appid: '2382520' }, captureSteamReviews),
  source('steam-reviews-ak', 'steam-reviews', { appid: '2241380' }, captureSteamReviews),
  source('thunderstore-wowmuch', 'thunderstore-team', { namespace: 'WoW_Much', community: 'erenshor' }, async () => {
    await fetch('https://thunderstore.io/c/erenshor/api/v1/package/');
  }),
  source('erenshor-wiki-recent', 'mediawiki-recent-changes', { wiki: 'erenshor.wiki.gg' }, async ({ source }) => {
    await fetch(
      `https://${String(source.config?.wiki)}/api.php?action=query&list=recentchanges&rcprop=ids|title|timestamp|user|comment|sizes|flags&format=json`
    );
  })
];

async function captureSteamGuide({ source, env }: { source: CaptureSource; env: Env }): Promise<void> {
  const body = new URLSearchParams({
    key: required(env, 'STEAM_WEB_API_KEY'),
    itemcount: '1',
    'publishedfileids[0]': String(source.config?.publishedfileid)
  });
  await fetch('https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/', { method: 'POST', body });
}

async function captureSteamReviews({ source }: { source: CaptureSource }): Promise<void> {
  await fetch(
    `https://store.steampowered.com/appreviews/${String(source.config?.appid)}?json=1&filter=recent&language=all&purchase_type=all`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  captureFixture({ args: process.argv.slice(2) })
    .then(({ path, sourceId }) => console.log(`captured ${sourceId} fixture to ${path}`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
