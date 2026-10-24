import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { insertStatement, parseBackfillArgs } from './backfill-events';

describe('backfill-events', () => {
  it('parses JSON config overrides', () => {
    expect(parseBackfillArgs(['--source', 'erenshor-wiki-recent', '--set', 'lookbackDays=90'])).toEqual({
      sourceId: 'erenshor-wiki-recent',
      overrides: { lookbackDays: 90 },
      output: '.tmp/backfill-events.sql'
    });
  });

  it('writes statements that round-trip quotes and leave existing events alone', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(
      'CREATE TABLE events (source_id TEXT, external_id TEXT, ts INTEGER, kind TEXT, author TEXT, title TEXT, body TEXT, url TEXT, metadata TEXT, PRIMARY KEY (source_id, external_id))'
    );
    db.exec("INSERT INTO events VALUES ('wiki', 'kept', 1, 'wiki_edit', NULL, 'Original', NULL, NULL, NULL)");
    const event = {
      source_id: 'wiki',
      ts: 2,
      kind: 'wiki_edit',
      author: "O'Brien",
      url: null,
      metadata: { note: "it's" }
    };

    db.exec(insertStatement({ ...event, external_id: 'kept', title: 'Replacement', body: null }));
    db.exec(
      insertStatement({ ...event, external_id: 'new', title: "Bob's page'); DROP TABLE events; --", body: null })
    );

    expect(db.prepare('SELECT external_id, author, title, metadata FROM events ORDER BY external_id').all()).toEqual([
      { external_id: 'kept', author: null, title: 'Original', metadata: null },
      {
        external_id: 'new',
        author: "O'Brien",
        title: "Bob's page'); DROP TABLE events; --",
        metadata: '{"note":"it\'s"}'
      }
    ]);
  });
});
