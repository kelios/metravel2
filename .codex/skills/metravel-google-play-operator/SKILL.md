---
name: metravel-google-play-operator
description: Prepare, locally build, submit, and verify metravel Android production releases in Google Play without EAS cloud quota. Protect closed-testing tracks, verify versionCode/upload signing, and report Play eligibility blockers.
---

# Metravel Google Play Operator

This is the Codex equivalent of the legacy Claude `android-builder`, `android-publisher`, and `android-release` workflows.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/RELEASE.md`
- `docs/PRODUCTION_CHECKLIST.md`
- `docs/ANDROID_OWNER_GUIDE.md`
- `package.json`, `android/app/build.gradle`, and Android release scripts

## Authority Gates

- Android EAS/cloud build and submit are disabled. Never run an EAS Android or
  `--platform all` command; re-enabling requires a new explicit user decision.
- Standing authority permits a local Android production build and Production
  submit when an Android production release is the active task. Do not infer
  store mutation from unrelated development or QA work.
- `alpha`, `internal`, `beta`, testers, countries and the active closed-testing
  release are protected. Never mutate or promote them through this workflow.
- A status check uses a temporary Play edit and deletes it without commit.

## Current Release Contract

- Package: `by.metravel.app`.
- Use project-owned npm wrappers; Android build is local Gradle and Play upload is
  `scripts/android-play-release.js`.
- `app.json` is the version source. Release signing loads the portable
  gitignored `.secrets/metravel-android-release.json` bundle (or the four
  `METRAVEL_ANDROID_KEYSTORE_*` overrides) and must never fall back to debug key.
- Only `production` is writable. Dry-run validates and deletes the edit; actual
  commit requires the explicit production wrapper.
- Never print service-account JSON, keystore passwords, private keys, access
  tokens, or auth responses. Confirm credential files are ignored before use.

## Workflow

1. Preflight: confirm `main`, inspect `git status --short`, check the exclusive operation gate, run `npm run android:release:doctor`, verify local signing/service-account presence without exposing values, and record target `production`.
2. Before a release build, require the documented release checks and successful local USB Android smoke for the changed native scope.
3. Run `npm run android:build:prod` and verify the local AAB metadata/upload certificate.
4. Run `npm run android:submit:latest`; it must validate and delete the temporary production edit without commit.
5. If dry-run is green and Play eligibility allows it, run `npm run android:submit:production`.
6. Verify production status/versionCode and confirm protected tracks were unchanged. Do not trust submit output alone.
7. On `FAILED_PRECONDITION`, stop retries, confirm the temporary edit was deleted, and report the exact Play Console eligibility action.
8. Update only the relevant board ticket; do not mark release work done without production track evidence.

## Handoff

Report requested target, checks, artifact/versionCode/upload certificate, actual
production state, protected-track evidence, worktree changes, and remaining Play
Console actions. Never include secrets.
