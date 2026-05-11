import { describe, expect, it } from "vitest";
import { buildWranglerDevArgs, e2eSeedSql } from "./harness";

describe("local preview harness helpers", () => {
  it("builds wrangler dev args with local Access verification vars", () => {
    expect(
      buildWranglerDevArgs({
        workerPort: 8788,
        persistPath: ".tmp/e2e-wrangler",
        issuerDomain: "team.cloudflareaccess.com",
        audience: "creator-dashboard-e2e",
        jwksUrl: "http://127.0.0.1:8790/jwks",
        smokeEndpointsEnabled: true,
      }),
    ).toEqual([
      "exec",
      "wrangler",
      "dev",
      "--port",
      "8788",
      "--persist-to",
      ".tmp/e2e-wrangler",
      "--show-interactive-dev-session",
      "false",
      "--log-level",
      "error",
      "--var",
      "ACCESS_TEAM_DOMAIN:team.cloudflareaccess.com",
      "--var",
      "ACCESS_AUD:creator-dashboard-e2e",
      "--var",
      "ACCESS_JWKS_URL:http://127.0.0.1:8790/jwks",
      "--var",
      "SMOKE_ENDPOINTS_ENABLED:true",
    ]);
  });

  it("keeps the e2e seed deterministic and limited to local rows", () => {
    expect(e2eSeedSql).toContain("DELETE FROM posts_sources;");
    expect(e2eSeedSql).toContain(
      "INSERT INTO posts_index (slug, posted_at, author, platform, url, title, tags, body_excerpt, body_hash) VALUES ('release-notes'",
    );
    expect(e2eSeedSql).not.toContain("DISCORD");
  });
});
