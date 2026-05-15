import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from './schema';
import { createSettingsStore } from './store.svelte';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function rootElement() {
  const styles = new Map<string, string>();
  return {
    style: {
      setProperty: (name: string, value: string) => styles.set(name, value)
    },
    dataset: {} as Record<string, string>,
    styles
  };
}

describe('settings schema and store', () => {
  it('falls back to defaults for invalid stored settings', () => {
    expect(
      parseSettings({
        theme: 'neon',
        defaultDateRange: '1d',
        identityColors: { glockyco: 'blue', WoW_Much: '#f59e0b' }
      })
    ).toEqual(DEFAULT_SETTINGS);
  });

  it('persists valid settings and applies theme/color properties to the root element', () => {
    const storage = new MemoryStorage();
    const root = rootElement();
    const store = createSettingsStore({ storage, root: root as unknown as HTMLElement });

    store.set({ theme: 'light', defaultDateRange: '7d', identityColors: { glockyco: '#111111', WoW_Much: '#222222' } });

    expect(store.current).toEqual({
      theme: 'light',
      defaultDateRange: '7d',
      identityColors: { glockyco: '#111111', WoW_Much: '#222222' }
    });
    expect(JSON.parse(storage.getItem('creator-dashboard-settings') ?? '')).toEqual(store.current);
    expect(root.dataset.theme).toBe('light');
    expect(root.styles.get('--color-glockyco')).toBe('#111111');
    expect(root.styles.get('--color-wowmuch')).toBe('#222222');
  });
});
