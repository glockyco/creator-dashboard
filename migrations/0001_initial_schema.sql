CREATE TABLE metric_points (
  source_id  TEXT    NOT NULL,
  metric     TEXT    NOT NULL,
  ts         INTEGER NOT NULL,
  value      REAL    NOT NULL,
  dimensions TEXT,
  PRIMARY KEY (source_id, metric, ts, dimensions)
);
CREATE INDEX idx_mp_source_metric_ts ON metric_points(source_id, metric, ts);
CREATE INDEX idx_mp_ts ON metric_points(ts);

CREATE TABLE events (
  source_id   TEXT    NOT NULL,
  external_id TEXT    NOT NULL,
  ts          INTEGER NOT NULL,
  kind        TEXT    NOT NULL,
  author      TEXT,
  title       TEXT,
  body        TEXT,
  url         TEXT,
  metadata    TEXT,
  PRIMARY KEY (source_id, external_id)
);
CREATE INDEX idx_ev_source_ts ON events(source_id, ts DESC);
CREATE INDEX idx_ev_ts ON events(ts DESC);
CREATE INDEX idx_ev_kind_ts ON events(kind, ts DESC);

CREATE TABLE fetcher_runs (
  source_id            TEXT    PRIMARY KEY,
  last_run_at          INTEGER NOT NULL,
  last_success_at      INTEGER,
  last_status          TEXT    NOT NULL,
  last_error           TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE fetcher_failures (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id     TEXT    NOT NULL,
  ts            INTEGER NOT NULL,
  tier          TEXT    NOT NULL,
  status_code   INTEGER,
  error_message TEXT    NOT NULL
);
CREATE INDEX idx_ff_ts ON fetcher_failures(ts DESC);
CREATE INDEX idx_ff_source_ts ON fetcher_failures(source_id, ts DESC);

CREATE TABLE alerts_sent (
  alert_key TEXT PRIMARY KEY,
  sent_at   INTEGER NOT NULL
);

CREATE TABLE digest_sent (
  digest_date TEXT PRIMARY KEY,
  sent_at     INTEGER NOT NULL
);

CREATE TABLE posts_index (
  slug         TEXT    PRIMARY KEY,
  posted_at    INTEGER NOT NULL,
  author       TEXT    NOT NULL,
  platform     TEXT    NOT NULL,
  url          TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  tags         TEXT    NOT NULL,
  body_excerpt TEXT,
  body_hash    TEXT    NOT NULL
);
CREATE INDEX idx_posts_posted_at ON posts_index(posted_at DESC);
CREATE INDEX idx_posts_author_ts ON posts_index(author, posted_at DESC);

CREATE TABLE posts_sources (
  slug      TEXT NOT NULL,
  source_id TEXT NOT NULL,
  PRIMARY KEY (slug, source_id)
);
CREATE INDEX idx_ps_source ON posts_sources(source_id);
