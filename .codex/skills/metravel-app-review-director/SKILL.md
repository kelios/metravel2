---
name: metravel-app-review-director
description: Prepare Apple App Review device video after passing E2E tests and freeze scene scripts for an exact TestFlight candidate. Use for Apple demo/video requests and registration, sign-in, moderation or deletion evidence on iPhone/iPad.
---

# Metravel App Review Director

Coordinate passing E2E → frozen scene handoff → physical capture → evidence.
Use `$metravel-test-writer` / `$metravel-ios-tester` for missing tests or failures,
`$metravel-scenario-recorder` for prepared capture, then the editor and packager.
The director can execute a prepared scene under the recorder contract; recording
does not include product/debugger investigation, video editing or store actions.

`AGENTS.md` is inherited. Operational contracts:
`.claude/skills/ios-device-qa/SKILL.md` (driver, private input, TCC),
`docs/WORKFLOW_OPERATIONS.md` → «3.1 E2E окружение» (accounts, activation)
and «3.2.1 iOS testing and release operations» (operation gate),
`docs/CODEX.md` → `Media-agent dispatch` (checkpoint, retry, output limits).

## 1. Candidate and devices

1. Fix the candidate from App Store Connect/TestFlight: `version (build)`,
   source SHA, IPA SHA-256 if archived. Video of any other build is invalid.
2. `source scripts/ios-device-qa.sh` (bash), inventory devices and select the
   next active target. Prepare its command/capture/input channel before asking
   for unlock; never require both devices unlocked at once. Verify installed
   version/build and provenance; record model/OS, never UDID.
3. Select the primary device from the current candidate requirement and verified
   OS state; historical model/OS snapshots do not select today's target. Run the
   assigned compatibility cases on the other family without duplicating every
   scene unless the Task Contract explicitly requires both.
4. Take a crash-report baseline before the first scene and diff it after the
   last one.

## 2. Accounts

- Permanent reviewer demo: `APP_REVIEW_DEMO_EMAIL`/`APP_REVIEW_DEMO_PASSWORD`
  in `.env.e2e`. It is the account Apple has; use it only for the `login`
  scene, never delete it, never print it, never put it in a scene name,
  `QA_SCRIPT`, screenshot, tree, board or doc.
- Disposable account for `register` → `account-delete`: Gmail plus-addressing
  on the demo mailbox, `<demo-local-part>+appleqa-<YYYYMMDD>-<n>@gmail.com`,
  with a fresh password generated into a private `0600` file. The activation
  mail lands in the demo mailbox; activation is either the owner/main session
  tapping the link in the open Gmail tab, or the documented database-token
  recipe (`POST /api/user/confirm-registration/`) executed during a labelled
  cut. Neither path types the password through the model.
- Author for `ugc-report`/`ugc-block`/`ugc-flag-content`/
  `ugc-block-hides-content`: the existing `E2E_EMAIL2` user (public profile,
  trip, comment and message exist). Plan cleanup before report/block and retain
  exact created ids. Perform cleanup and verify moderation/notification state per
  `docs/WORKFLOW_OPERATIONS.md` → «Уборка тестовых жалоб и модерационных заявок»;
  handing ids to the owner is not cleanup.
- Prepare only the test fixtures and account actions authorized for this batch;
  report/block also mutate production state. Restore toggles and report cleanup.
  The delete scene destroys only the disposable account; verify failed re-login.

## 3. E2E pass and frozen handoff

Follow `docs/TESTING.md` → `Apple video: E2E before capture` for the staged
handoff and shared stop budget. `scenes.json` next to the evidence skill is the
requirements catalog, not executable coverage. Map each assigned scene to its
complete tracked flow, business assertions and actual passing E2E result. A
mocked/unit result or a passing public auth segment cannot stand for the full
native flow. Missing coverage goes to the test author before device capture.

A matching full E2E pass is already the rehearsal; do not perform a second
identical rehearsal. Reuse valid proof under the canonical identity/24h rules.
Prepare replayable fixtures using the tested recipe: registration/deletion E2E
may have consumed its disposable account. Reset report/block state and retain
cleanup receipts before recording the same behavior with the assigned role.

Freeze `<out>/capture-handoff.json` with scene/script hashes, exact commands,
passing reports, assertions, setup/reset/cleanup, private cuts, capture deadlines
and inherited attempt counters. For each physical batch run
`node scripts/native-recording-readiness.js <plan.json>`; the command checks
existing proof, it does not run E2E. A failed/missing/mismatched proof blocks
capture. Recheck only if an input changes; do not rebuild/test per tap.

Secret input uses the verified private channel with capture stopped; canary
once per runner build, public assertions outside private mode. Keep notifications
out of frame; use the assigned locale (EN unless testing another). `purchases`
is N/A only with evidence of no paid features. Do not invent N/A to bypass a gap.

## 4. Capture the prepared scene

Verify the capture source/method once before the batch. Use QuickTime Movie
Recording with the physical device as camera and no microphone, or the device's
Screen Recording fallback, through supported automation. Prepare the helper,
input/canary, fixture reset and exact commands before the active-device unlock.

Start capture before the first public action, execute the same frozen script
and assertions with `tools/ios-device-uitests/run.sh`, then stop on the expected
committed-state acknowledgement. Save originals under
`.codex-temp/app-review-<date>/device/<model>/<id>.mov`; use a public model slug,
never the owner's device name. For a private interruption, stop and resume as
`<id>-a.mov` / `<id>-b.mov`, preserving and labelling the cut. Never record secrets.

Use event/postcondition waits, not a fixed sleep after a tap or an optimistic
counter. Any failed assertion or unexpected screen stops the attempt. Preserve
its evidence and hand it to the test owner; do not change selectors, probe CDP,
patch the helper or explore UI during recording. New agents inherit the same
failure/attempt checkpoint. A capture-only fault gets one corrected retake of
that scene; identical operational failures follow the shared stop budget.

Aim for 30–90s of useful footage and about three minutes of capture work per
prepared scene; track preparation and product-fix time separately. Keep a first
successful take, trim intact empty lead-in/tail in editing and do not reshoot
for cosmetic pacing. No post-take replay: use the capture run's assertion result
and recorded outcome. Do not hide an in-flow failure or claim success from only
the last frame. Run the media-report helper once per new raw file; unchanged
source hashes and completed scene results carry forward to the next actor.

## 5. Handoff

Write `<out>/checkpoint.json` (candidate, devices, scene → file, SHA-256,
script hash, E2E and capture assertion results, cut notes, attempt budget, next command) once per batch and immediately on failure, plus a per-device draft
manifest in the `$metravel-app-review-evidence` schema with real timecodes
from the raw files. Hand raw files to `$metravel-evidence-editor`; the final
manifest and privacy playback belong to `$metravel-app-review-evidence`.
Board: anonymised progress only (scene ids, file names, SHA, blocker).

Return at most 12 lines: candidate, devices/OS, scenes recorded/failed with
files, accounts used (masked), cleanup state, crash diff, checkpoint path,
next step.
