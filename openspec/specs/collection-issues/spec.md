# Collection Issues Specification

## Purpose

Make collection failures noticeable without filling the normal dashboard with operational controls, and retain enough evidence to investigate and confirm recovery.

## Requirements

### Requirement: Quiet status and actionable issue list

The Overview SHALL show a quiet all-healthy indicator or a prominent active-issue summary. Issues SHALL list active failures before recovered incidents and expose all collectors separately. Never-run, stale, retrying, failed, healthy, and recovered states SHALL not be conflated.

#### Scenario: Collection failure

- **WHEN** a retained collector has an active failure
- **THEN** Overview shows its issue count and a direct route to its investigation

#### Scenario: No active failure

- **WHEN** all retained collectors are healthy
- **THEN** Overview shows freshness without filling the page with healthy collector cards

### Requirement: Stale collectors

A collector SHALL be stale when it has gone two of its expected collection intervals without a successful capture. A stale collector without an active failure SHALL open an issue, so a collector that stops running is reported like one that fails. Overview freshness SHALL reflect the least recently successful collector.

#### Scenario: Collector stops running

- **WHEN** an hourly collector has no successful capture for more than two hours and no recorded failure
- **THEN** an issue opens for it and Discord receives a failure notification

#### Scenario: One collector behind

- **WHEN** one collector last succeeded two days ago and the others succeeded this hour
- **THEN** Overview freshness shows the time from two days ago

### Requirement: Investigable issue details

An issue SHALL identify its collector, failure tier, complete error, HTTP status when known, consecutive failure count, last attempt, last success, and attempt history. Next retry SHALL appear only when an actual automatic retry is scheduled.

#### Scenario: Permanent failure

- **WHEN** automatic retries have stopped for a permanent failure
- **THEN** the detail does not promise an automatic next retry and offers manual retry

### Requirement: Manual recovery

The application SHALL let you request a retry for a retained collector after authentication and show whether the subsequent collection succeeded. Duplicate clicks SHALL not create unbounded duplicate work.

#### Scenario: Retry from an issue

- **WHEN** you request a retry from an active issue
- **THEN** the request is queued once and the issue remains visible until a successful capture clears its active failure

### Requirement: Failure and recovery notifications

A retained collector's permanent failure, exhausted automatic retries, or an issue that stays open for three hours SHALL trigger a deduplicated Discord notification containing a direct investigation link and the latest real failure. A failed or interrupted notification SHALL be attempted again. A later successful capture SHALL attempt a recovery notification for that incident and SHALL not resend it after confirmed delivery. No daily digest SHALL be sent.

#### Scenario: Persistent transient failure

- **WHEN** a collector keeps failing with an upstream 5xx or timeout
- **THEN** Discord receives a failure notification once automatic retries are exhausted, and no later than three hours after the first failure

#### Scenario: Repeat failures

- **WHEN** repeated attempts fail for one unresolved incident
- **THEN** Discord does not receive a new failure notification for each attempt

#### Scenario: Recovery after notification

- **WHEN** a collector succeeds after a notified failure
- **THEN** its issue resolves and Discord receives one recovery notification with the issue context

#### Scenario: Recovered source fails again

- **WHEN** a recovered collector later enters a new failure incident
- **THEN** it can send a new failure notification for the new incident

### Requirement: Unfixable responses are permanent

A response that retrying cannot fix, such as an unexpected 4xx status or a body that is not the expected JSON, SHALL count as a permanent failure.

#### Scenario: Retired endpoint

- **WHEN** an upstream endpoint redirects to an HTML page instead of returning JSON
- **THEN** the failure is permanent and alerts at once, naming the redirect target

### Requirement: Retained history

Collected metrics, events, and incident history SHALL be retained indefinitely, and an issue detail SHALL stay readable however many attempts it accumulates.

#### Scenario: Long incident

- **WHEN** an incident has accumulated more attempts than fit on one screen
- **THEN** the detail shows the most recent attempts and states how many earlier attempts exist
