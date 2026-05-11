import { spawn } from "node:child_process";
import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { once } from "node:events";
import { importJWK, SignJWT } from "jose";
import {
  assertPortsAvailable,
  buildWranglerDevArgs,
  createAccessFixture,
  defaultAudience,
  defaultIssuerDomain,
  previewSeedSql,
  resetAndSeedD1,
  startJwksServer,
  startWranglerDev,
  waitForHttp,
  type AccessFixture,
  type StartedServer,
} from "./local-preview/harness.ts";

export type PreviewLocalArgs = {
  workerPort: number;
  jwksPort: number;
  proxyPort: number;
  open: boolean;
  reset: boolean;
};

type AccessTokenSigner = () => Promise<string>;

const host = "127.0.0.1";
const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
]);
const decodedResponseHeaders = new Set(["content-encoding", "content-length"]);

export function parsePreviewLocalArgs(argv: string[]): PreviewLocalArgs {
  const parsed: PreviewLocalArgs = {
    workerPort: 8788,
    jwksPort: 8790,
    proxyPort: 8791,
    open: true,
    reset: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    else if (arg === "--no-open") parsed.open = false;
    else if (arg === "--no-reset") parsed.reset = false;
    else if (arg === "--worker-port") {
      parsed.workerPort = parsePortValue(arg, argv[index + 1]);
      index += 1;
    } else if (arg === "--jwks-port") {
      parsed.jwksPort = parsePortValue(arg, argv[index + 1]);
      index += 1;
    } else if (arg === "--proxy-port") {
      parsed.proxyPort = parsePortValue(arg, argv[index + 1]);
      index += 1;
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return parsed;
}

export function upstreamUrlFor(
  requestUrl: string | undefined,
  workerPort: number,
): URL {
  return new URL(requestUrl ?? "/", `http://${host}:${workerPort}`);
}

export function buildProxyHeaders(
  incomingHeaders: IncomingHttpHeaders,
  accessToken: string,
): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incomingHeaders)) {
    if (hopByHopHeaders.has(name.toLowerCase()) || value === undefined)
      continue;
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  headers.set("Cf-Access-Jwt-Assertion", accessToken);
  return headers;
}

export function stripHopByHopHeaders(
  headers: Iterable<[string, string]>,
): [string, string][] {
  return [...headers].filter(([name]) => {
    const lower = name.toLowerCase();
    return !hopByHopHeaders.has(lower) && !decodedResponseHeaders.has(lower);
  });
}

export async function startAuthenticatedProxy(options: {
  proxyPort: number;
  workerPort: number;
  signAccessToken: AccessTokenSigner;
}): Promise<StartedServer> {
  const server = createServer((request, response) => {
    void proxyRequest(request, response, options).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      response
        .writeHead(502, { "Content-Type": "text/plain" })
        .end(`local preview proxy failed: ${message}`);
    });
  });
  await new Promise<void>((resolve) =>
    server.listen(options.proxyPort, host, resolve),
  );
  return {
    server,
    stop: async () => {
      if (!server.listening) return;
      server.close();
      await once(server, "close");
    },
  };
}

export function createAccessTokenSigner(
  fixture: AccessFixture,
): AccessTokenSigner {
  const keyPromise = importJWK(fixture.privateJwk, "RS256");
  return async () =>
    new SignJWT({ email: "local-preview@example.invalid" })
      .setProtectedHeader({ alg: "RS256", kid: fixture.kid })
      .setIssuer(fixture.issuer)
      .setAudience(fixture.audience)
      .setExpirationTime(Math.floor(Date.now() / 1000) + 300)
      .sign(await keyPromise);
}

async function proxyRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: { workerPort: number; signAccessToken: AccessTokenSigner },
): Promise<void> {
  const method = request.method ?? "GET";
  const upstream = await fetch(
    upstreamUrlFor(request.url, options.workerPort),
    {
      method,
      headers: buildProxyHeaders(
        request.headers,
        await options.signAccessToken(),
      ),
      body: method === "GET" || method === "HEAD" ? undefined : request,
      duplex: method === "GET" || method === "HEAD" ? undefined : "half",
      redirect: "manual",
    } as RequestInit & { duplex?: "half" },
  );

  response.writeHead(
    upstream.status,
    upstream.statusText,
    stripHopByHopHeaders(upstream.headers.entries()),
  );
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

async function main(): Promise<void> {
  const args = parsePreviewLocalArgs(process.argv.slice(2));
  const authPath = ".tmp/preview-access.json";
  const persistPath = ".tmp/preview-wrangler";
  const seedPath = ".tmp/preview-seed.sql";
  const stops: (() => Promise<void> | void)[] = [];

  try {
    await assertPortsAvailable(
      [args.jwksPort, args.workerPort, args.proxyPort],
      host,
    );
    const access = await createAccessFixture({
      authPath,
      issuerDomain: defaultIssuerDomain,
      audience: defaultAudience,
    });
    await resetAndSeedD1({
      persistPath,
      seedPath,
      seedSql: previewSeedSql,
      reset: args.reset,
    });

    const jwks = await startJwksServer({
      host,
      port: args.jwksPort,
      jwks: access.jwks,
    });
    stops.push(jwks.stop);

    const wrangler = startWranglerDev(
      buildWranglerDevArgs({
        workerPort: args.workerPort,
        persistPath,
        issuerDomain: access.issuerDomain,
        audience: access.audience,
        jwksUrl: `http://${host}:${args.jwksPort}/jwks`,
        smokeEndpointsEnabled: true,
      }),
    );
    stops.push(wrangler.stop);
    await waitForHttp(`http://${host}:${args.workerPort}/`, 30_000);

    const proxy = await startAuthenticatedProxy({
      proxyPort: args.proxyPort,
      workerPort: args.workerPort,
      signAccessToken: createAccessTokenSigner(access),
    });
    stops.push(proxy.stop);
    const previewUrl = `http://${host}:${args.proxyPort}`;
    await waitForHttp(previewUrl, 30_000);

    console.log(`Local preview ready: ${previewUrl}`);
    console.log("Press Ctrl+C to stop local preview.");
    if (args.open) openBrowser(previewUrl);

    await new Promise<void>((resolve) => {
      const stop = () => resolve();
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
      wrangler.process.once("exit", stop);
    });
  } finally {
    for (const stop of stops.reverse()) await stop();
  }
}

function parsePortValue(flag: string, value: string | undefined): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535)
    throw new Error(`${flag} requires a numeric value`);
  return port;
}

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

if (process.argv[1]?.endsWith("preview-local.ts")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
