import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchError } from '../http';
import fixture from './mediawiki-recent-changes.fixture.json';
import { fetchMediaWikiRecentChanges } from './mediawiki-recent-changes';

const source = { id: 'erenshor-wiki-recent', name: 'Erenshor Wiki: Recent Changes', identity: 'WoW_Much', category: 'event_feed', cadenceHours: 1, fetcher: fetchMediaWikiRecentChanges, config: { wiki: 'erenshor.wiki.gg' } } as const;
const env = {} as Env;
const now = 1777852800000;

beforeEach(() => vi.unstubAllGlobals());

describe('fetchMediaWikiRecentChanges', () => {
  it('emits wiki_edit events', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 })));
    const out = await fetchMediaWikiRecentChanges({ source, env, now });

    expect(out.metric_points).toEqual([]);
    expect(out.events).toHaveLength(1);
    expect(out.events[0]).toMatchObject({ source_id: 'erenshor-wiki-recent', external_id: '9001', kind: 'wiki_edit', author: 'WoW Much', title: 'Erenshor Maps', body: 'Updated route details' });
    expect(out.events[0].metadata).toMatchObject({ type: 'edit', revid: 1002, old_revid: 1001, namespace: 0, minor: false, bot: false, size_delta: 125 });
  });

  it('throws ZodError on schema drift', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ query: { recentchanges: [null] } }), { status: 200 })));
    await expect(fetchMediaWikiRecentChanges({ source, env, now })).rejects.toBeInstanceOf(z.ZodError);
  });

  it('throws FetchError on auth errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })));
    await expect(fetchMediaWikiRecentChanges({ source, env, now })).rejects.toBeInstanceOf(FetchError);
  });
});
