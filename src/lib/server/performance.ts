import {
  performanceAssetDefinitions,
  performanceReviewDefinitions,
  type PerformanceAssetDefinition,
  type PerformanceReviewDefinition
} from '$lib/performance/assets';
import {
  boundaryToleranceMs,
  rangeDurationMs,
  summarizePerformanceSeries,
  summarizeLevelSeries,
  type PerformancePoint,
  type PerformanceSeriesSummary,
  type Range
} from '$lib/performance/series';

export type { Range } from '$lib/performance/series';

export type PerformanceAsset = {
  id: string;
  name: string;
  platform: string;
  kind: 'guide' | 'mod';
  total: number | null;
  dayGain: number | null;
  periodGain: number | null;
  points: { ts: number; value: number }[];
  href: string | null;
  lastCapturedAt: number | null;
  guideMetrics: {
    favorites: PerformanceSeriesSummary;
    rating: PerformanceSeriesSummary;
    ratings: PerformanceSeriesSummary;
    awards: PerformanceSeriesSummary;
  } | null;
};

export type PerformanceReview = {
  id: string;
  name: string;
  positive: PerformanceSeriesSummary;
  negative: PerformanceSeriesSummary;
};

export type PerformanceResult = {
  guides: PerformanceAsset[];
  mods: PerformanceAsset[];
  reviews: PerformanceReview[];
};

type PerformanceRow = PerformancePoint & {
  selector_id: string;
};

type PerformanceSelector = {
  id: string;
  sourceId: string;
  metric: string;
  dimensionKey: string | null;
  dimensionValue: string | null;
  cadenceHours: number;
  includeHistory: boolean;
};

const guideMetricDefinitions = [
  { field: 'favorites', metric: 'favorite_count' },
  { field: 'rating', metric: 'rating' },
  { field: 'ratings', metric: 'ratings' },
  { field: 'awards', metric: 'award_count' }
] as const;

export async function loadPerformance(
  db: D1Database,
  range: Range,
  now: number = Date.now()
): Promise<PerformanceResult> {
  const selectors = [
    ...selectorsForAssets(performanceAssetDefinitions),
    ...selectorsForReviews(performanceReviewDefinitions)
  ];
  const rowsBySelector = await queryPerformanceRows(db, selectors, range, now);
  const assets = summarizeAssets(performanceAssetDefinitions, rowsBySelector, range, now);

  return {
    guides: assets.filter((asset) => asset.kind === 'guide'),
    mods: assets.filter((asset) => asset.kind === 'mod'),
    reviews: summarizeReviews(performanceReviewDefinitions, rowsBySelector, range, now)
  };
}

export async function loadPerformanceAsset(
  db: D1Database,
  id: string,
  range: Range,
  now: number = Date.now()
): Promise<PerformanceAsset | null> {
  const definition = performanceAssetDefinitions.find((asset) => asset.id === id);
  if (!definition) return null;

  const rowsBySelector = await queryPerformanceRows(db, selectorsForAssets([definition]), range, now);
  return summarizeAssets([definition], rowsBySelector, range, now)[0] ?? null;
}

function summarizeAssets(
  definitions: readonly PerformanceAssetDefinition[],
  rowsBySelector: ReadonlyMap<string, PerformancePoint[]>,
  range: Range,
  now: number
): PerformanceAsset[] {
  return definitions.map((definition) => {
    const summary = summarizePerformanceSeries(
      rowsBySelector.get(assetSeriesId(definition.id)) ?? [],
      range,
      now,
      definition.cadenceHours
    );
    const guideMetric = (field: (typeof guideMetricDefinitions)[number]['field']) =>
      (field === 'rating' ? summarizeLevelSeries : summarizePerformanceSeries)(
        rowsBySelector.get(assetMetricId(definition.id, field)) ?? [],
        range,
        now,
        definition.cadenceHours
      );

    return {
      id: definition.id,
      name: definition.name,
      platform: definition.platform,
      kind: definition.kind,
      ...summary,
      href: definition.href,
      guideMetrics:
        definition.kind === 'guide'
          ? {
              favorites: guideMetric('favorites'),
              rating: guideMetric('rating'),
              ratings: guideMetric('ratings'),
              awards: guideMetric('awards')
            }
          : null
    };
  });
}

function summarizeReviews(
  definitions: readonly PerformanceReviewDefinition[],
  rowsBySelector: ReadonlyMap<string, PerformancePoint[]>,
  range: Range,
  now: number
): PerformanceReview[] {
  return definitions.map((definition) => ({
    id: definition.id,
    name: definition.name,
    positive: summarizePerformanceSeries(
      rowsBySelector.get(reviewSeriesId(definition.id, 'positive')) ?? [],
      range,
      now,
      definition.cadenceHours
    ),
    negative: summarizePerformanceSeries(
      rowsBySelector.get(reviewSeriesId(definition.id, 'negative')) ?? [],
      range,
      now,
      definition.cadenceHours
    )
  }));
}

function selectorsForAssets(definitions: readonly PerformanceAssetDefinition[]): PerformanceSelector[] {
  const selectors: PerformanceSelector[] = [];
  for (const definition of definitions) {
    selectors.push({
      id: assetSeriesId(definition.id),
      sourceId: definition.sourceId,
      metric: definition.metric,
      dimensionKey: definition.dimension?.key ?? null,
      dimensionValue: definition.dimension?.value ?? null,
      cadenceHours: definition.cadenceHours,
      includeHistory: true
    });
    if (definition.alternateDimension) {
      selectors.push({
        id: assetSeriesId(definition.id),
        sourceId: definition.sourceId,
        metric: definition.metric,
        dimensionKey: definition.alternateDimension.key,
        dimensionValue: definition.alternateDimension.value,
        cadenceHours: definition.cadenceHours,
        includeHistory: true
      });
    }
    if (definition.kind === 'guide') {
      for (const metric of guideMetricDefinitions) {
        selectors.push({
          id: assetMetricId(definition.id, metric.field),
          sourceId: definition.sourceId,
          metric: metric.metric,
          dimensionKey: null,
          dimensionValue: null,
          cadenceHours: definition.cadenceHours,
          includeHistory: true
        });
      }
    }
  }
  return selectors;
}

function selectorsForReviews(definitions: readonly PerformanceReviewDefinition[]): PerformanceSelector[] {
  return definitions.flatMap((definition) =>
    (['positive', 'negative'] as const).map((sentiment) => ({
      id: reviewSeriesId(definition.id, sentiment),
      sourceId: definition.sourceId,
      metric: sentiment === 'positive' ? 'review_positive' : 'review_negative',
      dimensionKey: null,
      dimensionValue: null,
      cadenceHours: definition.cadenceHours,
      includeHistory: true
    }))
  );
}

function assetSeriesId(id: string): string {
  return `asset:${id}`;
}

function assetMetricId(id: string, field: (typeof guideMetricDefinitions)[number]['field']): string {
  return `asset:${id}:${field}`;
}

function reviewSeriesId(id: string, sentiment: 'positive' | 'negative'): string {
  return `review:${id}:${sentiment}`;
}

async function queryPerformanceRows(
  db: D1Database,
  selectors: readonly PerformanceSelector[],
  range: Range,
  now: number
): Promise<Map<string, PerformancePoint[]>> {
  let maxToleranceMs = 0;
  for (const selector of selectors) {
    maxToleranceMs = Math.max(maxToleranceMs, boundaryToleranceMs(selector.cadenceHours));
  }
  const analysisStart = now - rangeDurationMs(range) - maxToleranceMs;
  const dimensionMatch = `(selectors.dimension_key IS NULL AND points.dimensions IS NULL)
          OR (
            selectors.dimension_key IS NOT NULL
            AND json_extract(points.dimensions, '$.' || selectors.dimension_key) = selectors.dimension_value
          )`;
  const latestDimensionMatch = `(selectors.dimension_key IS NULL AND candidate.dimensions IS NULL)
                OR (
                  selectors.dimension_key IS NOT NULL
                  AND json_extract(candidate.dimensions, '$.' || selectors.dimension_key) = selectors.dimension_value
                )`;

  const rowsBySelector = new Map<string, PerformancePoint[]>();
  for (const selector of selectors) rowsBySelector.set(selector.id, []);
  // D1 permits at most 100 bind variables; each selector uses six, plus three time bounds.
  for (let start = 0; start < selectors.length;) {
    let end = Math.min(start + 16, selectors.length);
    while (end < selectors.length && selectors[end - 1].id === selectors[end].id) end--;
    const batch = selectors.slice(start, end);
    const selectorValues = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const selectorParams = batch.flatMap((selector) => [
      selector.id,
      selector.sourceId,
      selector.metric,
      selector.dimensionKey,
      selector.dimensionValue,
      selector.includeHistory ? 1 : 0
    ]);
    const result = await db
      .prepare(
        `WITH selectors(selector_id, source_id, metric, dimension_key, dimension_value, include_history) AS (
         VALUES ${selectorValues}
       ),
       recent_points AS (
         SELECT selectors.selector_id, points.ts, points.value
         FROM selectors
         JOIN metric_points AS points
           ON points.source_id = selectors.source_id
          AND points.metric = selectors.metric
          AND (${dimensionMatch})
         WHERE selectors.include_history = 1 AND points.ts >= ? AND points.ts <= ?
       ),
       latest_points AS (
         SELECT selectors.selector_id, points.ts, points.value
         FROM selectors
         JOIN metric_points AS points
           ON points.source_id = selectors.source_id
          AND points.metric = selectors.metric
          AND (${dimensionMatch})
         WHERE points.ts = (
           SELECT MAX(candidate.ts)
           FROM metric_points AS candidate
           WHERE candidate.source_id = selectors.source_id
             AND candidate.metric = selectors.metric
             AND candidate.ts <= ?
             AND (${latestDimensionMatch})
         )
       )
       SELECT selector_id, ts, value FROM recent_points
       UNION
       SELECT selector_id, ts, value FROM latest_points
       ORDER BY selector_id ASC, ts ASC`
      )
      .bind(...selectorParams, analysisStart, now, now)
      .all<PerformanceRow>();

    for (const row of result.results ?? []) {
      rowsBySelector.get(row.selector_id)?.push({ ts: row.ts, value: row.value });
    }
    start = end;
  }
  return rowsBySelector;
}
