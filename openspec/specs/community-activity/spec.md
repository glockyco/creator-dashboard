# Community Activity Specification

## Purpose

Bring recent Steam reviews and Erenshor Wiki edits into one readable feed while keeping native pages available for detailed inspection.

## Requirements

### Requirement: Recent activity previews

The Overview SHALL show separate newest-first previews of Steam reviews and wiki changes, reviews first. Each preview SHALL show up to six events from the selected range and link to Activity filtered to its type. Activity SHALL offer the full feed, ordered by event time and identified by game or wiki, type, and relative time.

#### Scenario: Mixed events

- **WHEN** new Steam reviews and wiki edits are stored
- **THEN** both types appear in time order on Activity, and each type appears in its own Overview preview

#### Scenario: One quiet type

- **WHEN** the selected range has wiki edits but no Steam reviews
- **THEN** the Overview reviews preview states that there are no Steam reviews, and the wiki preview still shows its events

#### Scenario: Empty feed

- **WHEN** there are no matching events
- **THEN** Activity explains that no events match the current filters

### Requirement: Task-specific filters

Activity SHALL support type, game or wiki, date range, and review sentiment filters. Filtering SHALL not require knowing collector IDs.

#### Scenario: Negative reviews

- **WHEN** the user filters to negative Steam reviews
- **THEN** wiki edits and positive reviews are excluded without hiding reviews from other games

### Requirement: Actionable event information

A Steam review SHALL show its sentiment, game, excerpt, timestamp, and available playtime, with a native Steam link. A wiki edit SHALL show its page, editor, timestamp, available summary and net size change, with a native revision or diff link when revision identifiers exist.

#### Scenario: Inspect a wiki change

- **WHEN** a wiki change has old and new revision identifiers
- **THEN** its native link opens the comparison for that change using normal same-tab navigation

#### Scenario: Inspect a review

- **WHEN** a review has a native review destination
- **THEN** selecting its link opens the review or nearest available native review context without forcing a new tab

### Requirement: Complete chronological paging

Activity SHALL offer stable paging for the selected filters and SHALL avoid losing events when multiple records share a timestamp.

#### Scenario: Same-time events

- **WHEN** two records have the same event timestamp at a page boundary
- **THEN** each record appears exactly once across the paged results
