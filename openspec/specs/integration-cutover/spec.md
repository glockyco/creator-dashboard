# Integration Cutover Specification

## Purpose

Keep only the collectors and workflows that serve guide views, mod downloads, reviews, wiki activity, and actionable collection alerts.

## Requirements

### Requirement: Retained collection scope

The application SHALL continue to schedule and ingest Steam guides, Steam reviews, Thunderstore packages, Erenshor Vault mods, and Erenshor Wiki changes. It SHALL retain failure detection and alerting for those collectors.

#### Scenario: Scheduled collection

- **WHEN** the hourly schedule runs
- **THEN** it enqueues only registered retained collectors that are due

### Requirement: Retired integrations

The application SHALL NOT schedule, refresh, backfill, or require secrets for GitHub, Google Search Console, Cloudflare Analytics, or GA4 collectors. It SHALL NOT send a daily Discord digest or synchronize posts.

#### Scenario: Retired source job

- **WHEN** a queued job refers to a removed collector
- **THEN** the job is acknowledged without fetching or writing new source data

#### Scenario: Deploy without retired credentials

- **WHEN** deploy preflight runs without GitHub, Google, Cloudflare Analytics, GA4, post, or digest secrets
- **THEN** those retired settings are not considered missing requirements

### Requirement: Focused routes and persistent data

The application SHALL expose only the Overview, Activity, Issues, and guide/mod performance surfaces as primary product routes. It SHALL remove the retired posts, timeline, generic source, and settings experiences. A migration SHALL remove retired collector and post/digest data without deleting retained guide, mod, review, wiki, or issue history.

#### Scenario: Migration with mixed history

- **WHEN** a database holds both retained and retired source records
- **THEN** retired collector records and unused post/digest tables are removed while retained history remains available

#### Scenario: Removed route

- **WHEN** a client requests a retired route
- **THEN** that route is unavailable rather than serving a compatibility copy of the old experience
