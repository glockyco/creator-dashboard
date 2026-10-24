import { describe, expect, it } from 'vitest';
import { d1Fixture } from '$lib/server/db/test-d1';
import type { FetcherOutput } from '$lib/types/domain';
import { successStatements } from './persist';

const review = (body: string, votedUp: boolean, ts = 1_000): FetcherOutput['events'][number] => ({
  source_id: 'steam-reviews-erenshor',
  external_id: 'review-1',
  ts,
  kind: 'review',
  author: null,
  title: votedUp ? 'Positive review' : 'Negative review',
  body,
  url: 'https://steamcommunity.com/app/2382520/reviews/',
  metadata: { voted_up: votedUp }
});

describe('successStatements', () => {
  it('refreshes an edited review but keeps its original event time', async () => {
    const { sqlite, d1 } = d1Fixture();

    await d1.batch(
      successStatements(
        d1,
        'steam-reviews-erenshor',
        10_000,
        { metric_points: [], events: [review('Needs work.', false)] },
        true
      )
    );
    await d1.batch(
      successStatements(
        d1,
        'steam-reviews-erenshor',
        20_000,
        {
          metric_points: [
            { source_id: 'steam-reviews-erenshor', metric: 'review_total', ts: 20_000, value: 1, dimensions: null }
          ],
          events: [review('Fixed now, great.', true, 5_000)]
        },
        true
      )
    );

    expect(sqlite.prepare('SELECT ts, title, body, metadata FROM events').all()).toEqual([
      { ts: 1_000, title: 'Positive review', body: 'Fixed now, great.', metadata: '{"voted_up":true}' }
    ]);
    expect(sqlite.prepare('SELECT last_success_at FROM fetcher_runs').get()).toEqual({ last_success_at: 20_000 });
  });

  it('records a manual run without moving the scheduled-run time the cadence gate uses', async () => {
    const { sqlite, d1 } = d1Fixture();

    await d1.batch(successStatements(d1, 'steam-guide-ak', 10_000, { metric_points: [], events: [] }, true));
    await d1.batch(successStatements(d1, 'steam-guide-ak', 40_000, { metric_points: [], events: [] }, false));

    expect(
      sqlite.prepare('SELECT last_run_at, last_scheduled_run_at, last_success_at FROM fetcher_runs').get()
    ).toEqual({
      last_run_at: 40_000,
      last_scheduled_run_at: 10_000,
      last_success_at: 40_000
    });
  });
});
