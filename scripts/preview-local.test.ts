import { describe, expect, it } from "vitest";
import {
  buildProxyHeaders,
  parsePreviewLocalArgs,
  stripHopByHopHeaders,
  upstreamUrlFor,
} from "./preview-local";

describe("preview-local helpers", () => {
  it("defaults to the local worker, jwks, and proxy ports", () => {
    expect(parsePreviewLocalArgs([])).toEqual({
      workerPort: 8788,
      jwksPort: 8790,
      proxyPort: 8791,
      open: true,
      reset: true,
    });
  });

  it("parses explicit local preview flags", () => {
    expect(
      parsePreviewLocalArgs([
        "--no-open",
        "--no-reset",
        "--worker-port",
        "9001",
        "--jwks-port",
        "9002",
        "--proxy-port",
        "9003",
      ]),
    ).toEqual({
      workerPort: 9001,
      jwksPort: 9002,
      proxyPort: 9003,
      open: false,
      reset: false,
    });
    expect(() => parsePreviewLocalArgs(["--worker-port"])).toThrow(
      "--worker-port requires a numeric value",
    );
    expect(() => parsePreviewLocalArgs(["--unknown"])).toThrow(
      "unknown argument: --unknown",
    );
  });

  it("builds a loopback upstream url from the browser request path", () => {
    expect(upstreamUrlFor("/timeline?overlay=posts", 8788).href).toBe(
      "http://127.0.0.1:8788/timeline?overlay=posts",
    );
    expect(upstreamUrlFor(undefined, 8788).href).toBe("http://127.0.0.1:8788/");
  });

  it("injects the local Access assertion without forwarding hop-by-hop headers", () => {
    const headers = buildProxyHeaders(
      {
        host: "127.0.0.1:8791",
        connection: "keep-alive",
        accept: "text/html",
        "x-preview": ["one", "two"],
      },
      "signed-local-token",
    );

    expect(headers.get("accept")).toBe("text/html");
    expect(headers.get("x-preview")).toBe("one, two");
    expect(headers.get("cf-access-jwt-assertion")).toBe("signed-local-token");
    expect(headers.has("host")).toBe(false);
    expect(headers.has("connection")).toBe(false);
  });

  it("strips hop-by-hop response headers", () => {
    expect(
      stripHopByHopHeaders([
        ["content-type", "text/html"],
        ["transfer-encoding", "chunked"],
        ["connection", "close"],
      ]),
    ).toEqual([["content-type", "text/html"]]);
  });
});
