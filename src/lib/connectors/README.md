# Connector rules

- Connectors are pure: HTTP response to Zod parse to typed rows.
- Connectors never read or write D1.
- Connectors never log secrets or raw upstream responses.
- Connectors use sequential awaits. Do not use Promise.all inside connector modules.
- Connectors re-emit historical rows freely; D1 INSERT OR IGNORE handles idempotency.
- Connectors parameterize `source.id`; never hardcode a source ID inside a fetcher.
- Unit tests use checked-in fixtures plus synthetic schema-drift and auth-error responses.
