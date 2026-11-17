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
- Cookie cause is now observed: production2f66, TMB470 fresh desktop1280 case2
  shifted `consent-banner` by CLS0.08803 after fonts had settled. The late client
  mount used the hydration-zero responsive snapshot until its low-priority
  transition; it can become visible with the narrow layout on desktop. Use the
  existing `clientOnly` responsive contract only in this effect-mounted banner.
  A real-hook/RNW first-visible regression holds that transition: old desktop
  is narrow (RED), repaired desktop is wide;320 remains a healthy mobile control.
  No global hook/default, SSR, text, visibility delay or content hiding changes.
- Footer/author and console still require the full selected runtime disposition.
  Attribute third-party messages before changing first-party code; backend policy
  changes use a separate confirmed backend task.
- An intentionally empty Quill paragraph must not enter the missing-content
  repair path. Its HTML string is nonempty, while the real editor has no
  meaningful content; the old repair can request a remount and discard Undo.
  Reuse the existing article sanitizer's semantic-empty result before any
  setText/paste/remount. Keep nonempty expected-content repair. The new real-Quill
  control deletes all text and two images, invokes the actual repair/remount
  boundary and checks real Undo plus generated-alt-free export. Old-helper RED
  failed Undo with0 images while healthy repair passed; repaired real-Quill and
  parent-link suites passed32 tests with scoped checks. This does not change global history, native behavior or SSR.

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

## Current acceptance checkpoint

The first source18 release2f66 passed review/hooks/canonical121HTML/86aliases.
Independent production QA stopped at the first failure after2/24 desktop loads:
case1 CLS0.00102 (author), case2 cookie CLS0.08803. Remaining22 loads, mobile
geometry/console and private QA104 editor/clipboard/save/finalGET were NOTRUN;
fixtureID remains null. Local slider replay separately exposed a synthetic SSR
loader bridge gap; its fixture-only repair/review is independent and the pair
remains mandatory. Cookie source RED/GREEN is not a new production PASS.

The containing cookie release22f69 subsequently passed canonical gates and24/24
fresh desktop loads (CLS0.00102 from author; no cookie/footer/unknown sources).
Real mobile resize/rotation was healthy; a positive held-gap state was not
reached and remains NOT TESTED. Private draft973 was created and verified under
production104. Two decoded image elements, unchanged no-alt server content and
native HTML clipboard copy passed. The following all-content cut/toolbar Undo
timed out; a separate fresh-version-fenced restore returned the same private
technical draft to its two no-alt project PNGs. The empty-scaffold remount is a
source-backed explanation, not a captured runtime instance trace. This source
repair and its scoped regressions passed; new review/publication/acceptance and the
separate mandatory LOCAL pair remain pending.
