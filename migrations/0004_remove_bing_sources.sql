DELETE FROM metric_points WHERE source_id LIKE 'bing-%';
DELETE FROM events WHERE source_id LIKE 'bing-%';
DELETE FROM fetcher_runs WHERE source_id LIKE 'bing-%';
DELETE FROM fetcher_failures WHERE source_id LIKE 'bing-%';
DELETE FROM posts_sources WHERE source_id LIKE 'bing-%';
DELETE FROM alerts_sent WHERE alert_key LIKE '%:bing-%:%';
