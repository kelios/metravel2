# travel-deferred-flow-stability Specification

## Purpose

Keep the reader's visible article sections stable while lower asynchronous content grows or resolves empty, across mobile and desktop web geometry.

## Requirements

### Requirement: Stable following content during asynchronous geometry changes
The article SHALL preserve the viewport position of already-visible following sections when an earlier deferred section changes height at the same responsive width. It SHALL preserve the user's scrolling and SHALL NOT leave a permanent guessed-height empty tail.

#### Scenario: Nearby resolves empty
- **WHEN** the nearby loading frame resolves to its compact empty state while popular or related articles are visible
- **THEN** the visible following section retains its viewport position and the empty message remains accessible without a permanent loading-height gap

#### Scenario: Loaded upstream slot changes height
- **WHEN** an already-mounted lower content slot grows or shrinks above the reader's visible sidebar, comments or footer
- **THEN** those following sections retain their viewport position throughout the update without an additional viewport jump or a permanent blank loading gap

#### Scenario: Excursions fallback resolves inside the map composition
- **WHEN** the existing Excursions fallback is replaced by its loaded section or that section grows again above Map/Points
- **THEN** Map/Points retain their viewport positions throughout the replacement and later content growth, while legitimate empty content leaves no reserved loading gap

#### Scenario: New nested content in a placeholder replacement
- **WHEN** a loading placeholder is replaced by its first real content containing a newly appearing nested section
- **THEN** an already-visible following section retains its viewport position and newly inserted content is not treated as the reader's previous position
- **AND** when no following reading frame is visible, the new section still takes its natural height without an unexpected scroll; later resizing and empty-content resolution preserve the reader's position without double movement

### Requirement: Full-scroll article CLS budget
The article SHALL keep cumulative layout shifts without recent input at or below 0.1 during five complete fresh guest traversals at both 390×844 and 1440×900. Its mobile Lighthouse performance median SHALL remain at least 60.

#### Scenario: Complete article traversal
- **WHEN** each fresh guest visit to the affected article waits six seconds, then sends 120 wheel steps of 500px separated by 200ms and observes another two seconds
- **THEN** the actual article scroll owner reaches its bottom with the resolved footer and every traversal has supported layout-shift observation and cumulative CLS at most 0.1
- **AND** wheel input is hit-tested against that owner, its first step advances the article, and chosen coordinates/owner bounds are recorded; a traversal that stays at top is invalid
- **AND** the eligible fixture has resolved its Excursions flow to the actual positive-height section rather than retaining its loading placeholder; iframe mount/height are recorded and its viewport activation is verified separately
