## Purpose

Keep the reader's visible article sections stable while lower asynchronous content grows or resolves empty, across mobile and desktop web geometry.

## ADDED Requirements

### Requirement: Stable following content during asynchronous geometry changes
The article SHALL preserve the viewport position of already-visible following sections when an earlier deferred section changes height at the same responsive width. It SHALL preserve the user's scrolling and SHALL NOT leave a permanent guessed-height empty tail.

#### Scenario: Nearby resolves empty
- **WHEN** the nearby loading frame resolves to its compact empty state while popular or related articles are visible
- **THEN** the visible following section retains its viewport position and the empty message remains accessible without a permanent loading-height gap

#### Scenario: Loaded upstream slot changes height
- **WHEN** an already-mounted lower content slot grows or shrinks above the reader's visible sidebar, comments or footer
- **THEN** those following sections retain their viewport position through the geometry update without double compensation from nested reserves

### Requirement: Full-scroll article CLS budget
The article SHALL keep cumulative layout shifts without recent input at or below 0.1 during five complete fresh guest traversals at both 390×844 and 1440×900. Its mobile Lighthouse performance median SHALL remain at least 60.

#### Scenario: Complete article traversal
- **WHEN** each fresh guest visit to the affected article waits six seconds, then sends 120 wheel steps of 500px separated by 200ms and observes another two seconds
- **THEN** the actual article scroll owner reaches its bottom with the resolved footer and every traversal has supported layout-shift observation and cumulative CLS at most 0.1
