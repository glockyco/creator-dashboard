DELETE FROM fetcher_failures
WHERE source_id = 'github-glockyco'
   OR source_id LIKE 'gsc-%'
   OR source_id LIKE 'cf-analytics-%'
   OR source_id = 'ga4';

DELETE FROM collection_incidents
WHERE source_id = 'github-glockyco'
   OR source_id LIKE 'gsc-%'
   OR source_id LIKE 'cf-analytics-%'
   OR source_id = 'ga4';

DELETE FROM metric_points
WHERE source_id = 'github-glockyco'
   OR source_id LIKE 'gsc-%'
   OR source_id LIKE 'cf-analytics-%'
   OR source_id = 'ga4'
   OR (source_id LIKE 'steam-guide-%' AND metric = 'comment_count');

DELETE FROM events
WHERE source_id = 'github-glockyco'
   OR source_id LIKE 'gsc-%'
   OR source_id LIKE 'cf-analytics-%'
   OR source_id = 'ga4'
   OR kind = 'steam_guide_comment';

DELETE FROM fetcher_runs
WHERE source_id = 'github-glockyco'
   OR source_id LIKE 'gsc-%'
   OR source_id LIKE 'cf-analytics-%'
   OR source_id = 'ga4';

DROP TABLE alerts_sent;
DROP TABLE posts_sources;
DROP TABLE posts_index;
DROP TABLE digest_sent;
DROP TABLE steam_guide_awards;
