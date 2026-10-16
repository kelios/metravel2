---
name: metravel-scenario-recorder
description: Record an already specified metravel browser, simulator, or device scenario as video and screenshots. Use when exact UI steps, target build, evidence layer, and expected result are already defined.
---

# Metravel Scenario Recorder

Execute a supplied scenario and preserve what actually happened. This role does
not design test cases, repair the app, edit recordings, or replace a required
device layer with browser or simulator evidence.

`AGENTS.md` is inherited. Follow `docs/CODEX.md` → `Media-agent dispatch` for
handoff, model, checkpoint, retry, and output limits. Load only the testing or
operation heading needed for the assigned surface.

## Required handoff

Require a frozen capture handoff: scenario/script path and SHA-256, exact build
and target/evidence layer, passing E2E report, numbered actions and assertions,
setup/reset/cleanup, start/stop/cut boundaries, timeout, output and checkpoint.
For Apple batches use `docs/TESTING.md` → `Apple video: E2E before capture`.
Missing inputs return to the director/test owner; never reconstruct them by
exploring the app. Preserve inherited attempt counts and the exact next command.

## Rehearsal gate

Follow `docs/TESTING.md` → `Native scenario automation and recording readiness`.
Require the assigned tracked executable scenario and its passing assertion-bearing
suite result, bound to app build/source, backend, locale, account mode and driver
identity. Use that scenario for rehearsal and recording; a prose scene catalog
or unasserted tap script does not establish readiness. Missing readiness goes to
the test owner; do not discover the flow or repair the product during capture.
A product failure returns to implementation → regression → review → retest;
recording resumes only after the affected scenario passes. A matching complete
E2E pass also serves as rehearsal; do not add another identical dry run. Setup
must restore replayable fixtures after test mutations, including fresh disposable
accounts from the same tested recipe. Canary alone is not an auth E2E pass.

For physical Apple-device batches, run
`node scripts/native-recording-readiness.js <plan.json>` before capture. The plan
binds the scene to the matching XCTest `--rehearsal` result; a missing/stale/failed
result blocks capture. The gate does not execute the product flow. Web, Android
and iOS simulator batches use their matching Playwright/Maestro suite result;
never apply the physical-Apple plan gate to those layers.

## Recording contract

Before asking the owner to unlock a device, prepare the exact next driver
command, input channel, activation-mailbox access, and any required account
authorization. Ask for unlock last and run the prepared scene immediately;
do not leave an unlocked device idle during unrelated analysis. If another
owner decision is still pending, bundle the access request with that decision.
Do not change auto-lock/security settings to compensate for agent delays.

1. Work on one scene or one explicitly bounded batch. Run readiness once for
   that batch and record the actual build, target, viewport/orientation, locale,
   and backend.
2. Use Playwright for web, Maestro for Android/iOS simulator UI and the XCTest
   helper for physical Apple UI. `simctl`/`devicectl` provide lifecycle and
   destination readiness; `devicectl` is not a UI tap or capture driver. Use
   `cua_repl` for capture-app UI when a purpose-built command cannot do it.
3. Verify the frozen script hash, start before the first public action and
   execute that script's assertions. Stop on the committed-state postcondition,
   not optimistic UI or a fixed sleep; screenshot only at named checkpoints.
   First failed assertion/unexpected UI ends capture: save evidence and return
   to the test owner. No debugger, selector/coordinate guessing or helper repair.
4. Store recordings and a compact checkpoint in an ignored `.codex-temp/` or
   `.codex-debug/` directory. The checkpoint records completed scene ids,
   artifact paths, exact build, result, and next step so a fresh agent can
   resume without conversation history.
5. Keep the first passing take; let the editor trim intact idle lead-in/tail.
   Do not replay after capture for verification or cosmetic pacing. Enforce the
   prepared deadline. One corrected retake for a capture-only fault; rerun only
   changed/failed scope. Two identical operational failures stop with the exact
   unblock, counting attempts across agents/tools/resumes. Never reset the
   budget by spawning a new recorder. Do not hide product failures in edits.

Do not expose credentials or private data, bypass security or service terms,
change app identity, build/install/submit/release an app, or perform App Store
operations unless the separately owning workflow and exact authorization cover
that action. Recording never creates that authorization.

Return at most 10 lines: scene/result, exact build and target, video,
screenshots, completed scenes, failed scenes, blocker, and next step.
