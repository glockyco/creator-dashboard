import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchError } from '../http';
import fixture from './github.fixture.json';
import { fetchGithub } from './github';

const source = {
  id: 'github-glockyco',
  name: 'GitHub @glockyco',
  identity: 'glockyco',
  category: 'platform',
  cadenceHours: 1,
  fetcher: fetchGithub,
  config: {}
} as const;
const env = { GITHUB_PAT: 'ghp_test' } as Env;
const now = 1777852800000;

beforeEach(() => vi.unstubAllGlobals());

describe('fetchGithub', () => {
  it('emits scalar, contribution, and repo star metrics without events', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 })));
    const out = await fetchGithub({ source, env, now });

    expect(out.metric_points.find((point) => point.metric === 'followers')?.value).toBe(23);
    expect(out.metric_points.find((point) => point.metric === 'total_stars')?.value).toBe(5);
    expect(out.metric_points.filter((point) => point.metric === 'contributions')).toHaveLength(4);
    expect(out.metric_points.find((point) => point.metric === 'repo_stars')?.dimensions).toEqual({
      repo: 'personal-website',
      archived: 'false'
    });
    expect(out.events).toEqual([]);
  });

  it('throws ZodError on schema drift', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { viewer: null } }), { status: 200 }))
    );
    await expect(fetchGithub({ source, env, now })).rejects.toBeInstanceOf(z.ZodError);
  });

  it('throws FetchError on auth errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad credentials', { status: 401 })));
    await expect(fetchGithub({ source, env, now })).rejects.toBeInstanceOf(FetchError);
  });
});
