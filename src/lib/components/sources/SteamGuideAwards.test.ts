import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SteamGuideAwards from './SteamGuideAwards.svelte';
import type { SteamGuideAward } from '$lib/types/domain';

const awards: SteamGuideAward[] = [
  {
    source_id: 'steam-guide-erenshor',
    reaction_id: 17,
    count: 5,
    icon_url: 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still/17.png?v=5',
    captured_at: 1777852800000
  },
  {
    source_id: 'steam-guide-erenshor',
    reaction_id: 27,
    count: 2,
    icon_url: 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still/27.png?v=5',
    captured_at: 1777852800000
  }
];

describe('SteamGuideAwards', () => {
  it('renders Steam award icons and counts', () => {
    const { body } = render(SteamGuideAwards, { props: { awards } });

    expect(body).toContain('Steam awards');
    expect(body).toContain('2 types');
    expect(body).toContain('Steam award 17');
    expect(body).toContain('still/17.png?v=5');
    expect(body).toContain('>5<');
  });

  it('renders an empty state when no awards are captured', () => {
    const { body } = render(SteamGuideAwards, { props: { awards: [] } });

    expect(body).toContain('No Steam awards captured yet.');
  });
});
