---
name: metravel-release-checks
description: Choose and run the correct metravel verification flow for local changes, PR-ready validation, governance-sensitive updates, release preparation, and production web checks. Use when Codex must decide which commands to run after code changes or before deploy, and must not leave known real failures unresolved in this repository.
---

# Metravel Release Checks

`AGENTS.md` is inherited. Load only the changed surface's validation commands
and the exact operation/release heading required by the planned check.

Select checks by change scope instead of defaulting to the heaviest run every time:

- Before starting release/build/test commands, apply the operation coordination rule from `AGENTS.md`/`docs/RULES.md`. When a test/quality gate is already active, stop your duplicate launch without waiting, polling, bypassing, or retrying. `validation delegated/skipped: active gate pid/name` is coordination only. Request the owner result and resume acceptance; never close or park from delegation, and never substitute it for deploy/build/browser/API/device evidence.
- Small finished logical block: prefer `npm run check:fast`.
- Need to inspect the selective plan first: use `npm run check:fast:dry`, `npm run check:changed:dry`, or `npm run check:e2e:changed:dry`.
- Medium change touching a bounded area: run the relevant targeted tests plus the matching selective checks.
- Large, cross-cutting, or infrastructure-heavy change: run `npm run lint` and `npm run test:run`.
- Any failed check that points to the touched scope must be fixed before handoff and then rerun.
- If a failed check exposes an unrelated existing issue, record the failing command, concrete failure, risk, and reason it was not fixed in this task.
- Store temporary check logs, screenshots, traces, JSON reports, and other debug output only in ignored local folders such as `.codex-temp/` or `.codex-debug/`; delete stale or unnecessary artifacts before final handoff.

Use the project-specific command map:

- External-link or governance-sensitive changes: run `npm run guard:external-links` or `npm run governance:verify`.
- Localization, app-owned UI copy, locale provider/storage, formatting, or SEO
  locale changes: run `npm run test:i18n` plus the affected feature checks.
- Before code review, run static/unit/guard checks only. Run
  `npm run check:preflight` after review in `testing`, where its e2e portion is
  allowed.
- Changes in travel/search/map/account/messages flows that need browser smoke
  coverage use `npm run check:e2e:changed` only in `testing`.
- Full release confidence: run `npm run release:check` only after code review in
  `testing` or an explicitly authorized release-validation stage.

Keep release and performance validation aligned with repo policy:

- Build web for production checks with `npm run build:web:prod`.
- Android EAS/cloud builds and submits are disabled. Android QA uses local
  build/install on USB; an active Android production release uses the local
  Gradle/production-only Play path from `$metravel-google-play-operator`.
- Common/shared responsive app changes need desktop-web and mobile-web browser
  evidence in `testing`. Require local USB Android evidence only there for Android-specific
  observable behavior/configuration/runtime and the appropriate
  simulator/physical-iPhone/TestFlight layer only for iOS-specific scope. Do not
  infer native readiness from a web viewport.
- Route explicit signed iPhone build, App Store Connect upload, TestFlight
  mutation, App Review submit, or storefront release to
  `$metravel-ios-release-operator`; each stage needs its own authorization.
- Route explicit Google Play build/submit/track work to `$metravel-google-play-operator`; release-checks may prepare gates but must not infer store mutation authority.
- Treat deploy execution and rollback as `$metravel-devops-agent` work, not release-checks work.
- For production deploy command selection, defer to `docs/RELEASE.md` and `$metravel-devops-agent`.
- On this Windows/Codex machine the final production deploy command is `bash /d/metravel/ops/deploy-frontend.sh`, not repeated retries of `./build-prod.sh prod`.
- Use `scripts/fix-prod.sh` only as a documented emergency frontend recovery path through `$metravel-devops-agent`, after recording why the normal deploy path is unavailable or unsafe.
- Run Lighthouse against a production build or the real production URL, never against a dev server.
- Use post-deploy checks against the real site after release, for example `npm run test:seo:postdeploy`.
- Do not reintroduce service worker runtime/static caching or any user-facing "clear cache" workaround.

Account for UI-specific completion rules:

- If a task changes visible common/shared UI, hand desktop/mobile browser
  scenarios to `testing`. Run local USB Android or iPhone flow there only when
  that platform has specific observable scope.
- In `testing`, confirm the desktop/mobile-web states with screenshots and no
  new console errors.

Stay within repo workflow boundaries:

- Run commands from the repo root.
- Prefer scope-based code checks after each logical step. After code review,
  repeat the appropriate runtime/e2e/device checks in `testing`.
- Treat `npm run typecheck` as an explicit wider audit for larger refactors or debt cleanup, not as the default after every tiny edit.
