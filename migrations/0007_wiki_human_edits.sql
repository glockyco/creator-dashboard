-- The wiki collector stores only human edits and new pages, excluding the owner's account.
-- Remove earlier rows that fall outside that scope: bot edits, the owner's edits, and log or category entries.
DELETE FROM events
WHERE source_id = 'erenshor-wiki-recent'
  AND (
    json_extract(metadata, '$.bot') = 1
    OR author = 'WoWMuch'
    OR json_extract(metadata, '$.type') NOT IN ('edit', 'new')
  );
