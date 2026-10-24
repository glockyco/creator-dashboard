# Connector rules

- Connectors are pure: HTTP response to Zod parse to typed rows.
- Connectors never read or write D1.
- Connectors never log secrets or raw upstream responses.
- Connectors use sequential awaits. Do not use Promise.all inside connector modules.
- Connectors re-read a lookback window freely. Persistence upserts events by `(source_id, external_id)` and refreshes changed content, so an edited review updates in place.
- A response that parses but lacks what the source needs, such as a missing summary or configured item, throws `InvalidResponseError`. It alerts at once as a permanent failure. Never record zeros or partial data in its place.
- Connectors parameterize `source.id`; never hardcode a source ID inside a fetcher.
- Unit tests use checked-in fixtures plus synthetic schema-drift and auth-error responses.
