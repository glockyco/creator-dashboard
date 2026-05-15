import { describe, expect, it, vi } from 'vitest';
import { parseDevVars, parseSmokeArgs, runSmokeSources, secretRequirements } from './smoke-connectors';

const publicSource = {
  id: 'steam-reviews-erenshor',
  name: 'Steam Reviews: Erenshor',
  identity: 'WoW_Much',
  category: 'event_feed',
  cadenceHours: 1,
  config: { appid: '2382520' },
  fetcher: vi.fn(async () => ({
    metric_points: [
      { source_id: 'steam-reviews-erenshor', metric: 'review_total', ts: 1_000, value: 3, dimensions: null }
    ],
    events: [
      {
        source_id: 'steam-reviews-erenshor',
        external_id: 'review-1',
        ts: 2_000,
        kind: 'review',
        author: null,
        title: 'Positive review',
        body: 'ok',
        url: null,
        metadata: null
      }
    ]
  }))
};

const secretSource = {
  id: 'github-glockyco',
  name: 'GitHub @glockyco',
  identity: 'glockyco',
  category: 'platform',
  cadenceHours: 1,
  config: {},
  fetcher: vi.fn(async () => ({ metric_points: [], events: [] }))
};

describe('smoke connector harness', () => {
  it('parses CLI source filters and output flags', () => {
    expect(parseSmokeArgs(['--public', '--source', 'steam-reviews-erenshor', '--json'])).toEqual({
      mode: 'public',
      sourceIds: ['steam-reviews-erenshor'],
      json: true,
      strict: false
    });
    expect(parseSmokeArgs(['--authenticated', '--strict'])).toMatchObject({ mode: 'authenticated', strict: true });
    expect(parseSmokeArgs(['--', '--source', 'steam-reviews-erenshor'])).toMatchObject({
      sourceIds: ['steam-reviews-erenshor']
    });
    expect(() => parseSmokeArgs(['--source'])).toThrow('--source requires a value');
  });

  it('parses .dev.vars without leaking comments or quotes into values', () => {
    expect(
      parseDevVars(
        'GITHUB_PAT=ghp_test\nCF_ANALYTICS_SITE_TAGS={"source":"tag"}\nQUOTED="value with spaces"\n# ignored\n'
      )
    ).toEqual({
      GITHUB_PAT: 'ghp_test',
      CF_ANALYTICS_SITE_TAGS: '{"source":"tag"}',
      QUOTED: 'value with spaces'
    });
  });

  it('knows which sources need credentials', () => {
    expect(secretRequirements('steam-reviews-erenshor')).toEqual([]);
    expect(secretRequirements('steam-guide-erenshor')).toEqual(['STEAM_WEB_API_KEY']);
    expect(secretRequirements('github-glockyco')).toEqual(['GITHUB_PAT']);
    expect(secretRequirements('gsc-glockyco-com')).toEqual([
      'GOOGLE_OAUTH_CLIENT_ID',
      'GOOGLE_OAUTH_CLIENT_SECRET',
      'GOOGLE_OAUTH_REFRESH_TOKEN'
    ]);
    expect(secretRequirements('bing-glockyco-com')).toEqual(['BING_WEBMASTER_API_KEY']);
    expect(secretRequirements('cf-analytics-glockyco-com')).toEqual([
      'CF_API_TOKEN',
      'CF_ACCOUNT_ID',
      'CF_ANALYTICS_SITE_TAGS'
    ]);
    expect(secretRequirements('ga4')).toEqual([
      'GOOGLE_OAUTH_CLIENT_ID',
      'GOOGLE_OAUTH_CLIENT_SECRET',
      'GOOGLE_OAUTH_REFRESH_TOKEN',
      'GA4_PROPERTY_ID'
    ]);
  });

  it('runs configured sources sequentially and skips missing secrets', async () => {
    const results = await runSmokeSources({
      sources: [secretSource, publicSource],
      env: {},
      args: { mode: 'all', sourceIds: [], json: false, strict: false },
      now: 1_777_852_800_000
    });

    expect(results.map((result) => [result.source_id, result.status])).toEqual([
      ['github-glockyco', 'skipped'],
      ['steam-reviews-erenshor', 'ok']
    ]);
    expect(publicSource.fetcher).toHaveBeenCalledOnce();
    expect(secretSource.fetcher).not.toHaveBeenCalled();
    expect(results[1]).toMatchObject({
      metric_points: 1,
      events: 1,
      sample_metrics: [{ metric: 'review_total', value: 3 }],
      sample_events: [{ kind: 'review', title: 'Positive review' }]
    });
  });
});
