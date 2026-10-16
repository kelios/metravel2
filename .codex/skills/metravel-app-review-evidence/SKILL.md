---
name: metravel-app-review-evidence
description: Assemble and verify the Apple App Review evidence package for an exact iOS candidate. Use for Guideline 2.1 "Information Needed" replies, reviewer demo video coverage, scene manifests, attachment/link readiness, and Reply/Notes consistency before an owner-authorized submit.
---

# Metravel App Review Evidence

Turn recorded device evidence into a package that answers Apple's actual
request for one exact candidate (`version (build)`, source SHA, device, OS).
This role does not record (`$metravel-scenario-recorder`), edit
(`$metravel-evidence-editor`), operate App Store Connect
(`$metravel-ios-release-operator`) or create accounts.

`AGENTS.md` is inherited. Follow `docs/CODEX.md` → `Media-agent dispatch`
for handoff and output limits. Working documents:
`docs/IOS_APP_REVIEW_RESPONSE_<date>.md` (answers) and
`docs/IOS_APP_REVIEW_DEVICE_EVIDENCE_<date>.md` (device protocol).

## Inputs

Require the Apple message text, exact candidate identity, the evidence
directory (ignored `.codex-temp/...`), the recorder/editor checkpoints, and a
scene manifest path. Carry the frozen capture handoff and E2E/capture results
for new recordings. If an input is missing, identify it and its owning role;
do not launch the app or ask for a new full recording to discover it.

## Scene coverage

`scenes.json` next to this file is the catalog Apple's 2.1 letter maps to.
Every `required: true` scene must have a `pass` entry with a real timecode in
the final video, or an explicit `notApplicable` entry with evidence (for
example `purchases`: no IAP in `package.json`/ASC record). "Button visible" is
not a pass: `account-delete` needs the confirmation and the failed re-login,
`ugc-report`/`ugc-block` need the observable result, `register` needs the
activated account signed in.

## Guideline sub-points

`scenes.json` → `guidelines` is the single list of App Review sub-points the
candidate must prove (1.2(a)–(e), 4.8, 5.1.1(v), 5.1.2(i)); it replaces any
prose checklist. A sub-point is proven only when every scene it names has
`result: "pass"` on this build and, when the catalog sets `attestation`, the
manifest carries an `attestations` entry with the same `build` and dated
evidence (backend SHA, production probe, `ios:artifact:audit` output, owner
confirmation). `notApplicable` scenes and attestations from another build never
prove a sub-point. One unproven sub-point blocks the package and the submit;
a new Apple guideline finding is added to `guidelines` with its scene or
attestation, not to a document.

Two evidence layers have equal weight when the build is visible in-frame:

- agent-driven: `$metravel-scenario-recorder` over the signed XCTest helper
  (`.claude/skills/ios-device-qa/SKILL.md`);
- owner-recorded: iOS Screen Recording on the physical device by the owner,
  following `docs/IOS_OWNER_GUIDE.md` → «Записать недостающие сцены App Review».

The recorder/director prepares authorized disposable accounts and the verified
private-input channel. Owner-recorded evidence is a fallback when that channel or
device access is unavailable, or when the owner chooses it; do not require the
owner to repeat an already authorized, automated scenario. This packaging role
never creates accounts or enters credentials.
The permanent reviewer demo account is never deleted; deletion uses a
disposable account created for that purpose.

## Automation versus video coverage

Use `docs/TESTING.md` → `Native scenario automation and recording readiness`.
Keep the passing executable-suite result and its app/source, backend, locale,
account mode and driver identity beside the scene manifest. A descriptive scene
catalog or valid video manifest does not prove regression coverage. For new
capture, enforce `docs/TESTING.md` → `Apple video: E2E before capture`: every
assigned scene needs matching complete E2E proof before it is recorded, plus
successful assertions in the capture run. Owner-recorded fallback is not a
bypass. Reject an optimistic count/last frame as a substitute for completion.

Keep two results separate: candidate video/guideline coverage and reusable E2E
coverage. Existing immutable footage may be valid evidence while automation is
missing; report that gap without calling E2E passed or requesting an identical
retake. New missing scenes return to the test owner/director before capture.
Recheck only the changed file/scene/input, not a full app walkthrough.

## Manifest and verification

The manifest follows the Task Contract of the video card:

```json
{
  "version": "1.0.5", "build": "9", "sourceCommit": "<sha>",
  "device": "iPad mini 6", "osVersion": "iPadOS 26.6.2",
  "recordedAtISO": "2026-09-12T13:05:00Z",
  "video": { "path": "device/final.mp4", "sha256": "<hex>", "audio": false },
  "scenarios": [ { "id": "launch-cold", "result": "pass", "videoTimecode": "00:00" } ],
  "notApplicable": [ { "id": "purchases", "reason": "no IAP", "evidence": "package.json; ASC Free" } ],
  "attestations": [ { "id": "1.2(d)", "build": "9", "evidence": "backend <sha>; moderator mail 2026-09-12 for the recorded block" } ]
}
```

Run before any external handoff:

```bash
node .codex/skills/metravel-app-review-evidence/scripts/scene-manifest-check.mjs <manifest.json>
```

It verifies required coverage, proof of every guideline sub-point, monotonic timecodes inside the probed
duration, the SHA-256 of the video, H.264 4:2:0 profile and the audio
declaration, then prints the coverage table. It cannot certify privacy: a
continuous full playback of the final file with frame-level inspection of
every input, notification, and account-identifier interval is a separate,
recorded step. Cache that recorded privacy verdict by exact final-video hash;
reuse it only while the file, candidate and review scope are unchanged. Editing
or replacing the file invalidates it; a media/schema pass never creates it.

## Delivery and text consistency

1. Attach the file through App Store Connect review attachments or a link
   that opens from a signed-out browser session; never a local path.
2. The Reply names file, device, OS, date, `version (build)` and real
   timecodes per scene; planned timestamps are never presented as recorded.
3. Every scene named in Reply/Notes has a manifest entry; Notes stay within
   the 4000-character App Review Information limit; demo credentials live only
   in ASC protected fields.
4. Each of Apple's numbered questions has one answer backed by exact-build
   source, ASC state, the manifest, or a dated owner confirmation. Unknown
   facts go to the owner card, never into the package as "not applicable".

For a "connection error" rejection, the package starts from the production
nginx log of the review window (Apple egress `17.x`, native UA
`CFNetwork`/`metravel/`): whether requests arrived, their statuses, the last
successful sign-in from Apple's network, external reachability and the
`IOS-16` IPv6-only pass. Reply with those facts and a request for the
reviewer's screenshot/console; do not resubmit the same candidate blind.

Package readiness never authorizes Reply, Notes, build, upload, submit or
release: each is a separate owner decision executed by the release operator.

Return at most 12 lines: candidate identity, coverage (required/passed/
missing/N-A), unproven guideline sub-points by id, manifest check result, privacy review status, delivery form,
text consistency, open owner decisions, next step.
