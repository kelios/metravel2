---
name: metravel-google-play-operator
description: Prepare, locally build, submit, and verify metravel Android Google Play releases without EAS. Use for залей android, новую сборку в стор, обнови в сторе, android:build:prod, production commit, or owner-authorized alpha+internal testing updates.
---

# Metravel Google Play Operator

This is the Codex equivalent of the legacy Claude `android-builder`, `android-publisher`, and `android-release` workflows.

`AGENTS.md` is inherited. For the authorized stage, load only the Android
build/signing/Play sections of `docs/RELEASE.md`,
`docs/PRODUCTION_CHECKLIST.md`, and `docs/ANDROID_OWNER_GUIDE.md`, plus
`package.json`, `android/app/build.gradle`, and the owning release script.

## Authority Gates

- Android EAS/cloud build and submit are disabled. Never run an EAS Android or
  `--platform all` command; re-enabling requires a new explicit user decision.
- Execute only stages explicitly authorized in the current task. Build,
  upload/submit, and release authority do not imply one another; retain an
  authorization already given in the conversation without asking again.
- `beta`, testers, countries and staged rollout stay protected. `production`
  is writable only through `android:submit:production`. `alpha`+`internal` are
  writable only through `android:submit:testing` after an explicit owner request
  for testing tracks (see `docs/ANDROID_OWNER_GUIDE.md`). One wrapper never
  writes the other family.
- A status check uses a temporary Play edit and deletes it without commit.

## Current Release Contract

- Package: `by.metravel.app`.
- Use project-owned npm wrappers; Android build is local Gradle and Play upload is
  `scripts/android-play-release.js`.
- `app.json` is the version source. Release signing loads the portable
  gitignored `.secrets` bundle (keystore JSON, upload `.jks`, prod env, Play
  service account, and `google-services.json` for `by.metravel.app`) or the four
  `METRAVEL_ANDROID_KEYSTORE_*` overrides and must never fall back to debug key.
  Missing Firebase config fails the production build before Gradle (#1818).
- Dry-run validates and deletes the edit. Actual commit uses the matching
  wrapper for the authorized tracks only.
- Never print service-account JSON, keystore passwords, private keys, access
  tokens, or auth responses. Confirm credential files are ignored before use.

## Workflow

1. Preflight: confirm `main`, inspect `git status --short`, check the exclusive operation gate, run `npm run android:release:doctor`, verify local signing/service-account presence without exposing values, and record target `production`.
2. Before a release build, require the documented release checks and successful local USB Android smoke for the changed native scope.
3. For an authorized build, run `npm run android:prebuild` before `npm run android:build:prod` as required by `docs/RELEASE.md` → `Android`; verify the local AAB metadata/upload certificate.
4. If upload is authorized, dry-run the authorized family: `npm run android:submit:latest` for production, `npm run android:submit:testing:latest` for alpha+internal. Each loads the AAB into a temporary edit, validates, and deletes it. A build-only request stops with the verified local artifact.
5. If publication is explicitly authorized and the matching dry-run is green, commit with `npm run android:submit:production` and/or `npm run android:submit:testing`. Production is `completed` at 100% with no staged rollout.
6. Verify with `npm run android:play:status` that authorized tracks moved to the new versionCode and the other family did not. Do not trust submit output alone.
7. On `FAILED_PRECONDITION`, stop retries, confirm the temporary edit was deleted, and report the exact Play Console eligibility action.
8. Update only the relevant board ticket; do not mark release work done without production track evidence.

## Handoff

Report requested target, checks, artifact/versionCode/upload certificate, actual
production state, protected-track evidence, worktree changes, and remaining Play
Console actions. Never include secrets.
