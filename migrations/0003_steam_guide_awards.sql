CREATE TABLE steam_guide_awards (
  source_id TEXT NOT NULL,
  reaction_id INTEGER NOT NULL,
  count INTEGER NOT NULL,
  icon_url TEXT NOT NULL,
  captured_at INTEGER NOT NULL,
  PRIMARY KEY (source_id, reaction_id)
);
