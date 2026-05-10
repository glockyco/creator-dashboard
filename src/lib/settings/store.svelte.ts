import { DEFAULT_SETTINGS, parseSettings, type Settings } from './schema';

export const SETTINGS_STORAGE_KEY = 'creator-dashboard-settings';

export type SettingsStore = DashboardSettingsStore;

class DashboardSettingsStore {
  current = $state<Settings>(DEFAULT_SETTINGS);

  constructor(
    private readonly storage?: Storage,
    private readonly root?: HTMLElement
  ) {
    const stored = storage?.getItem(SETTINGS_STORAGE_KEY);
    this.current = stored ? parseStoredSettings(stored) : DEFAULT_SETTINGS;
    this.apply(this.current);
  }

  set(settings: Settings) {
    this.current = parseSettings(settings);
    this.storage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.current));
    this.apply(this.current);
  }

  private apply(settings: Settings) {
    if (!this.root) return;
    this.root.dataset.theme = settings.theme;
    this.root.style.setProperty('--color-glockyco', settings.identityColors.glockyco);
    this.root.style.setProperty('--color-wowmuch', settings.identityColors.WoW_Much);
  }
}

export function createSettingsStore(options: { storage?: Storage; root?: HTMLElement } = {}) {
  return new DashboardSettingsStore(options.storage, options.root);
}

function parseStoredSettings(value: string): Settings {
  try {
    return parseSettings(JSON.parse(value));
  } catch {
    return DEFAULT_SETTINGS;
  }
}
