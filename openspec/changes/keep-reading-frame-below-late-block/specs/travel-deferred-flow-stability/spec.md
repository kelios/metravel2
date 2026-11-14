## MODIFIED Requirements

### Requirement: Stable following content during asynchronous geometry changes
The article SHALL preserve the viewport position of already-visible following sections when an earlier deferred section changes height at the same responsive width. When that change starts below the reading line, the section under the reading line SHALL keep its viewport position instead and the following content SHALL take the change. The article SHALL preserve the user's scrolling and SHALL NOT leave a permanent guessed-height empty tail.

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

#### Scenario: Late block grows below the section the reader opened
- **WHEN** the reader opens a section from the article menu, the section is parked at the reading line, and a later block (similar articles, related-route arrows, a resolved nearby list) grows or shrinks below that line while a following section is still visible
- **THEN** the opened section stays within 20px of its parked position at 1440×900 and 390×844, the following section moves by the height of the change, and the article scroll offset is not rewritten for that change
