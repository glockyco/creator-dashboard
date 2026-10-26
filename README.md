# Creator Dashboard

Creator Dashboard brings Steam guide growth, mod downloads, Steam reviews and Erenshor Wiki edits into one private dashboard. It is a personal, single-tenant app configured for the glockyco projects, not a hosted service you can sign up for.

The [live dashboard](https://dashboard.glockyco.com) requires Cloudflare Access authorization.

## Run locally

Use the Node and pnpm environment in [flake.nix](flake.nix) through `nix develop`, or let direnv load [.envrc](.envrc). Install dependencies, copy the local configuration template and seed the local database before starting the app:

```sh
pnpm install
cp .dev.vars.example .dev.vars
pnpm dev:setup
pnpm dev
```

Open the local URL printed by Vite. The seeded data lets you explore without production credentials. Fill in [.dev.vars](.dev.vars.example) for authenticated connector checks or deployment verification, as described in [AGENTS.md](AGENTS.md).

Dependency updates must pass the release-age policy in [`pnpm-workspace.yaml`](pnpm-workspace.yaml). Keep Renovate's delay aligned in [`renovate.json`](renovate.json) so automated updates do not select releases that installation rejects.

Local development skips Access authentication. To exercise the Worker runtime and JWT verification, use `pnpm preview:local` and open the proxy URL it prints. That preview uses a separate local database and disables Discord delivery.

## Use the dashboard

- Open Overview to compare guide engagement, mod downloads and review counts. Choose a date range or open an asset for its history. Missing history is shown as unavailable, not zero growth.
- Open Activity to read Steam reviews and wiki edits. Filter by type, game or wiki, date range and review sentiment, then follow the native links for context.
- Open Issues to investigate collection failures, inspect attempts and request a retry. Recovered incidents remain available for investigation.

GitHub, Search Console and Cloudflare Analytics open their native sites. The dashboard does not collect their data.

## Collection and deployment

The SvelteKit app runs on Cloudflare Workers behind Cloudflare Access. Scheduled collection runs through a queue and stores metrics, events and incident history in D1. Failed collection and recovery can send notifications with investigation links to the configured Discord webhook. Collectors make requests to their upstream platforms.

The app is configured for one deployment. Before deploying a separate instance, configure its Cloudflare resources in [wrangler.toml](wrangler.toml), Access application and secrets. Adapt the collection targets in [the source registry](src/lib/sources/registry-data.ts) to your projects.

`pnpm run deploy` checks the working tree and secret names, runs checks and a build, applies remote D1 migrations, then deploys the Worker. This changes the remote database and live site. Follow the backup and deployment instructions in [AGENTS.md](AGENTS.md) before running it.

## Development

```sh
pnpm check
pnpm lint
pnpm test
```

[AGENTS.md](AGENTS.md) covers the development loop, Worker preview, end-to-end checks and deployment. [Connector rules](src/lib/connectors/README.md) explain how to add a collector. [OpenSpec specifications](openspec/specs) define the dashboard's behavior.
