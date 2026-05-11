import {
  assertPortsAvailable,
  buildWranglerDevArgs,
  createAccessFixture,
  defaultAudience,
  defaultIssuerDomain,
  e2eSeedSql,
  resetAndSeedD1,
  startJwksServer,
  startWranglerDev,
} from "./local-preview/harness.ts";

const jwksPort = 8790;
const workerPort = 8788;
const host = "127.0.0.1";
const authPath = ".tmp/e2e-access.json";
const persistPath = ".tmp/e2e-wrangler";
const seedPath = ".tmp/e2e-seed.sql";

await assertPortsAvailable([jwksPort, workerPort]);
const access = await createAccessFixture({
  authPath,
  issuerDomain: defaultIssuerDomain,
  audience: defaultAudience,
});
await resetAndSeedD1({
  persistPath,
  seedPath,
  seedSql: e2eSeedSql,
  reset: true,
});
const jwksServer = await startJwksServer({
  host,
  port: jwksPort,
  jwks: access.jwks,
});
const wrangler = startWranglerDev(
  buildWranglerDevArgs({
    workerPort,
    persistPath,
    issuerDomain: access.issuerDomain,
    audience: access.audience,
    jwksUrl: `http://${host}:${jwksPort}/jwks`,
    smokeEndpointsEnabled: true,
  }),
);

function stop(): void {
  wrangler.stop();
  void jwksServer.stop();
}

process.on("SIGTERM", stop);
process.on("SIGINT", stop);
wrangler.process.on("exit", (code) => {
  void jwksServer.stop();
  process.exitCode = code ?? 1;
});
