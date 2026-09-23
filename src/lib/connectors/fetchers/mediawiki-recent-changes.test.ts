import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchError } from '../http';
import fixture from './mediawiki-recent-changes.fixture.json';
import { fetchMediaWikiRecentChanges } from './mediawiki-recent-changes';

const source = {
  id: 'erenshor-wiki-recent',
  name: 'Erenshor Wiki: Recent Changes',
  identity: 'WoW_Much',
  category: 'event_feed',
  cadenceHours: 1,
  fetcher: fetchMediaWikiRecentChanges,
  config: { wiki: 'erenshor.wiki.gg' }
} as const;
const env = {} as Env;
const now = 1777852800000;

beforeEach(() => vi.unstubAllGlobals());

describe('fetchMediaWikiRecentChanges', () => {
  it('emits wiki_edit events', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 })));
    const out = await fetchMediaWikiRecentChanges({ source, env, now });

    expect(out.metric_points).toEqual([]);
    expect(out.events).toHaveLength(1);
    expect(out.events[0]).toMatchObject({
      source_id: 'erenshor-wiki-recent',
      external_id: '9001',
      kind: 'wiki_edit',
      author: 'WoW Much',
      title: 'Erenshor Maps',
      body: 'Updated route details',
      url: 'https://erenshor.wiki.gg/wiki/Special:Diff/1001/1002'
    });
    expect(out.events[0].metadata).toMatchObject({
      native_link_kind: 'diff',
      type: 'edit',
      revid: 1002,
      old_revid: 1001,
      namespace: 0,
      minor: false,
      bot: false,
      size_delta: 125
    });
  });

  it('links to the page when a change has no revision pair', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            query: {
              recentchanges: [
                {
                  type: 'new',
                  ns: 0,
                  title: 'New Page',
                  revid: 1003,
                  rcid: 9002,
                  user: 'Editor',
                  timestamp: '2026-05-04T13:00:00Z'
                }
              ]
            }
          }),
          { status: 200 }
        )
      )
    );

    const out = await fetchMediaWikiRecentChanges({ source, env, now });

    expect(out.events[0]).toMatchObject({
      url: 'https://erenshor.wiki.gg/wiki/New_Page',
      metadata: { native_link_kind: 'page', old_revid: null, revid: 1003 }
    });
  });

  it('identifies itself with a contact-URL User-Agent so Cloudflare-fronted wikis like wiki.gg do not 403', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    await fetchMediaWikiRecentChanges({ source, env, now });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = new Headers(init?.headers ?? {});
    expect(headers.get('user-agent')).toMatch(/creator-dashboard\/[0-9]+\.[0-9]+ \(\+https?:\/\/[^)]+\)/);
  });

  it('accepts live MediaWiki flag fields represented as empty strings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            query: {
              recentchanges: [
                {
                  type: 'edit',
                  ns: 14,
                  title: 'Category:Charms',
                  revid: 40025,
                  old_revid: 32376,
                  rcid: 44709,
                  user: 'Dagarxji',
                  minor: '',
                  oldlen: 352,
                  newlen: 352,
                  timestamp: '2026-05-07T03:54:26Z',
                  comment: 'fixed the link'
                }
              ]
            }
          }),
          { status: 200 }
        )
      )
    );

    const out = await fetchMediaWikiRecentChanges({ source, env, now });

    expect(out.events[0].metadata?.minor).toBe(true);
    expect(out.events[0].metadata?.bot).toBe(false);
  });

  it('throws ZodError on schema drift', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ query: { recentchanges: [null] } }), { status: 200 }))
    );
    await expect(fetchMediaWikiRecentChanges({ source, env, now })).rejects.toBeInstanceOf(z.ZodError);
  });

  it('throws FetchError on auth errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })));
    await expect(fetchMediaWikiRecentChanges({ source, env, now })).rejects.toBeInstanceOf(FetchError);
  });
});
