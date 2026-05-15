import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchError } from '../http';
import fixture from './thunderstore-team.fixture.json';
import { fetchThunderstoreTeam } from './thunderstore-team';

const source = {
  id: 'thunderstore-wowmuch',
  name: 'Thunderstore: WoW_Much',
  identity: 'WoW_Much',
  category: 'platform',
  cadenceHours: 1,
  fetcher: fetchThunderstoreTeam,
  config: { namespace: 'WoW_Much' }
} as const;
const env = {} as Env;
const now = 1777852800000;

beforeEach(() => vi.unstubAllGlobals());

describe('fetchThunderstoreTeam', () => {
  it('emits total downloads, package count, and per-package downloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 })));
    const out = await fetchThunderstoreTeam({ source, env, now });

    expect(out.metric_points.find((point) => point.metric === 'total_downloads')?.value).toBe(1500);
    expect(out.metric_points.find((point) => point.metric === 'package_count')?.value).toBe(2);
    expect(out.metric_points.filter((point) => point.metric === 'package_downloads')).toHaveLength(2);
    expect(out.metric_points.find((point) => point.metric === 'package_downloads')?.dimensions).toEqual({
      package: 'MapPins'
    });
    expect(out.events).toEqual([]);
  });

  it('accepts live paginated Thunderstore responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            next: null,
            previous: null,
            results: [{ namespace: 'WoW_Much', name: 'LivePackage', download_count: 9 }]
          }),
          { status: 200 }
        )
      )
    );

    const out = await fetchThunderstoreTeam({ source, env, now });

    expect(out.metric_points.find((point) => point.metric === 'total_downloads')?.value).toBe(9);
  });

  it('uses the configured Thunderstore community endpoint', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ owner: 'WoW_Much', name: 'Sprint', versions: [{ downloads: 291 }] }]), {
        status: 200
      })
    );
    vi.stubGlobal('fetch', fetch);

    const out = await fetchThunderstoreTeam({
      source: { ...source, config: { namespace: 'WoW_Much', community: 'erenshor' } },
      env,
      now
    });

    expect(fetch).toHaveBeenCalledWith(
      new URL('https://thunderstore.io/c/erenshor/api/v1/package/'),
      expect.any(Object)
    );
    expect(out.metric_points.find((point) => point.metric === 'total_downloads')?.value).toBe(291);
  });

  it('throws ZodError on schema drift', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([{ namespace: 'WoW_Much' }]), { status: 200 }))
    );
    await expect(fetchThunderstoreTeam({ source, env, now })).rejects.toBeInstanceOf(z.ZodError);
  });

  it('throws FetchError on auth errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })));
    await expect(fetchThunderstoreTeam({ source, env, now })).rejects.toBeInstanceOf(FetchError);
  });
});
