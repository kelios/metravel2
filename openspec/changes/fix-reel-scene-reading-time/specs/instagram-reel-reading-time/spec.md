## Purpose

Ensure creators receive an actionable reading-time finding for all simultaneously visible Reel caption words before editorial review.

## ADDED Requirements

### Requirement: Scene-wide reading time
The package linter SHALL count every visible kicker, title, subtitle and text layer together over their actual common interval. Required duration SHALL be `max(1.5 + 0.3 * N, N / 3, 4 for composite captions)`, with N being their total word count. A nonempty subtitle or multiple simultaneous text layers SHALL be composite. A timing finding SHALL identify F2, interval, N, actual duration and required duration. The existing approximately seven-word limit SHALL apply to each layer, not the combined scene.

#### Scenario: Historical short composite scene
- **WHEN** a five-word title and six-word subtitle share 0–3 seconds
- **THEN** one timing finding reports 11 words, 3 seconds and at least 4.8 seconds

#### Scenario: Exact reading-time boundary
- **WHEN** the same two layers share 0–4.8 seconds
- **THEN** no F2 finding is produced

### Requirement: Continuous and intersecting exposure
The linter SHALL preserve sequential duration-only clips and absolute `t0/t1` or `t` ranges. Identical adjacent captions SHALL share continuous exposure; a gap SHALL reset it. Overlap groups SHALL use a true common interval rather than a transitive union. A persistent layer SHALL NOT acquire new short solo appearances merely because another layer starts or ends.

#### Scenario: Persistent title with a subtitle
- **WHEN** a two-word title spans 0–10 seconds and a two-word subtitle spans 1–5 seconds
- **THEN** the composite caption receives 4 seconds and no short-title finding is created for 0–1 seconds

#### Scenario: Transitive overlap is not a scene
- **WHEN** A spans 0–5, B spans 4–10 and C spans 9–15 seconds
- **THEN** overlapping groups AB and BC are checked and no group ABC is invented

#### Scenario: Gap resets identical text
- **WHEN** identical captions span 0–1 and 2–3 seconds
- **THEN** they are separate one-second appearances

### Requirement: Existing package interface
The linter SHALL retain its existing package paths, CLI exit codes, duration-only lists, segments/texts objects, build/spec.json and untimed slides.txt fallback. No Reel package, account state or F11 rule SHALL be changed by this feature.

#### Scenario: Single caption
- **WHEN** a single timed caption is present
- **THEN** its exposure is checked once, without a second scene timing finding
