---
name: metravel-ios-release-operator
description: Prepare, build, upload, and verify authorized MeTravel iPhone release candidates for TestFlight and App Store Connect. Use for signing and archive checks, version/build increments, EAS or approved local Xcode release paths, upload processing, TestFlight assignment, compliance state, App Review submission, and storefront release. Each external mutation requires its own explicit authorization.
---

# Metravel iOS Release Operator

Use this skill for the release/deploy portion of the active iPhone-first App
Store work. It does not implement product features.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/RELEASE.md`
- `docs/WORKFLOW_OPERATIONS.md`
- `docs/IOS_OWNER_GUIDE.md`
- `openspec/changes/launch-ios-app-store/`
- The assigned release task and current App Store Connect evidence.

## Independent Authorization Gates

Never infer one gate from another:

1. **Signed distribution build:** requires an explicit request to create the
   production/TestFlight candidate.
2. **App Store Connect upload/TestFlight mutation:** requires an explicit request
   to upload or assign the processed build.
3. **Submit to App Review:** requires the owner's explicit final release decision
   for the exact accepted build and store record.
4. **Storefront release/phased release:** requires a separate explicit decision
   after Apple approval when the configured release mode can affect users.

Local read-only preflight and source/archive inspection do not mutate store state.

## Fail-Closed Preconditions

- Work only from the canonical `main` source state and apply the operation gate
  before Xcode, EAS, archive, upload, or submission commands.
- Resolve the exact iPhone bundle identifier, marketing version, increasing
  build number, signing team/profile, entitlements, privacy manifest, production
  API origin, encryption/compliance state, and App Store Connect app record.
- Do not use placeholder Apple IDs, Team IDs, App Store IDs, credentials, dev
  server addresses, or an archive whose source revision cannot be identified.
- The current interactive `scripts/ios-build.sh` and `scripts/ios-submit.sh`
  include prompts and an auto-submit path; they are legacy helpers, not blanket
  publication authorization. Use only the canonical path selected and hardened
  by the active release task. Never use `--auto-submit` implicitly.
- Pin/verify the EAS CLI and Apple/Xcode upload requirements at execution time.
  If the approved EAS image cannot meet Apple requirements, use only the
  explicitly selected local Xcode archive plus Apple-supported upload fallback.
- Never print Apple passwords, 2FA codes, Team ID, UDID, `.p8`/`.p12`, private
  keys, provisioning profiles, API keys, reviewer credentials, or token values.

## Release Flow

1. Inspect branch/status, active release task, authorizations, competing locks,
   Apple/account prerequisites, and the latest used build number.
2. Confirm the accepted code/review/QA gates and exact production inputs.
3. Under signed-build authorization, create and inspect the archive/candidate;
   record source revision, bundle/version/build, signing, entitlements, privacy,
   embedded configuration, and artifact identity without secrets.
4. Under upload authorization, upload once, wait for processing without issuing
   duplicate uploads, answer only approved compliance fields, and record the
   exact processed build and App Store Connect state.
5. Hand that build to `$metravel-ios-tester`; release defects require a higher
   build number and a complete repeated candidate gate.
6. Under final submit authorization, select only the accepted build, verify
   metadata/privacy/screenshots/reviewer data, submit to App Review, and record
   the resulting state. Do not report Apple approval or public availability
   before App Store Connect shows it.

## Output Contract

Report requested gate, authorization received, source revision, version/build,
artifact and signing checks, commands/actions performed, TestFlight/App Store
state before and after, QA linkage, remaining owner actions, and residual risk.
