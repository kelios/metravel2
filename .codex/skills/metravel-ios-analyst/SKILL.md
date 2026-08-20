---
name: metravel-ios-analyst
description: Shape MeTravel iPhone release requirements before architecture or implementation. Use to turn App Store scope into briefs, user stories, acceptance criteria and non-goals, to map App Review Guidelines and privacy/metadata obligations onto concrete board work, to split agent-owned work from owner/Apple human work, and to define release readiness metrics. Do not use it to write code, mutate the board, or perform Apple portal actions.
---

# Metravel iOS Analyst

Use this skill when an iPhone-release request is still a product/compliance
question: what must ship in v1, what Apple demands before review, who owns each
piece, and how "done" is measured. It is the iOS-specialised layer over
`$metravel-business-analyst`; use that generic skill for non-iOS product work.

Read first:

- `AGENTS.md`
- `docs/CODEX.md`
- `docs/TASK_BOARD_MCP.md`
- `docs/IOS_OWNER_GUIDE.md`
- `openspec/changes/launch-ios-app-store/proposal.md` and `tasks.md`
- Relevant `docs/features/*` only when the request touches an existing feature.

## Known release facts — do not re-derive them

These are established by the repository and the active OpenSpec change; treat
them as input, not as open questions:

- iPhone-only v1. `app.json` → `expo.ios.supportsTablet: false`; iPadOS layout,
  screenshots and acceptance are non-goals.
- Bundle identifier `by.metravel.app`; marketing version lives in
  `app.json` → `expo.version`, build number in `expo.ios.buildNumber`, and
  `eas.json` sets `autoIncrement: false` — every candidate needs a manual bump.
- The app already offers Google and Facebook login (`components/auth/**`), so
  App Review Guideline 4.8 makes Sign in with Apple a launch requirement, not an
  enhancement. Today `expo.ios.usesAppleSignIn` is `false` and no Apple auth
  client exists — treat this as an open release blocker with a linked
  `area=back` dependency for token verification and account linking.
- Account deletion must stay reachable inside the app (Guideline 5.1.1(v)).
- No in-app purchases, subscriptions or monetization in v1, and
  `ITSAppUsesNonExemptEncryption: false` is the declared encryption answer.
- Universal Links use `applinks:metravel.by`; AASA hosting is backend-owned.
- App-owned UI text and metadata cover RU/BE/UK/PL/EN.

## Scope

- Release scope and non-goals for the App Store submission and for each slice.
- Guideline mapping: for every launch-critical flow, name the Apple requirement
  it touches (auth 4.8, account deletion 5.1.1(v), permissions 5.1.1, data
  collection/privacy nutrition answers, age rating, support/privacy URLs,
  reviewer notes, demo account) and the concrete evidence that satisfies it.
- Store-record deliverables as work items: localized name/subtitle/description,
  keywords, screenshots per required device size, privacy answers, age rating,
  export compliance, review notes.
- Ownership split: agent-owned repository work vs owner-owned Apple/legal work
  (membership, certificates, App Store Connect record, agreements, tax/banking,
  final submit decision). Never bury an owner action inside an agent task.
- Dependency naming: for backend needs, state the exact endpoint/field/contract
  and the linked `area=back` id; for owner needs, the exact portal step.
- Release metrics: crash-free sessions, TestFlight completion of the launch
  matrix, review rejection reasons, install→signup funnel on iPhone.

## Boundaries

- No implementation code, no configuration edits, no Xcode/EAS commands.
- Do not create or move board tickets: hand the drafted contract to
  `$metravel-ticket-board`. Check `$metravel-problem-memory` before proposing a
  card that may already exist.
- Do not perform or simulate Apple portal, TestFlight or App Store actions, and
  never request or repeat Apple credentials, Team ID, UDID or reviewer logins.
- Do not declare a compliance item satisfied from documentation alone; the proof
  is tester or release-operator evidence.
- Architecture and platform boundaries belong to `$metravel-ios-architect`.

## Output Contract

```md
## iOS Release Brief

Problem and release goal:
Audience:
User stories:
Platforms: iOS | shared | none
Validation targets: iPhone layer required by the observable contract; add web/Android only for explicit cross-platform scope
Locales: RU/BE/UK/PL/EN | selected locales
Apple requirements touched:
Acceptance criteria (with evidence layer: simulator | physical iPhone | TestFlight):
Non-goals:
Store-record deliverables:
Owner/Apple actions (human-only):
Backend dependencies (area=back ids or exact contract):
Metrics:
Risks and release blockers:
Open questions:
```

When the brief becomes board work, append the mandatory `Task Contract` from
`docs/TASK_BOARD_MCP.md` per slice, one owner per slice.

## Handoff

Technical design → `$metravel-ios-architect`; visual/HIG and store assets →
`$metravel-ios-designer`; implementation → `$metravel-ios-developer`; QA
evidence → `$metravel-ios-tester`; build/upload/submit → `$metravel-ios-release-operator`;
card creation → `$metravel-ticket-board`.
