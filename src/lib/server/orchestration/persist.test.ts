import { describe, expect, it } from 'vitest';
import type { FetcherOutput } from '$lib/types/domain';
import { successStatements } from './persist';

type Prepared = { sql: string; binds: unknown[]; bind: (...values: unknown[]) => Prepared };

function fakeDb() {
  const statements: Prepared[] = [];
  const db = {
    prepare(sql: string) {
      const statement: Prepared = {
        sql,
        binds: [],
        bind(...values: unknown[]) {
          statement.binds = values;
          return statement;
        }
      };
      statements.push(statement);
      return statement;
    }
  };
  return { db: db as unknown as D1Database, statements };
}

describe('successStatements', () => {
  it('creates idempotent metric/event inserts and success run upsert', () => {
    const { db, statements } = fakeDb();
    const output: FetcherOutput = {
      metric_points: [
        { source_id: 'source-a', metric: 'followers', ts: 1714838400000, value: 3, dimensions: { account: 'main' } }
      ],
      events: [
        {
          source_id: 'source-a',
          external_id: 'event-1',
          ts: 1714838400000,
          kind: 'review',
          author: 'anon',
          title: 'Positive review',
          body: 'Body',
          url: 'https://example.invalid/review/1',
          metadata: { voted_up: true }
        }
      ]
    };

    const result = successStatements(db, 'source-a', 1714838500000, output);

    expect(result).toHaveLength(3);
    expect(statements[0].sql).toContain('INSERT INTO metric_points');
    expect(statements[0].sql).toContain(
      "ON CONFLICT(source_id, metric, ts, COALESCE(dimensions, '')) DO UPDATE SET value = excluded.value"
    );
    expect(statements[0].binds).toEqual(['source-a', 'followers', 1714838400000, 3, '{"account":"main"}']);
    expect(statements[1].sql).toContain('INSERT OR IGNORE INTO events');
    expect(statements[1].binds.at(-1)).toBe('{"voted_up":true}');
    expect(statements[2].sql).toContain('ON CONFLICT(source_id) DO UPDATE');
    expect(statements[2].binds).toEqual(['source-a', 1714838500000, 1714838500000]);
  });
});
