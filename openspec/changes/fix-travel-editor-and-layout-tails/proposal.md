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
