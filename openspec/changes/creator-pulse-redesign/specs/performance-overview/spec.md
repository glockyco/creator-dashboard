## Purpose

Give the creator a fast view of guide growth and mod downloads without requiring inspection of individual collectors or native service dashboards.

## ADDED Requirements

### Requirement: Focused overview

The Overview SHALL present Steam guides, Thunderstore mods, Vault mods, and Steam reviews in separate compact tables. Each table SHALL sort by name by default. Guide and mod rows SHALL show their platform, latest cumulative total, rolling 24-hour gain, selected-range gain, and trend in that order. Guide rows SHALL also show current favorites, rating, vote count, and aggregate awards with absolute 24-hour and selected-range changes. Steam reviews SHALL show positive and negative totals and gains as separate rows for each game.

#### Scenario: Multiple assets and platforms

- **WHEN** guide and mod captures exist for more than one asset or platform
- **THEN** the Overview shows separate guide rows and separate mod-platform rows, with direct links to the relevant performance detail

#### Scenario: No captured data

- **WHEN** an asset has no successful capture
- **THEN** its row shows an explicit awaiting-data state rather than a zero total or zero growth

#### Scenario: Guide engagement

- **WHEN** Steam returns favorites, votes, and reactions for a guide
- **THEN** the guide row and detail show each metric's current value and absolute 24-hour and selected-range changes
- **AND** rating changes are signed percentage-point differences, not relative percentages
- **AND** a missing value or required boundary is unavailable rather than zero

#### Scenario: Review sentiment growth

- **WHEN** positive and negative review captures exist for a game
- **THEN** separate rows show each sentiment's cumulative total and absolute 24-hour and selected-range gains

### Requirement: Absolute changes across selected ranges

The Overview and performance details SHALL support 7-, 30-, and 90-day ranges. They SHALL show the latest value minus an eligible selected-range baseline, and label the absolute 24-hour change separately. They SHALL not show a relative comparison with a prior period or invent a baseline when the required capture is unavailable.

#### Scenario: Range selection

- **WHEN** the user selects 7 days
- **THEN** the trend spans the selected 7 days and the gain uses an eligible sample at the 7-day boundary

#### Scenario: Incomplete history

- **WHEN** the selected range or 24-hour interval lacks a usable baseline capture
- **THEN** the affected change is marked unavailable rather than zero

### Requirement: Focused performance detail

Selecting a guide or mod SHALL show its trend, current total, absolute 24-hour and selected-range gains, and source freshness. A mod on multiple platforms SHALL keep platform series separate unless their equivalence is explicitly defined.

#### Scenario: Inspect a guide

- **WHEN** the user opens the Afallon guide detail
- **THEN** the detail shows guide view history, current favorites, rating, vote count, aggregate awards, their 24-hour and selected-range changes, and an ordinary link to the Steam guide

#### Scenario: Inspect a mod

- **WHEN** the user opens a mod detail
- **THEN** each available platform's downloads and external destination remain distinguishable

### Requirement: Native destinations without collection

The Overview SHALL offer ordinary links to the GitHub profile, Google Search Console, and Cloudflare Analytics. Asset details SHALL offer ordinary links to their Steam or mod-host pages. The application MUST NOT force a new browser tab for these links.

#### Scenario: Follow a native link

- **WHEN** the user activates a native destination link normally
- **THEN** it navigates in the current tab, while browser-controlled new-tab gestures remain available

### Requirement: Compact responsive navigation

The interface SHALL expose Overview, Activity, and Issues on desktop and mobile without a permanent source-card sidebar. It SHALL use a single dark appearance without a theme control and persist the chosen date range.

#### Scenario: Mobile navigation

- **WHEN** the user views the dashboard on a narrow screen
- **THEN** the three primary destinations and active issue count remain accessible without horizontal scrolling
