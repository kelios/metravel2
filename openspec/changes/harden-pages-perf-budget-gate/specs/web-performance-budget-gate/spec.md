## Purpose

Define the contract of the automated performance gate for the public web pages:
which device profiles it measures, how it proves which profile was actually
measured, the per-page layout-shift and first-screen DOM budgets it enforces, how
an accepted known debt is pinned without granting headroom, and the conditions
under which it must fail instead of reporting green.

## ADDED Requirements

### Requirement: The gate measures desktop and mobile profiles in one standard run

The public-pages performance gate SHALL measure every gated route on a desktop
profile and on a mobile profile, and both profiles SHALL be produced by a single
standard project command. A run that produces results for only one profile MUST
be reported as an incomplete gate run and MUST NOT be accepted as evidence for
the missing profile.

#### Scenario: The standard gate command is executed

- **WHEN** the standard public-pages performance gate command is run against a
  local production build
- **THEN** each gated route (`/`, `/search`, `/map`, `/places`, `/quests`) yields
  one desktop result and one mobile result
- **AND** the run summary names both profiles and the routes covered by each

#### Scenario: One profile is missing from the results

- **WHEN** a gate run finishes with results for only one of the two profiles
- **THEN** the run is reported as failed or incomplete
- **AND** the produced results are not accepted as evidence for the profile that
  was not measured

#### Scenario: A route fails on one profile only

- **GIVEN** a route is within budget on the desktop profile and over budget on
  the mobile profile
- **WHEN** the gate run completes
- **THEN** the run fails
- **AND** the failure message names the route, the profile, the exceeded budget
  and the measured value

### Requirement: Every result states and proves the profile it measured

Each measurement result SHALL record the profile it actually observed — at
minimum the layout viewport size, the device pixel ratio, whether the pointer is
coarse or touch input is available, and whether the user agent is a mobile agent.
The gate MUST fail when the observed profile does not match the requested
profile. A silently substituted profile MUST NOT be reported as a passing run.

#### Scenario: A mobile result is measured under a mobile profile

- **WHEN** the mobile profile measures a gated route
- **THEN** the result records a mobile-width layout viewport, a device pixel
  ratio above one, coarse pointer or touch availability, and a mobile user-agent
  token
- **AND** the requested profile and the observed profile are recorded as equal

#### Scenario: The requested profile is not the profile that ran

- **GIVEN** a result requested as mobile whose observed characteristics are those
  of the desktop profile
- **WHEN** the gate evaluates that result
- **THEN** the gate fails with an explicit profile-mismatch error
- **AND** the result is not counted towards the mobile budget

#### Scenario: Desktop evidence is offered for the mobile profile

- **WHEN** a report produced under the desktop profile is presented as the mobile
  result for a route
- **THEN** the gate rejects it as invalid evidence rather than passing it

### Requirement: Layout shift is budgeted per route and per profile

The gate SHALL enforce a layout-shift budget resolved per route and per profile
from a single recorded budget table, and MUST NOT fall back to one shared,
permissive value for routes without their own entry. A route without accepted
debt SHALL have a layout-shift budget of at most `0.1`, the Core Web Vitals
"good" threshold. Every gated route and profile MUST have an entry in the table.

#### Scenario: A healthy route regresses beyond the good threshold

- **GIVEN** a route whose budget table entry declares no accepted debt
- **WHEN** its measured layout shift on either profile exceeds `0.1`
- **THEN** the gate fails and names the route, the profile, the budget and the
  measured value

#### Scenario: A route or profile has no budget entry

- **WHEN** a route or profile is measured that has no entry in the budget table
- **THEN** the gate fails as misconfigured rather than applying a permissive
  default

#### Scenario: A configuration override attempts to loosen a budget

- **WHEN** an environment or configuration override supplies a layout-shift value
  larger than the route's table value
- **THEN** the effective budget remains the table value
- **AND** an override that supplies a smaller value is applied

### Requirement: Accepted debt is pinned without headroom and carries a defect reference

A route that cannot yet meet the `0.1` threshold MAY carry a temporary baseline,
but that baseline SHALL be pinned at the recorded measured value with no added
allowance, MUST be marked as accepted debt, and MUST reference the separate
defect card that owns the fix. Accepted debt MUST NOT be expressed as a raised
shared threshold and MUST NOT exceed the value it was recorded at.

#### Scenario: A pinned route degrades further

- **GIVEN** a route pinned at its recorded measured layout-shift value
- **WHEN** a later run measures a higher value on the same profile
- **THEN** the gate fails, because the pinned baseline grants no headroom

#### Scenario: A pinned entry has no defect reference

- **WHEN** the budget table contains an accepted-debt entry without a reference
  to a defect card
- **THEN** the configuration is rejected as invalid

#### Scenario: A pinned route is repaired

- **WHEN** a previously pinned route measures at or below `0.1`
- **THEN** the run passes, and the pinned entry is reported as ready to be
  removed in favour of the healthy threshold

### Requirement: The first screen has a DOM size budget

The gate SHALL measure, at the same readiness checkpoint used for Core Web
Vitals and before any scrolling, the number of rendered elements occupying the
first screen, and SHALL enforce a recorded ceiling per route and per profile. The
ceiling SHALL be derived from a recorded measurement plus an explicitly documented
headroom, not from an estimate.

#### Scenario: First-screen DOM growth exceeds the recorded ceiling

- **WHEN** a route renders more first-screen elements than its recorded ceiling
  on either profile
- **THEN** the gate fails and reports the route, the profile, the ceiling, the
  measured count and the documented headroom

#### Scenario: The first-screen count cannot be measured

- **WHEN** the first-screen element count cannot be collected for a measured
  route and profile
- **THEN** the run is reported as an invalid measurement and fails
- **AND** it is not reported as a passing budget

#### Scenario: Below-the-fold content does not consume the first-screen budget

- **GIVEN** a route whose full document contains many elements outside the first
  screen
- **WHEN** the first-screen count is collected before any scrolling
- **THEN** only elements intersecting the first screen are counted

### Requirement: Site header chrome must not be a layout-shift source

The gate SHALL record the nodes that caused each observed layout shift, and SHALL
fail when a node from the configured forbidden set appears as a shift source on
any gated route or profile. The forbidden set SHALL include the site header logo
and the site header language switcher. The recorded node identity MUST be stable
across builds, so that the assertion cannot silently stop matching.

#### Scenario: The header logo shifts during load

- **WHEN** the site header logo appears among the sources of any observed layout
  shift on a gated route
- **THEN** the gate fails and names the route, the profile, the node and the shift
  value

#### Scenario: The header language switcher shifts during load

- **WHEN** the site header language switcher appears among the sources of any
  observed layout shift on a gated route
- **THEN** the gate fails and names the route, the profile, the node and the shift
  value

#### Scenario: A forbidden node can no longer be identified

- **WHEN** the identity used to recognise a forbidden node no longer matches any
  rendered node on a gated route
- **THEN** the gate reports the forbidden-source check as unenforceable and fails
  rather than passing on the absence of a match

### Requirement: The gate fails on a real regression and never passes on a failed measurement

The gate MUST be demonstrated to fail: an input whose layout shift or first-screen
DOM size exceeds its budget SHALL produce a failing run through the same
measurement path used for real routes. Any run that cannot complete its
measurement — including a page that never reaches its readiness checkpoint —
SHALL fail as an invalid measurement, and MUST NOT be silently degraded to a pass
or to an unclassified timeout.

#### Scenario: A deliberately over-budget page is measured

- **GIVEN** a controlled page that produces a layout shift above `0.1` and a
  first-screen element count above its ceiling
- **WHEN** it is measured through the same profile, collection and evaluation
  path as a gated route
- **THEN** the run fails and reports both the layout-shift and the DOM violation

#### Scenario: A page never reaches its readiness checkpoint

- **WHEN** a gated route does not reach its readiness checkpoint within the
  allotted time
- **THEN** the result is reported as an invalid measurement with the route and
  profile named
- **AND** it is not recorded as a passing budget

### Requirement: Measurement noise is absorbed by repetition, not by looser budgets

When a measured metric is unstable across runs, the gate SHALL take repeated
measurements and evaluate a representative value such as the median, and SHALL
report the individual samples alongside it. Instability MUST NOT be answered by
raising a budget, skipping a route, or dropping a profile.

#### Scenario: Samples for one route and profile vary

- **WHEN** the repeated Core Web Vitals samples for one route and profile differ
- **THEN** the budget is evaluated against the representative value
- **AND** the report contains every individual sample and the number of repeats

#### Scenario: The representative value exceeds the budget

- **WHEN** the representative value for a route and profile exceeds its budget
- **THEN** the gate fails, regardless of any individual sample that was within
  budget

### Requirement: Existing gated assertions remain in force

The change SHALL preserve the assertions the gate already enforces on every gated
route: largest contentful paint, first contentful paint, total blocking time,
long-task count, JavaScript transfer size, total transfer size, first-party
request count, and the rule that no media request is issued without an explicit
width. Route-specific exclusions that are already accepted SHALL remain.

#### Scenario: A previously enforced budget is exceeded

- **WHEN** a gated route exceeds any of its existing transfer, request, paint,
  blocking-time or long-task budgets
- **THEN** the gate fails as it does today

#### Scenario: A media request is issued without an explicit width

- **WHEN** any measured route requests a media asset without an explicit width
  parameter
- **THEN** the gate fails and lists the offending request URLs
