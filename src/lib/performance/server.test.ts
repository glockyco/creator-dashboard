import { describe, expect, it, vi } from 'vitest';
import { loadPerformance, loadPerformanceAsset } from '$lib/server/performance';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 21 * DAY_MS;

const rows = [
  { selector_id: 'asset:steam-guide-afallon', ts: 7 * DAY_MS, value: 100 },
  { selector_id: 'asset:steam-guide-afallon', ts: 14 * DAY_MS, value: 120 },
  { selector_id: 'asset:steam-guide-afallon', ts: 20 * DAY_MS, value: 145 },
  { selector_id: 'asset:steam-guide-afallon', ts: NOW, value: 150 },
  { selector_id: 'asset:steam-guide-afallon:favorites', ts: NOW, value: 44 },
  { selector_id: 'asset:steam-guide-afallon:rating', ts: NOW, value: 0.82 },
  { selector_id: 'asset:steam-guide-afallon:ratings', ts: NOW, value: 12 },
  { selector_id: 'asset:steam-guide-afallon:awards', ts: NOW, value: 7 },
  { selector_id: 'asset:thunderstore-adventure-guide', ts: 7 * DAY_MS, value: 1_000 },
  { selector_id: 'asset:thunderstore-adventure-guide', ts: 14 * DAY_MS, value: 1_100 },
  { selector_id: 'asset:thunderstore-adventure-guide', ts: 20 * DAY_MS, value: 1_190 },
  { selector_id: 'asset:thunderstore-adventure-guide', ts: NOW, value: 1_200 },
  { selector_id: 'asset:vault-adventure-guide', ts: 7 * DAY_MS, value: 100 },
  { selector_id: 'asset:vault-adventure-guide', ts: 14 * DAY_MS, value: 110 },
  { selector_id: 'asset:vault-adventure-guide', ts: 20 * DAY_MS, value: 128 },
  { selector_id: 'asset:vault-adventure-guide', ts: NOW, value: 130 },
  { selector_id: 'review:steam-reviews-erenshor:positive', ts: 7 * DAY_MS, value: 100 },
  { selector_id: 'review:steam-reviews-erenshor:positive', ts: 14 * DAY_MS, value: 120 },
  { selector_id: 'review:steam-reviews-erenshor:positive', ts: 20 * DAY_MS, value: 145 },
  { selector_id: 'review:steam-reviews-erenshor:positive', ts: NOW, value: 150 },
  { selector_id: 'review:steam-reviews-erenshor:negative', ts: 7 * DAY_MS, value: 30 },
  { selector_id: 'review:steam-reviews-erenshor:negative', ts: 14 * DAY_MS, value: 35 },
  { selector_id: 'review:steam-reviews-erenshor:negative', ts: 20 * DAY_MS, value: 39 },
  { selector_id: 'review:steam-reviews-erenshor:negative', ts: NOW, value: 40 },
  { selector_id: 'review:steam-reviews-ak:positive', ts: 7 * DAY_MS, value: 10 },
  { selector_id: 'review:steam-reviews-ak:positive', ts: 13 * DAY_MS, value: 12 },
  { selector_id: 'review:steam-reviews-ak:positive', ts: NOW, value: 20 },
  { selector_id: 'review:steam-reviews-afallon:positive', ts: 7 * DAY_MS, value: 50 },
  { selector_id: 'review:steam-reviews-afallon:positive', ts: 14 * DAY_MS, value: 60 },
  { selector_id: 'review:steam-reviews-afallon:positive', ts: 20 * DAY_MS, value: 70 },
  { selector_id: 'review:steam-reviews-afallon:negative', ts: 7 * DAY_MS, value: 10 },
  { selector_id: 'review:steam-reviews-afallon:negative', ts: 14 * DAY_MS, value: 20 },
  { selector_id: 'review:steam-reviews-afallon:negative', ts: 16 * DAY_MS, value: 25 },
  { selector_id: 'review:steam-reviews-afallon:negative', ts: 17 * DAY_MS, value: 2 },
  { selector_id: 'review:steam-reviews-afallon:negative', ts: 20 * DAY_MS, value: 4 },
  { selector_id: 'review:steam-reviews-afallon:negative', ts: NOW, value: 5 }
];

function performanceDb(resultRows = rows) {
  const bind = vi.fn((...bindings: unknown[]) => {
    if (bindings.length > 100) throw new Error('D1: too many SQL variables');
    const selected = new Set(
      bindings.filter(
        (value): value is string =>
          typeof value === 'string' && (value.startsWith('asset:') || value.startsWith('review:'))
      )
    );
    return { all: async () => ({ results: resultRows.filter((row) => selected.has(row.selector_id)) }) };
  });
  const prepare = vi.fn(() => ({ bind }));
  return { db: { prepare } as unknown as D1Database, prepare, bind };
}

describe('loadPerformance', () => {
  it('returns guide snapshots, platform mod series, and review sentiment series', async () => {
    const { db } = performanceDb();

    const result = await loadPerformance(db, '7d', NOW);

    expect(result.guides).toHaveLength(4);
    expect(result.mods).toHaveLength(8);
    expect(result.guides.find((asset) => asset.id === 'steam-guide-afallon')).toMatchObject({
      name: 'Afallon Compendium - Interactive Map',
      platform: 'Steam',
      total: 150,
      dayGain: 5,
      periodGain: 30,
      previousGain: 20,
      comparisonPct: 50,
      favorites: 44,
      rating: 0.82,
      ratings: 12,
      awards: 7
    });
    expect(result.mods.find((asset) => asset.id === 'thunderstore-adventure-guide')).toMatchObject({
      platform: 'Thunderstore',
      total: 1_200,
      periodGain: 100,
      favorites: null,
      rating: null,
      ratings: null,
      awards: null
    });
    expect(result.mods.find((asset) => asset.id === 'vault-adventure-guide')).toMatchObject({
      platform: 'Erenshor Vault',
      total: 130,
      periodGain: 20
    });
    expect(result.reviews.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'steam-reviews-erenshor', name: 'Erenshor' },
      { id: 'steam-reviews-ak', name: 'Ancient Kingdoms' },
      { id: 'steam-reviews-afallon', name: 'Afallon' }
    ]);
    expect(result.reviews[0]).toMatchObject({
      positive: {
        total: 150,
        dayGain: 5,
        periodGain: 30,
        previousGain: 20,
        comparisonPct: 50
      },
      negative: {
        total: 40,
        dayGain: 1,
        periodGain: 5,
        previousGain: 5,
        comparisonPct: 0
      }
    });
    expect(result.reviews[1]).toMatchObject({
      positive: {
        total: 20,
        dayGain: null,
        periodGain: null,
        previousGain: null,
        comparisonPct: null
      },
      negative: {
        total: null,
        dayGain: null,
        periodGain: null,
        previousGain: null,
        comparisonPct: null
      }
    });
    expect(result.reviews[2]).toMatchObject({
      positive: {
        total: 70,
        dayGain: null,
        periodGain: null,
        previousGain: 10,
        comparisonPct: null
      },
      negative: {
        total: 5,
        dayGain: 1,
        periodGain: null,
        previousGain: 10,
        comparisonPct: null
      }
    });
  });

  it('returns null snapshots, totals, and gains when captures are missing', async () => {
    const { db } = performanceDb([]);

    const result = await loadPerformance(db, '30d', NOW);
    const guide = result.guides.find((asset) => asset.id === 'steam-guide-erenshor');
    const mod = result.mods.find((asset) => asset.id === 'vault-sprint');

    expect(guide).toMatchObject({
      total: null,
      dayGain: null,
      periodGain: null,
      previousGain: null,
      comparisonPct: null,
      points: [],
      lastCapturedAt: null,
      favorites: null,
      rating: null,
      ratings: null,
      awards: null
    });
    expect(mod).toMatchObject({
      total: null,
      dayGain: null,
      periodGain: null,
      previousGain: null,
      comparisonPct: null,
      points: [],
      lastCapturedAt: null,
      favorites: null,
      rating: null,
      ratings: null,
      awards: null
    });
    expect(result.reviews).toHaveLength(3);
    expect(result.reviews[0]).toMatchObject({
      positive: {
        total: null,
        dayGain: null,
        periodGain: null,
        previousGain: null,
        comparisonPct: null,
        points: [],
        lastCapturedAt: null
      },
      negative: {
        total: null,
        dayGain: null,
        periodGain: null,
        previousGain: null,
        comparisonPct: null,
        points: [],
        lastCapturedAt: null
      }
    });
  });
});

describe('loadPerformanceAsset', () => {
  it('does not query for an unknown asset', async () => {
    const { db, prepare } = performanceDb();

    await expect(loadPerformanceAsset(db, 'unknown', '7d', NOW)).resolves.toBeNull();
    expect(prepare).not.toHaveBeenCalled();
  });
});
