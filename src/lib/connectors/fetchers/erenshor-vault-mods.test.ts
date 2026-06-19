import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchError } from '../http';
import { fetchErenshorVaultMods } from './erenshor-vault-mods';

const source = {
  id: 'erenshor-vault-wowmuch',
  name: 'Erenshor Vault: WoW_Much Mods',
  identity: 'WoW_Much',
  category: 'platform',
  cadenceHours: 1,
  fetcher: fetchErenshorVaultMods,
  config: { mods: ['adventure-guide'] }
} as const;
const env = {} as Env;
const now = 1777852800000;

const vaultFixture = {
  mods: [
    {
      slug: 'adventure-guide',
      modRef: 'adventure-guide',
      name: 'Adventure Guide',
      downloadCount: 8,
      viewCount: 9
    },
    {
      slug: 'gearifier',
      modRef: 'gearifier',
      name: 'Gearifier',
      downloadCount: 10,
      viewCount: 7
    }
  ]
};

beforeEach(() => vi.unstubAllGlobals());

describe('fetchErenshorVaultMods', () => {
  it('fetches the passive mod list endpoint and emits totals plus per-mod views and downloads', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(vaultFixture), { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    const out = await fetchErenshorVaultMods({ source, env, now });

    expect(fetch).toHaveBeenCalledWith(new URL('https://erenshorvault.app/api/mods'), expect.any(Object));
    expect(out.metric_points).toEqual([
      { source_id: source.id, metric: 'total_downloads', ts: now, value: 8, dimensions: null },
      { source_id: source.id, metric: 'total_views', ts: now, value: 9, dimensions: null },
      { source_id: source.id, metric: 'mod_count', ts: now, value: 1, dimensions: null },
      {
        source_id: source.id,
        metric: 'mod_downloads',
        ts: now,
        value: 8,
        dimensions: { mod: 'Adventure Guide', slug: 'adventure-guide' }
      },
      {
        source_id: source.id,
        metric: 'mod_views',
        ts: now,
        value: 9,
        dimensions: { mod: 'Adventure Guide', slug: 'adventure-guide' }
      }
    ]);
    expect(out.events).toEqual([]);
  });

  it('matches configured mods by modRef when the slug differs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            mods: [
              {
                slug: 'adventure-guide-renamed',
                modRef: 'adventure-guide',
                name: 'Adventure Guide',
                downloadCount: 11,
                viewCount: 13
              }
            ]
          }),
          { status: 200 }
        )
      )
    );

    const out = await fetchErenshorVaultMods({ source, env, now });

    expect(out.metric_points.find((point) => point.metric === 'total_downloads')?.value).toBe(11);
    expect(out.metric_points.find((point) => point.metric === 'total_views')?.value).toBe(13);
    expect(out.metric_points.find((point) => point.metric === 'mod_views')?.dimensions).toEqual({
      mod: 'Adventure Guide',
      slug: 'adventure-guide-renamed'
    });
  });

  it('throws a clear error when a configured mod is missing from the Vault response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(vaultFixture), { status: 200 })));

    await expect(
      fetchErenshorVaultMods({
        source: { ...source, config: { mods: ['adventure-guide', 'missing-mod'] } },
        env,
        now
      })
    ).rejects.toThrow('Erenshor Vault did not return configured mod(s): missing-mod');
  });

  it('requires at least one configured mod slug', async () => {
    await expect(
      fetchErenshorVaultMods({ source: { ...source, config: { mods: [] } }, env, now })
    ).rejects.toBeInstanceOf(z.ZodError);
  });

  it('throws ZodError on schema drift', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ mods: [{}] }), { status: 200 })));

    await expect(fetchErenshorVaultMods({ source, env, now })).rejects.toBeInstanceOf(z.ZodError);
  });

  it('throws FetchError on auth errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })));

    await expect(fetchErenshorVaultMods({ source, env, now })).rejects.toBeInstanceOf(FetchError);
  });
});
