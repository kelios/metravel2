---
name: metravel-evidence-editor
description: Inspect, redact, trim, join, and export existing metravel UI evidence with ffmpeg. Use for reviewer-ready videos, timestamps, privacy masking, source-integrity reports, and derived screenshots after recording is complete.
---

# Metravel Evidence Editor

Turn existing recordings into a reviewable derivative while preserving the
source and the distinction between observed behavior and editorial framing.
This role does not operate the app or claim that an unrecorded action occurred.
For Apple batches, follow `docs/TESTING.md` → `Apple video: E2E before capture`;
editing consumes the frozen handoff and capture results, not a fresh UI run.

`AGENTS.md` is inherited. Follow `docs/CODEX.md` → `Media-agent dispatch` for
handoff, model, checkpoint, retry, and output limits.

## Inputs and integrity

Require source paths, desired cuts/order, output profile, privacy regions or
review target, exact build, and output directory. Carry the scene/script hash,
E2E/capture assertion results, planned cuts and shared failure checkpoint forward.
Keep every source unchanged; missing flow coverage returns to the director/test
owner, never to an improvised recording session.
Before editing, run:

```bash
node .codex/skills/metravel-evidence-editor/scripts/media-report.mjs <source>
```

Save its SHA-256 and stream metadata beside the derivative. Reuse a completed
report only when its file hash and export inputs still match; do not re-probe,
re-export or request retakes merely because a new agent took over. Use `ffprobe` and
targeted timestamps or a small contact sheet for inspection; the helper aborts
if the source changes while it is being probed and hashed. Never dump every
frame into model context.

## Edit and export

1. Create an explicit timeline mapping each output segment to source path and
   source timestamps. Cut dead time, join assigned scenes, and add concise
   labels or timecodes only when requested. Empty leading/trailing preparation
   is an edit, not a reason to reshoot a passing scene. Do not trim an in-flow
   failed assertion or required wait to present the flow as successful.
2. Mask credentials, notifications, account identifiers, faces, or other
   assigned private regions with deterministic crop/blur/cover filters. Inspect
   boundaries around each mask; do not rely on a single still for a moving
   region.
3. Do not recreate taps, scrolling, device chrome, loading, success states, or
   missing steps. Cuts and labels must not make separate events look continuous
   when that changes their meaning.
4. Export the requested profile; for a general review MP4 use H.264,
   `yuv420p`, and `+faststart`, preserving source aspect ratio unless the target
   requires a documented crop. Verify the derivative again with the report
   helper and inspect duration, dimensions, codecs, and audio presence.
5. Store derivatives, report, and timeline manifest only in ignored evidence
   directories. A montage is presentation evidence; the source recording and
   exact-build binding remain the proof.

Rerun only failed exports or changed segments. After two identical ffmpeg or
filesystem failures, stop with the exact missing codec, permission, source, or
disk-space unblock. Inherit the checkpoint's attempts across agents and tools.
If footage is genuinely missing/invalid, return that scene id and boundary to
the director; do not request a fresh full app walkthrough.

Return at most 10 lines: output, source hashes, exact build, duration/profile,
timeline manifest, privacy checks, verification, blocker, and next step.
