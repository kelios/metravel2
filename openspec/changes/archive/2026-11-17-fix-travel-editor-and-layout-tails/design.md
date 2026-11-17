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
- At this design checkpoint, footer/author and console still required the full selected runtime disposition.
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

## Historical acceptance checkpoints (before final42b acceptance)

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

### Initial-sync and the delayed parent acknowledgement

The8c4 production editor stopped at the first0-image wait after the native cut;
Undo had not run. The exact own save confirmed the empty draft placeholder.
There was no DOM timeline, so reinsertion by initial-sync remains a source-backed
candidate. The earlier32-test evidence covered direct Quill/ensure, without the
full controlled ArticleEditor and its250ms parent acknowledgement.

Use the existing last-emitted HTML and force-synced refs. Initial-sync marks an
already healthy Quill complete. Before timeout work and again before idle work,
captured external HTML must still equal the latest accepted/emitted HTML and be
unsynced. A local edit invalidates old work synchronously. Only the existing
accepted external-content branch resets completion; echo updates retain local
ownership. Keep the scheduler, debounce, history, native and SSR unchanged.
Do not introduce a second editor session state machine or disable initial repair.

Prepared controls mount the actual ArticleEditor, real Quill and a stateful
parent. They retain both initially pending work and a healthy completed mount,
cut all content while the prop still contains images, flush idle repair before
the real debounce, and check empty DOM, same instance, parent echo and Undo/redo.
Initial-empty and genuinely new external nonempty content are positive controls.
With the exact three8c4 production files, both cut controls failed at the
intended assertion (2 images instead of0), while both genuine-external controls
passed. The repaired real-Quill/full-parent and parent-link suites passed36/36,
with scoped checkfast/lint, production TypeScript, complexity and strict OpenSpec.
This confirms the source path in the full parent; the original runtime still has
no frame timeline. Canonical budgets and new production editor acceptance remain
mandatory after independent review and normal publication.

### Whole-editor focus boundary

Release533f V9 supplied the missing native pointer proof. Cut left the original
Quill node with undoDepth1/redoDepth0. Pointer-down hit the enabled Undo button at
y660; focus moved from Quill to this own toolbar control. The viewport listener
flushed the pending empty description before click. Touched validation mounted a
23px local error and98px summary; the same button moved to y781 before pointer-up.
The original point then hit outside the editor, and no Undo click/handler ran.
This is a focus/layout boundary failure. Tooltip had no pointer events or focus;
no further history repair is justified by this evidence.

Attach the focusout listener to the existing ArticleEditorShell wrap/fullInner
DOM node via a stable callback ref with cleanup. The callback also handles an
asynchronously mounted fullscreen container without a new wrapper or state.
Skip flush only when relatedTarget is contained in that same whole-editor node.
Null or external destinations retain immediate flush, including leaving the
toolbar. Keep the viewport ref for content reads and media/drag helpers.
No global IconButton, history, scheduler, debounce, validation or layout change.

The old533f native clipboard/DOM-toolbar unit diagnostic passed2/2 without real
hit geometry. The updated full-parent control checks the causal event boundary:
focus on own Undo must not emit the empty value before click; real Undo/redo and
DOM identity remain required. External/null and toolbar-to-external transitions
are positive flush controls. On the exact three533f production files, the new
boundary controls gave2 intended failures (premature empty emit inside, missed
toolbar-to-external emit) and3healthy passes. The fix passed41/41 across the
real-Quill/full-parent and parent-link suites, normal scoped checkfast/lint,
production TypeScript, complexity, diff and strict OpenSpec checks. Unit evidence
checks the event boundary; corrected browser geometry is not yet measured.
Final review/publication/canonical and real native click acceptance remain.

## Final accepted checkpoint — 17.11.2026

Source42babcab95bcaae87191fb066542aecf42e0b7db completed independent source
reviews, normal hooks/gate/push and canonical release (exit0,200.689s).
All121 HTML/86 aliases passed unchanged caps: entry232602/232602B,
home477997/480437B with12/13 requests, travel568815/571443B with17/18.
The full raw entry SHA and all three encoded lengths matched533f. No ceiling,
SSR/maps mode, dependency pin or install/postinstall bypass was used.

V10 on that published source passed all14 private-editor controls: genuine
copy1/cut1/Undo2/redo1; the original Quill DOM survived. Generated alt was absent
from clipboard/HTML/save; authored alt, including the literal fallback, survived
save/reload. Real bold/link/media export and persisted GET passed. The first Undo
button stayed at y660 through native down/focusout/up/click, all hitting that
control; the old121px movement/cancel was absent. Five own PUT200 responses for
fixture973 were confirmed by id/body SHA/updated_at; no create, unexpected
blocked/failed request, console or pageerror. After browser close, a separate
strict GET confirmed actor104's private technical draft with two approved real
project PNGs, no alt, description SHA
`d8afc29e3929679b9003a18c134d24718b508b756cae6d76677a1a21ed583945`
and own version2026-11-17T03:31:07.517118Z. Physical RELEASE03:31:09.958Z.
No additional create, reset or editor runtime is required.

Reader evidence is reused only across unchanged reader/cookie/layout boundaries:
22f69 completed24/24 fresh1280x800/DPR1/RU/consent:false loads,12 TMB470 and
12 Hex544. Max CLS0.00101657 came from the author badge; cookie/footer/unknown
sources0, console/pageerror/network failures/unexpected writes0. The consent
banner was actually visible. Healthy mobile390x520 to844x390 landscape passed.
Positive production physical-held slack was NOT_OBSERVED; root accepted the
explicit coverage limit using19 deterministic real-DOM controls and healthy
real resize. This is not a live positive held-release claim or device evidence.

The mandatory normal LOCAL pair on exact canonical8c4 assets passed slider2/2
and slider-perf37/37,0failed/skipped/flaky/retries. Its synthetic SSR-null
client fallback does not prove production SSR; separate canonical121HTML/86aliases
provides release evidence. Later changes were editor-only, with reader/slider
source unchanged. No new export, SSR flag or extra real Quest4 view was used.

The original184/8-suite source evidence remains historical; later editor fixes
have their own32/36/41 affected-suite results. The final focus-boundary old533f
RED had2 intended failures/3healthy passes; repaired suites41/41 and scoped checks
passed. No new184 run on42 is claimed. Full E2E TypeScript remains NOT PASS:
6 legacy errors in3 unchanged specs, no task-owned diagnostics. The failed
pre42 runs and receiving/recovery histories remain intact. This checkpoint
supersedes their pending runtime status, without changing those observations.

Root accepted V10 against immutable run SHA
`255e0787e3e73adb64819319b7b9e7db39c2311e85f6f5ce4d6bedfb028a488c`.
Board Done is a later coordinator action after normal docs publication/readback;
this archived engineering record does not claim that administrative action.
