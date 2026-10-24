import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

// Test-only D1 stand-in that runs the real migrations on in-memory SQLite.

type SqlValue = string | number | bigint | Uint8Array | null;

class TestPreparedStatement {
  constructor(
    private readonly database: DatabaseSync,
    private readonly sql: string,
    private readonly values: SqlValue[] = []
  ) {}

  bind(...values: SqlValue[]): D1PreparedStatement {
    return new TestPreparedStatement(this.database, this.sql, values) as unknown as D1PreparedStatement;
  }

  async first<T>(): Promise<T | null> {
    return (this.database.prepare(this.sql).get(...this.values) as T | undefined) ?? null;
  }

  async all<T>(): Promise<D1Result<T>> {
    return { results: this.database.prepare(this.sql).all(...this.values) as T[] } as D1Result<T>;
  }

  async run(): Promise<D1Result> {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { results: [], meta: { changes: Number(result.changes) } } as unknown as D1Result;
  }
}

export function migrationsThrough(filename = '9999'): string[] {
  return readdirSync('migrations')
    .filter((migration) => migration.endsWith('.sql') && migration <= filename)
    .sort()
    .map((migration) => readFileSync(`migrations/${migration}`, 'utf8'));
}

export function d1Fixture(throughMigration?: string): { sqlite: DatabaseSync; d1: D1Database } {
  const sqlite = new DatabaseSync(':memory:');
  for (const migration of migrationsThrough(throughMigration)) sqlite.exec(migration);

  const d1 = {
    prepare(sql: string) {
      return new TestPreparedStatement(sqlite, sql) as unknown as D1PreparedStatement;
    },
    async batch(statements: D1PreparedStatement[]) {
      sqlite.exec('BEGIN');
      try {
        const results: D1Result[] = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    }
  } as unknown as D1Database;
  return { sqlite, d1 };
}
