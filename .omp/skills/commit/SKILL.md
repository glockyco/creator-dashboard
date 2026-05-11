---
name: commit
description: Guidelines for creating conventional commits in this repository
---

## Format

Use Conventional Commits:

```text
type(scope): description
```

The scope is optional when the change is genuinely repo-wide, but prefer a
specific scope when it improves scanability.

## Types

- `feat`: User-visible feature or new dashboard capability
- `fix`: Bug fix
- `refactor`: Code change that is neither a feature nor a fix
- `perf`: Performance improvement
- `docs`: Documentation-only change
- `style`: Formatting-only change, not visual CSS/UI work
- `test`: Test or test-harness change
- `chore`: Tooling, config, infrastructure, or maintenance

## Suggested scopes

Use the smallest accurate area of the Creator Dashboard:

- `ui`: shell, navigation, dashboard surfaces, styling, mobile layout
- `auth`: Cloudflare Access/JWT verification
- `connectors`: source fetchers and HTTP/Zod connector boundaries
- `orchestration`: cron, queues, dispatch, retries, alerts, DLQ
- `dashboard`: dashboard query models and summaries
- `posts`: post metadata, sync, post routes
- `timeline`: timeline correlation view
- `digest`: daily digest generation and delivery
- `deploy`: preflight, Wrangler, D1 migrations, deploy scripts
- `dev`: local preview, smoke helpers, e2e harness, developer tooling
- `commit`: commit-message guidance

If none fit, use a clear short scope such as `health`, `settings`, or
`sources`. Avoid scopes from other repositories such as `mods`, `map`, or
`build-pipeline`.

## Message structure

- Subject: imperative mood, max 80 characters
- Blank line between subject and body
- Body: prose, wrapped around 72 characters
- Body explains why the change exists and what tradeoff it addresses
- Do not paste command output, test summaries, screenshots, logs, or
  verification notes into commit messages

The code explains the implementation. The commit body should explain the
reasoning a future maintainer cannot infer from the diff alone.

## Example

```text
feat(dev): add authenticated local preview command

A normal browser cannot inspect the local Worker because every route
expects a Cloudflare Access assertion. Requiring ad hoc Playwright
snippets made manual UI review more difficult than the deploy path.

Add a local preview command that starts the Worker harness and exposes a
loopback proxy with a generated Access JWT. The Worker still verifies the
token against local JWKS, so preview stays close to production auth.
```

## Atomic commits

- One logical change per commit
- Keep related code, tests, and docs in the same commit
- Do not mix unrelated cleanup with behavior changes
- Do not commit generated scratch artifacts from `.tmp/`, `.wrangler/`,
  `.svelte-kit/`, or `test-results/`

## Before committing

Run validation appropriate to the touched area, but keep the results out
of the commit message.

Common commands:

- Targeted unit tests: `pnpm test <path>`
- Svelte/type validation: `pnpm check`
- Build validation: `pnpm build`
- Mobile/local UI smoke: `pnpm test:e2e e2e/mobile.spec.ts`
- Manual local preview: `pnpm preview:local`

Use `pnpm run deploy` for manual deploys. Do not write `pnpm deploy`.

## Important

- Never push without explicit user request
- Prefer repo-local Git config over global changes for this project
- If unsure about the scope or commit boundary, ask before committing
