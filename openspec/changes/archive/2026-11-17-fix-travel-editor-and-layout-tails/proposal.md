## Why

Task #3434 collects remaining article/editor issues after #3427/#3426/#3430.
Generated accessibility alt text is tracked by DOM identity, but real Quill
history/clipboard can recreate images and turn it into saved content. A retained
height can outlive a viewport change when neither runtime size nor scroll changes.

## What Changes

- Preserve generated-alt ownership across the real Quill model, history and HTML
  clipboard boundary; preserve deliberately authored alt, including identical text.
- Reconsider retained flow through the existing safe release transaction when the
  viewport or scroll owner resizes, without polling or moving visible content.
- Remove the unconsumed resource-prefetch export and clarify hook-test ownership.
- Resolve the remaining loading CLS, console, native-placeholder and QA104 fixture
  items using their original evidence requirements or a documented scope decision.

## Capabilities

### New Capabilities

- `travel-editor-layout-tail-controls`: editor provenance and safe retained-layout
  lifecycle regression controls.

### Modified Capabilities

None.

## Impact

Web editor and article layout; no API, publication-status or translation changes.
Native article rendering is unchanged and assessed at its existing branch boundary.
Production acceptance follows reviewed push and canonical deployment; the existing
packaging blocker #3442 is a separate release dependency, not proof of these fixes.


## Completion boundary — 17.11.2026

The containing42b release and actual V10 editor acceptance completed the selected
production gate. Earlier #3442 packaging dependency and pre42 failures are retained
in design history and are not current blockers. Internal focus moves now preserve
the native toolbar click; intentional empty content and local edits retain history
through delayed parent acknowledgement. The late client-only consent banner uses
its actual first-visible viewport. No public data/API, publication, analytics,
SEO contract or translation resources changed. Accessibility alt remains visible
while generated labels stay out of editorial content.

Platform impact: desktop web and mobile web; native article implementation
unchanged, assessed by forced-AI branch controls rather than a new device build.
Localization impact: none; existing RU/BE/UK/PL/EN labels and providers unchanged.
The positive production held-gap state was not observed; the documented
real-DOM/healthy-resize acceptance is explicit and does not claim that result.
