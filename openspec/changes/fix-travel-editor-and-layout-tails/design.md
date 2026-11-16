## Context

See #3434 and the related WIZARD-DRAFT-001 history for #3427. The editor's
WeakMap distinguishes app-generated alt from editorial alt only while a DOM node
survives. Quill 2.0.3 exports image formats to history and image HTML to clipboard.
The current deferred transition already retries a safe anchored release for a
stationary reader; the remaining gap is an owner/viewport-only geometry change.

## Goals / Non-Goals

Goals: no presentation alt in saved/model/clipboard content; retain real authored
alt; release safe retained slack after viewport/owner resizing; keep unsafe slack.
Non-goals: new layout/visual design, native alternate UX, publication/moderation
changes, changing nginx/CSP, relaxing CLS or bundle caps, broad chunk-policy work.

## Decisions

- Use the registered image blot's formats and HTML-export boundaries for proven
  generated alt. Removing every alt equal to the fallback was rejected: an author
  can deliberately use that exact text. No provenance marker enters saved HTML.
- Share the DOM-provenance serializer in the existing editor-only Quill helper.
  HTML/manual-save reads and central toolbar/media emissions use that same state;
  the emission filter applies only to an exact copy of the current live DOM, so
  independent authored HTML replacements retain their alt. The utility does not
  import the lazily loaded Quill React component.
- Reuse the existing coalesced frame, placement check, scroll-owner claim and anchor
  transaction for resize wakeups. A polling loop and unconditional height release
  were rejected: they waste work or move visible content during reading.
- Keep the existing hook test as a hydration/autosave contract; real Quill tests
  own editor/history/clipboard integration. Show failing controls before repair.
- Native placeholder premise is checked with forced AI/native component branches,
  not a new device build when no native implementation changes. This does not
  claim physical-device rendering or performance.
- Cookie/footer/author and console causes remain unestablished until the selected
  runtime measurement. Attribute third-party messages before changing first-party
  code; backend policy changes use a separate confirmed backend task.

## Validation and delivery

Focused real-Quill and deterministic DOM regressions first; scoped lint, TypeScript
and strict spec checks, independent review-auditor and final code-review-gate.
Runtime only in testing: mobile console/resize smoke, desktop 1280x800 loading
series (12 per historical article case), no consent/footer shift sources and CLS
at most 0.1; record minor author movement separately. Use real production media
and API, no GET substitution. QA104 gets an explicitly identified private test
draft with images lacking alt; never publish it. Existing user credentials and
other articles remain untouched. Exact image source and identity are verified
before any write. Rollback: reviewed source revert, and fixture cleanup only if
needed with its captured ID; no broad data deletion.

## Risks

Quill formatting can confuse generated and deliberately replaced alt; real history,
clipboard and authored-same-text controls cover that boundary. Resize notifications
can duplicate; one tracked frame coalesces them and unsafe geometry remains held.
Global bundle repartitioning still requires canonical checks under unchanged caps.
