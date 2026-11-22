## Context

The current extractor drops subtitle/kicker/title fields and discards absolute positions. Its final loop merges adjacent equal strings and validates each independently. The renderer already supports kicker/title/subtitle, so this changes validation of existing input rather than montage schema.

## Goals / Non-Goals

Goals: count co-visible words, keep continuity and actionable F2 diagnostics; match the editor-approved rule and historical short timings.
Non-goals: content edits, video rendering, F11/audio, app/backend/deploy, new format fields.

## Decisions

Normalize existing segment/text records into timed text layers; duration-only segments advance a timeline even when a clip has no caption. Support duration as already used by make-reel.py, plus dur and explicit ranges. Merge identical layer text only across touching clip intervals; overlapping records remain separate visible layers. Enumerate distinct simultaneously active sets at time boundaries, then use each set's true common interval. Do not shorten its exposure merely because a third layer changes. Do not recheck solo fragments of a layer participating in a composite group. This avoids both transitive union and artificial one-second persistent-title prefixes.

Use the agreed maximum formula. Explicit subtitles and multiple simultaneous layers get the four-second floor. Keep the existing seven-word limit per layer. Do not retain old per-layer timing findings alongside the scene finding. Identical text with a gap remains separate.

Rejected alternative: sum durations/words over a connected overlap component; it credits time when some words are absent and can merge A/B/C that never coexist. Also reject checking every atomic solo remainder, which creates false failures for already persistent text.

Paths: scripts/instagram/lint-package.py; __tests__/scripts/instagram-lint-package.test.ts; the two editorial rule documents. CLI/data fields remain compatible. Platform impact: none. Localization impact: none.

## Risks / Trade-offs

Unlabelled multiple layers cannot identify a subtitle semantically; use the same conservative four-second composite floor and state it in both docs. Timing tolerance remains 1e-6. Original bad packages are missing and synthetic reproductions must be labelled. The accepted Szczawnica control is missing and remains an explicit required artifact, never a synthetic PASS.

Validation: targeted Jest CLI suite, three package probes (synthetic only where permitted), strict OpenSpec, scoped lint and ordinary commit/push hooks; independent review-auditor then code-review-gate. Shared quality ownership is pending coordinator acceptance after a prior SKIPPED gate; no retry/bypass. No browser/device/production/Instagram account action is required. Rollback: revert only task-owned commits.
