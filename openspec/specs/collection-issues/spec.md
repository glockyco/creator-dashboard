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

### Requirement: Investigable issue details

An issue SHALL identify its collector, failure tier, complete error, HTTP status when known, consecutive failure count, last attempt, last success, and attempt history. Next retry SHALL appear only when an actual automatic retry is scheduled.

#### Scenario: Permanent failure

- **WHEN** automatic retries have stopped for a permanent failure
- **THEN** the detail does not promise an automatic next retry and offers manual retry

### Requirement: Manual recovery

An authenticated user SHALL be able to request a retry for a retained collector and see whether the subsequent collection succeeded. Duplicate clicks SHALL not create unbounded duplicate work.

#### Scenario: Retry from an issue

- **WHEN** the user requests a retry from an active issue
- **THEN** the request is queued once and the issue remains visible until a successful capture clears its active failure

### Requirement: Failure and recovery notifications

A retained collector's permanent failure or exhausted retries SHALL trigger a deduplicated Discord notification containing a direct investigation link. A later successful capture SHALL attempt a recovery notification for that incident and SHALL not resend it after confirmed delivery. No daily digest SHALL be sent.

#### Scenario: Repeat failures

- **WHEN** repeated attempts fail for one unresolved incident
- **THEN** Discord does not receive a new failure notification for each attempt

#### Scenario: Recovery after notification

- **WHEN** a collector succeeds after a notified failure
- **THEN** its issue resolves and Discord receives one recovery notification with the issue context

#### Scenario: Recovered source fails again

- **WHEN** a recovered collector later enters a new failure incident
- **THEN** it can send a new failure notification for the new incident
