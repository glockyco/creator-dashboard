import { describe, expect, it, vi } from 'vitest';
import type { SourceDef } from '../src/lib/sources/registry';
import { captureFixture, connectorKinds, parseCaptureArgs, redactFixtureText } from './capture-fixture';

const output = { metric_points: [], events: [] };

describe('capture-fixture utility', () => {
  it('parses the supported connector enum and optional source id', () => {
    expect(connectorKinds).toEqual([
      'github',
      'steam-guide',
      'steam-reviews',
      'thunderstore-team',
      'mediawiki-recent-changes',
      'gsc',
      'bing-webmaster',
      'ga4',
      'cf-analytics'
    ]);
    expect(parseCaptureArgs(['steam-guide', '--source-id', 'steam-guide-erenshor'])).toEqual({ connector: 'steam-guide', sourceId: 'steam-guide-erenshor' });
    expect(() => parseCaptureArgs(['steam-guide', '--source-id'])).toThrow('requires a value');
    expect(() => parseCaptureArgs(['unknown'])).toThrow('unsupported connector');
  });

  it('redacts tokens, emails, steam ids, and bearer credentials', () => {
    const input = 'ghp_abcDEF_123 johann@example.com 76561191234567890 Bearer abc.def-ghi';
    const redacted = redactFixtureText(input);

    expect(redacted).toBe('[redacted] [redacted] [redacted] [redacted]');
  });

  it('captures through an injected writer without touching the filesystem', async () => {
    const fetcher = vi.fn(async () => {
      await fetch('https://example.test/upstream');
      return output;
    });
    const source = {
      id: 'steam-guide-erenshor',
      identity: 'WoW_Much',
      name: 'Steam Guide: Erenshor Maps',
      category: 'platform',
      cadenceHours: 1,
      fetcher,
      config: { publishedfileid: '3500398991' }
    } as SourceDef;
    const fetchImpl = vi.fn< typeof fetch >().mockResolvedValue(
      new Response(JSON.stringify({ token: 'ghp_secret_123', email: 'johann@example.com' }), { status: 200 })
    );
    const writer = vi.fn<(path: string, content: string) => Promise<void>>().mockResolvedValue(undefined);

    await captureFixture({
      args: ['steam-guide', '--source-id', 'steam-guide-erenshor'],
      sources: [source],
      env: {} as Env,
      now: 1777852800000,
      fetchImpl,
      writer
    });

    expect(fetcher).toHaveBeenCalledWith({ source, env: {}, now: 1777852800000 });
    expect(writer).toHaveBeenCalledOnce();
    const [path, content] = writer.mock.calls[0];
    expect(path).toBe('src/lib/connectors/fetchers/steam-guide.fixture.json');
    expect(content).not.toContain('ghp_secret_123');
    expect(content).not.toContain('johann@example.com');
    expect(JSON.parse(content)).toEqual({ token: '[redacted]', email: '[redacted]' });
  });
});
