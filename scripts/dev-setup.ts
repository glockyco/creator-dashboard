import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { previewSeedSql } from "./local-preview/harness.ts";

const seedPath = ".tmp/dev-seed.sql";

async function main(): Promise<void> {
  await mkdir(".tmp", { recursive: true });
  await writeFile(seedPath, previewSeedSql);

  // `wrangler dev`, `wrangler d1 migrations apply --local`, and the
  // adapter-cloudflare `getPlatformProxy()` call that powers `pnpm dev`
  // all default to the same `.wrangler/state/v3` location, so applying
  // migrations + seed here also primes the database the dev server
  // reads from. Same fixtures `pnpm preview:local` uses, kept in
  // `local-preview/harness.ts` to avoid drift.
  runWrangler(["d1", "migrations", "apply", "creator-dashboard", "--local"]);
  runWrangler(["d1", "execute", "creator-dashboard", "--local", `--file=${seedPath}`]);

  console.log("\nLocal D1 migrated and seeded. Run `pnpm dev` for the HMR dev server.");
}

function runWrangler(args: string[]): void {
  const options: SpawnSyncOptions = { stdio: "inherit" };
  const result = spawnSync("pnpm", ["exec", "wrangler", ...args], options);
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.argv[1]?.endsWith("dev-setup.ts")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
