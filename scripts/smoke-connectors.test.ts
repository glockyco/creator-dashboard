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
  id: 'steam-guide-erenshor',
  name: 'Steam Guide: Erenshor Maps',
  identity: 'WoW_Much',
  category: 'platform',
  cadenceHours: 1,
  config: { publishedfileid: '3500398991' },
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
    expect(parseDevVars('STEAM_WEB_API_KEY=steam-key\nQUOTED="value with spaces"\n# ignored\n')).toEqual({
      STEAM_WEB_API_KEY: 'steam-key',
      QUOTED: 'value with spaces'
    });
  });

  it('knows which sources need credentials', () => {
    expect(secretRequirements('steam-reviews-erenshor')).toEqual([]);
    expect(secretRequirements('steam-guide-erenshor')).toEqual(['STEAM_WEB_API_KEY']);
  });

  it('runs configured sources sequentially and skips missing secrets', async () => {
    const results = await runSmokeSources({
      sources: [secretSource, publicSource],
      env: {},
      args: { mode: 'all', sourceIds: [], json: false, strict: false },
      now: 1_777_852_800_000
    });

    expect(results.map((result) => [result.source_id, result.status])).toEqual([
      ['steam-guide-erenshor', 'skipped'],
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
