---
name: metravel-google-play-operator
description: Prepare, build, submit, promote, and verify metravel Android releases in Google Play, including EAS production AAB status, closed-testing track verification, versionCode checks, store readiness, and release blockers. Use only for an explicit Android/Google Play build, submit, publish, promote, or status request. Never consume EAS quota, submit, or promote to production without explicit authority in the current task.
---

# Metravel Google Play Operator

This is the Codex equivalent of the legacy Claude `android-builder`, `android-publisher`, and `android-release` workflows.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/RELEASE.md`
- `docs/PRODUCTION_CHECKLIST.md`
- `eas.json` and relevant `package.json` scripts as the current source of truth

## Authority Gates

- Status/readiness checks are read-only and may run when requested.
- Run an EAS build, submit, track mutation, rollout, or promotion only when the user explicitly requested that exact action and target in the current task.
- `production` means the public Play track and requires separate explicit authority; do not infer it from “release” or “publish a test build.”
- Android device QA defaults to a local USB build. Do not burn EAS quota for testing.

## Current Release Contract

- Package: `by.metravel.app`.
- Use project-owned npm wrappers from `package.json`; do not invent direct upload or ad-hoc credential scripts when a repository path exists.
- Treat `eas.json` as authoritative for profile, artifact type, credentials path, and track. The intended closed-testing track is `alpha`; `internal` does not update closed testers.
- Production Play accepts a new AAB/versionCode. If a built version already exists in another track, verify whether promotion is sufficient before rebuilding or resubmitting.
- Never print service-account JSON, private keys, EAS tokens, or auth responses. Confirm credential files are ignored before use.

## Workflow

1. Preflight: confirm `main`, inspect `git status --short`, check the exclusive operation gate, verify EAS identity and credential presence without exposing values, and record the requested target.
2. Before a release build, require the documented release checks and successful local USB Android smoke for the changed native scope.
3. Only with explicit build authority, run the project production AAB wrapper and monitor the returned build id/status.
4. Only with explicit submit authority, submit the intended build through the project wrapper.
5. Verify the actual Play track and versionCode through a read-only Play/EAS status path. Do not trust submit output alone.
6. If the version landed outside the requested test track, stop unless promotion was explicitly authorized; do not rebuild merely to move the same versionCode.
7. Update only the relevant board ticket when one was provided; do not mark release work done without track evidence.

## Handoff

Report requested target, checks, build id/versionCode, actual track state, submit/promotion result, worktree changes caused by tooling, and remaining owner/Play Console actions. Never include secrets.
