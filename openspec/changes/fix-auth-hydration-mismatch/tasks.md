## 1. Reproduce on the failing build

- [ ] 1.1 Check for a live `.codex-temp/ops/quality-gate.lock` and for a running build/deploy of the same target before starting; if one is active, record `validation skipped: <pid>/<name>` and stop instead of launching a second build.
- [ ] 1.2 Build the reproducing artifact with `npm run build:web:prod` (minified, production config, `dist/prod`) and serve it with the `Prod Static` launch (`.claude/prod-server.js`, root `dist/prod`).
- [ ] 1.3 Save the prerendered `login.html` and `registration.html` from that build into an ignored folder and record for each: byte size, the presence of the auth form markup, the `noindex, nofollow` robots directive, the canonical URL, the count of visually hidden `h1` elements, and the exact social-block subtree.
- [ ] 1.4 Open `/login` and `/registration` from that build at 390, 1280 and 1440 widths and record the baseline error inventory — every React hydration error (#418/#419/#423/#425 and the unminified "Hydration failed" text) and every uncaught page error — separately for the settled state and for the state after a first interaction (focus email, type, toggle password visibility).
- [ ] 1.5 Record the baseline layout shift and a baseline screenshot of the social block for each route and width, so the "no visual redesign, no new shift" claim can be proved later.

## 2. Localize the exact mismatch

- [ ] 2.1 Capture the `#root` subtree of both routes before the bundle executes and again after hydration settles, then diff the two and identify the first structural divergence.
- [ ] 2.2 Resolve the recorded hydration error against the export's module boundaries; a temporary local build with React development warnings may be used only as a diagnostic and must not become part of the deliverable.
- [ ] 2.3 Confirm or eliminate each ranked candidate from `design.md` Decision 2 (C1 raw DOM children inside the emitted `<button>`, C2 the Facebook placeholder-to-control swap, C3 the `useIsFocused`-gated metadata subtree, C4 early availability recomputation, C5 the icon/font race, C6 the width-dependent background), stating for each whether it is the cause, a contributing factor, or excluded, with the observation that decided it.
- [ ] 2.4 Reproduce the confirmed divergence in isolation by rendering the affected component through the project's server-render path and comparing that string with its first client render, using the real `components/auth/GoogleSignInButton.web` / `components/auth/FacebookSignInButton.web` modules and no mock of the hydration boundary.
- [ ] 2.5 Write the confirmed root node and mechanism into this file as a dated note before any product code changes. If the confirmed cause lies outside the auth social block, stop and revise the OpenSpec design instead of widening the edit set.

## 3. Lock the contract with a failing test

- [ ] 3.1 Add a focused render-equality test that compares the project's server-rendered string for the auth social block with its first client render, importing the real `.web` modules explicitly (Jest otherwise resolves `components/auth/GoogleSignInButton.tsx`, whose web branch has no hydration gate).
- [ ] 3.2 Cover in that test the three availability inputs that change structure: a configured Google client id, an empty Google client id, and the Facebook rollout flag both enabled and disabled; assert identical element structure, order, types and text in every case.
- [ ] 3.3 Confirm the new test fails on the current code for the confirmed cause and passes for the cases that already agree, so it is proven to be a real guard rather than a tautology.

## 4. Fix the mismatch

- [ ] 4.1 Apply the minimal fix in `components/auth/GoogleSignInButton.web.tsx` and/or `components/auth/FacebookSignInButton.web.tsx` so the server render and the first client render emit the same element with the same children, and only attributes, styles or the provider mount change afterwards.
- [ ] 4.2 Keep `useHydrationReady` as the single owner of that decision for both controls; do not add a second gate, do not pass `clientOnly` (both nodes exist in the prerendered HTML), do not add `suppressHydrationWarning`, and do not add any reveal timer.
- [ ] 4.3 Preserve the Google control's `aria-label`, button semantics, disabled/busy state, ≥44 px target, and a real element the Google SDK can mount its own button into; preserve the Facebook placeholder geometry (full width, 48 px min height, same radius) and the control's label, disabled/busy semantics and `testID`.
- [ ] 4.4 Correct the stale comment in `components/auth/GoogleSignInButton.web.tsx` that describes a `useSyncExternalStore` handoff the code does not implement, so the documented contract matches the hook actually used.
- [ ] 4.5 Confirm `components/auth/LoginForm.tsx` and `components/auth/RegistrationForm.tsx` are unchanged; if measurement proves a form-level edit is unavoidable, stop and revise the OpenSpec design before proceeding.
- [ ] 4.6 Re-run the focused tests from section 3 plus the existing `__tests__/components/auth/**` and `__tests__/components/login.test.tsx` until all pass with no `.skip`.

## 5. Extend the route regression guard

- [ ] 5.1 Extend `e2e/hydration-routes.spec.ts` so its matcher covers the whole hydration error family (#418/#419/#423/#425 and the unminified "Hydration failed" text) instead of #418 only, and so it also fails on any other uncaught page error for the auth routes.
- [ ] 5.2 Add a second assertion pass after a first interaction on `/login` and `/registration`, and run both routes at 390, 1280 and 1440 widths.
- [ ] 5.3 Point the guard at the minified production-config build via `E2E_BUILD_DIR=dist/prod` (or `E2E_NO_WEBSERVER=1` plus `BASE_URL` against a running `Prod Static` server), and record in the spec that the default `dist/` build does not cover the reproducing conditions.
- [ ] 5.4 Do not copy the `#418` tolerance used in `e2e/quests-list-detail.spec.ts` into this guard, and do not weaken any existing assertion for `/places` or `/roulette`.
- [ ] 5.5 Run the guard through `scripts/run-with-quality-gate-lock.js`; treat a `SKIPPED` exit as coordination, never as a pass.
- [ ] 5.6 Run a negative probe: deliberately reintroduce the confirmed mismatch in a scratch copy, confirm the guard fails and names the affected route and viewport, then restore.

## 6. Validate the active platforms

- [ ] 6.1 Rebuild `dist/prod` after the fix and repeat the desktop-web trace at 1280 and 1440: zero hydration errors and zero page errors before and after the first interaction, social-block bounding boxes unchanged, layout shift not higher than the section 1 baseline, and a before/after screenshot pair proving no visual redesign.
- [ ] 6.2 Repeat the same trace on mobile web at 390 and confirm identical block order, control labels, touch targets and the same zero-error result.
- [ ] 6.3 Verify the preserved provider behavior: the Google control renders the provider's own button and completes the flow on the production host, the explicit unavailable-on-localhost fallback still appears on a loopback host with no override, the empty-client-id state still renders, and the Facebook control appears with the rollout flag enabled and is absent with it disabled.
- [ ] 6.4 Confirm from the rebuilt export that both routes still ship prerendered HTML with `noindex, nofollow`, their canonical URLs and exactly one visually hidden `h1`.
- [ ] 6.5 Run `adb devices -l`; with a device in `device` state, build and install the Android debug app locally and re-check the sign-in and registration screens for unchanged fields, block order, provider controls and touch semantics, with no new runtime error in the device logs. If no device is available, record the exact command, the result and `verify pending` with the blocker.
- [ ] 6.6 Run `npm run check:fast` (or the narrower relevant scope) through the quality-gate wrapper, fix every failure inside the task-owned scope, and classify any unrelated pre-existing failure without touching user-owned files.

## 7. Review and handoff

- [ ] 7.1 Run the mandatory `metravel-code-reviewer` review-and-fix pass over the complete task diff — correctness, duplication, reuse, unnecessary complexity and contract drift — preferably through a separate `review-auditor` agent, and fix confirmed findings inside scope without touching unrelated working-tree changes.
- [ ] 7.2 Re-review the resulting diff after the reviewer's fixes and re-run every affected automated check plus the desktop-web, mobile-web and Android scenarios.
- [ ] 7.3 Record the final evidence in this file: the confirmed root node and mechanism, the before/after error counts per route and width, the before/after layout-shift numbers, the prerendered-HTML facts, and the negative-probe result.
- [ ] 7.4 Run `openspec validate --all` and confirm this change passes strict validation.
- [ ] 7.5 Report the outcome as `local fix ready; production verification pending`; do not claim production resolution unless a separately authorized deploy is followed by a repeat of the live `/login` and `/registration` probe.
