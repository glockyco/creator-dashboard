import { z } from 'zod';

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const SettingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']),
  defaultDateRange: z.enum(['7d', '30d', '90d']),
  identityColors: z.object({
    glockyco: HexColor,
    WoW_Much: HexColor
  })
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  defaultDateRange: '30d',
  identityColors: { glockyco: '#6366f1', WoW_Much: '#f59e0b' }
};

export function parseSettings(value: unknown): Settings {
  const parsed = SettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}
