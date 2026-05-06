import { z } from 'zod';

export const identities = ['glockyco', 'WoW_Much'] as const;
export type Identity = (typeof identities)[number];
export const Identity = z.enum(identities);

export const identityMeta: Record<Identity, { displayName: string; description: string; colorVar: string }> = {
  glockyco: {
    displayName: 'glockyco',
    description: 'Professional / academic identity',
    colorVar: 'var(--color-glockyco)'
  },
  WoW_Much: {
    displayName: 'WoW_Much',
    description: 'Gaming / mods identity',
    colorVar: 'var(--color-wowmuch)'
  }
};
