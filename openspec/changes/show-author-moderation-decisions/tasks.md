## 1. Read-only feedback model and persistence boundary

- [x] 1.1 Add optional decision/reason/date types and safe profile/editor normalization; preserve explicit invalid canonical values and old-response fallback.
- [x] 1.2 Add the shared canonical-first feedback model and table-driven coverage for rejected/null/approved/unknown decisions with all current states, including unpublished historical approval and stale pending rejection.
- [x] 1.3 Exclude all three historical metadata fields from ordinary full/content writes; keep the explicit reject reason command and existing Save ≠ moderate semantics.
- [x] 1.4 Make authoritative server reads/full-save responses and draft recovery overwrite all three historical local metadata fields even when absent/null; preserve confirmed metadata across typed partial content responses, which do not own these fields, and cover the real merge/recovery path.

## 2. Reuse author UI and context

- [x] 2.1 Compose the shared passive status/feedback into the existing wizard current-status summary; correction invokes existing first-step navigation without saving, submitting, or selecting moderation.
- [x] 2.2 Add explicit authored-context opt-in plus owner-id check to profile authored tabs and `/metravel`; render bounded private feedback in the existing card cell outside the article anchor, retaining canonical filters/navigation and uniform collapsed geometry.
- [x] 2.3 Add canonical publication state, legacy publish/moderation, and decision/reason/date to the existing card memo comparator so modern and old-response refetch renders a new decision or server clear.
- [x] 2.4 Reuse InfoSheet for full plain-text reasons; two-line preview, full-text access without character-threshold gating, long text wrapping, short/empty fallbacks, qualified valid dates for draft+rejected and published+approved, close/focus return, and reset on record/context change.
- [x] 2.5 Add/reuse reactive app-owned travel labels and accessible actions in RU/BE/UK/PL/EN, with validated dates formatted through the shared locale utility.

## 3. Code-level validation and independent review

- [x] 3.1 Run focused Jest for normalization/model/UI/memo/recovery/writes, role/public-context negative cases, partial-save/clear semantics, and zero-write correction actions; retain #2693 status persistence regressions.
- [x] 3.2 Run scope-appropriate lint/typecheck/guards, `npm run test:i18n`, and docs/prompt audit under the agreed shared quality slot, without browser/API runtime in review.
- [ ] 3.3 Complete mandatory independent full-task review-and-fix and code-review gate; rerun affected code checks after real findings.
- [ ] 3.4 Confirm the owned OpenSpec change passes strict validation and its normative design matches the final implementation before the root's reviewed commit/push and testing transition.
- [ ] 3.5 Repair the acceptance-discovered portal hover boundary through the existing DOM/CSS channel, retain shared lift tokens and hoisted-action alignment, and add a deterministic real-portal regression before reviewed rollout.
- [ ] 3.6 Repair the reviewed collapsed-height gap across independent rows and mobile cards with a common authored feedback minimum, preserving actual labels, bounded reason preview, and absent-field semantics; cover mixed canonical states.

## 4. Testing-stage production Done gate

- [ ] 4.1 After the root's штатный frontend rollout, verify deployed SHA contains the reviewed task commit; use a disposable ordinary author and authorized QA superuser, never real author content.
- [ ] 4.2 Capture real private detail/list API and save/submit request-response evidence: approve one fixture, reject another with a long reason, preserve rejected feedback after ordinary save, and clear it only after explicit confirmed resubmission.
- [ ] 4.3 Run browser acceptance on both author surfaces at 1440px/390px across RU/BE/UK/PL/EN: rejected short/long/empty reason, valid/invalid date, published/approved/pending, historical approval on draft, missing decision, loading/error; capture screenshots, console, and network.
- [ ] 4.4 Verify light/dark, keyboard/touch, full reason and close/focus return, no horizontal overflow/nested controls/grid reflow, positive desktop card/action lift and automatic resting bounds with an outside pointer after portal close (without an extra enter/leave gesture), and no mutation merely from correction navigation.
- [ ] 4.5 Verify public/catalog/other-viewer privacy and record/account changes, reload truthfulness, and clean up disposable fixtures/side effects with readback.
- [ ] 4.6 Record only factual Done-gate results. Reconcile completed tasks, run strict owned validation and `openspec validate --all` before archive; record unrelated foreign failures without changing their scope, then complete root's archive/board handoff.
