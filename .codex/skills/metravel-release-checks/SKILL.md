---
name: metravel-release-checks
description: Choose and run the correct metravel verification flow for local changes, PR-ready validation, governance-sensitive updates, release preparation, and production web checks. Use when Codex must decide which commands to run after code changes or before deploy, and must not leave known real failures unresolved in this repository.
---

# Metravel Release Checks

`AGENTS.md` is inherited. Load only the changed surface's validation commands
and the exact operation/release heading required by the planned check.

For checks involving AWS, cloud PDF render, or paid APIs, apply
`docs/WORKFLOW_OPERATIONS.md` → `3.4.1 Платные ресурсы и AWS` before any paid
call. A required QA gate does not authorize spending; use the local contract
checks and report the separate owner/runtime gate.

Select checks by change scope instead of defaulting to the heaviest run every time:

- With multiple live sessions, transfer a finished implementation and all remaining checks to the active/next delivery owner under `docs/RULES.md` → «Delivery-owner handoff across sessions»; the sender closes after acceptance instead of waiting for a quality slot. The receiving session owns this validation run and subsequent release/QA.
- Before starting release/build/test commands, apply the operation coordination rule from `AGENTS.md`/`docs/RULES.md`. When a test/quality gate is already active, stop your duplicate launch without waiting, polling, bypassing, or retrying. `validation delegated/skipped: active gate pid/name` is coordination only. The delivery owner obtains the actual result and resumes acceptance; an accepted handoff lets only the sending session close, never substitutes for evidence or marks the task done.
- Small finished logical block: prefer `npm run check:fast`.
- Need to inspect the selective plan first: use `npm run check:fast:dry`, `npm run check:changed:dry`, or `npm run check:e2e:changed:dry`.
- Medium change touching a bounded area: run the relevant targeted tests plus the matching selective checks.
- Large, cross-cutting, or infrastructure-heavy change: run `npm run lint` and `npm run test:run`.
- Any failed check that points to the touched scope must be fixed and rerun before release; declare it explicitly if transferring unfinished work to the delivery owner.
- If a failed check exposes an unrelated existing issue, record the failing command, concrete failure, risk, and reason it was not fixed in this task.

Use the project-specific command map:

- External-link or governance-sensitive changes: run `npm run guard:external-links` or `npm run governance:verify`.
- App-owned locale resources, UI copy, providers/storage, formatting or SEO locale
  contracts: run `npm run test:i18n` plus affected feature checks. Editorial/API
  translations use the relevant content/data validators instead.
- Before code review, run static/unit/guard checks only. Run
  `npm run check:preflight` after review in `testing`, where its e2e portion is
  allowed.
- Changes in travel/search/map/account/messages flows that need browser smoke
  coverage use `npm run check:e2e:changed` only in `testing`.
- After code review in `testing` or an authorized release-validation stage,
  select `npm run android:release:check` or `npm run ios:release:check` for native.
  Use `npm run release:check` for the full web and repository gate.

Keep release and performance validation aligned with repo policy:

- Build web for production checks with `npm run build:web:prod`.
- Android EAS/cloud builds and submits are disabled. Android QA uses the assigned
  local emulator/device build; an active Android production release uses the local
  Gradle/production-only Play path from `$metravel-google-play-operator`.
- Select targets, scope and reusable results with `docs/TESTING.md` →
  `Risk-based validation and evidence reuse`. A deploy adds a narrow smoke;
  repeat a complete flow only for a relevant change or explicit release gate.
  Do not infer native readiness from a web viewport.
- Route explicit signed iPhone build, App Store Connect upload, TestFlight
  mutation, App Review submit, or storefront release to
  `$metravel-ios-release-operator`; each stage needs its own authorization.
- Route explicit Google Play build/submit/track work to `$metravel-google-play-operator`; release-checks may prepare gates but must not infer store mutation authority.
- Treat deploy execution and rollback as `$metravel-devops-agent` work, not release-checks work.
- For production deploy command selection, defer to `docs/RELEASE.md` and `$metravel-devops-agent`.
- Resolve workstation-specific transport through `docs/RELEASE.md` →
  `Deploy transport depends on the machine: check rsync first`; never assume
  a historical Windows wrapper exists on the current host.
- Emergency frontend recovery has no separate script (`scripts/fix-prod.sh` was removed in #3209): route it to `$metravel-devops-agent` and the runbook in `docs/WORKFLOW_OPERATIONS.md` → «Аварийный возврат прошлой версии» (`rollback-code`, forward fix, explicit `ALLOW_DOWNGRADE=1` rollback).
- Run Lighthouse against a production build or the real production URL, never against a dev server.
- Use post-deploy checks against the real site after release, for example `npm run test:seo:postdeploy`.
- Do not reintroduce service worker runtime/static caching or any user-facing "clear cache" workaround.

Account for UI-specific completion rules:

- For responsive/visual changes, hand mobile-web then desktop-web scenarios to
  `testing`, with screenshots and console checks for changed states. Shared
  behavior without a viewport difference needs one representative flow.

Stay within repo workflow boundaries:

- Run commands from the repo root.
- Prefer scope-based code checks after each logical step. After code review,
  repeat the appropriate runtime/e2e/device checks in `testing`.
- Treat `npm run typecheck` as an explicit wider audit for larger refactors or debt cleanup, not as the default after every tiny edit.
