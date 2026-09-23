import { z } from 'zod';

export const identities = ['glockyco', 'WoW_Much'] as const;
export type Identity = (typeof identities)[number];
export const Identity = z.enum(identities);
