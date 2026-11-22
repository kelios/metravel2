## Why

#3263: Reel captions are linted separately while the viewer reads kicker, title and subtitle together. Two historical packages passed F2 with 9–14 words displayed for only 3–3.6 seconds.

## What Changes

- Apply one scene rule: minimum `max(1.5 + 0.3 * words, words / 3, 4 seconds for a subtitle/composite caption)`.
- Normalize existing montage formats and inspect actual intersections of visible text, without joining unrelated scenes transitively or shortening persistent captions at unrelated boundaries.
- Preserve uninterrupted identical captions across adjacent clips, but never bridge a gap.
- Align F2 and brief step 5; cover historical timings, exact boundary and healthy controls.
- Non-goals: F11/audio, editing/rendering/publishing Reel packages, application/backend code, new montage schema.

## Capabilities

### New Capabilities
- `instagram-reel-reading-time`: scene-wide caption reading-time validation in the local content-package linter.

### Modified Capabilities
None.

## Impact

Scope: `scripts/instagram/lint-package.py`, its existing Jest CLI suite, F2 in `docs/INSTAGRAM_CONTENT_SPEC.md` and step 5 in `docs/INSTAGRAM_REELS_BRIEF.md`.
Platform impact: none; local content tooling only. Localization impact: none.
Creators receive an F2 finding with interval, word count, actual and required time. Existing CLI exit codes and input JSON shapes remain supported. API, SEO, accessibility, application performance, security and analytics are unchanged.
Dependencies: none. Fallback/mock policy: historical failing specs may be reconstructed from the timings documented in the task, with explicit synthetic provenance; the accepted Szczawnica control must be actual source or reported unavailable. No production or Instagram account action is required.
