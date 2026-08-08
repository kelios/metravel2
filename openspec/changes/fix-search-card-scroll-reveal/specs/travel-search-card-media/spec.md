## Purpose

Define the observable loading, recycling, geometry, and resource-budget contract
for travel covers in virtualized search results across active platforms.

## ADDED Requirements

### Requirement: A travel cover is ready before its card becomes visible

The search result list SHALL prepare each newly visible travel card's own cover
early enough that the cover is decoded, has non-zero intrinsic dimensions, and
is fully revealed when sampled in the agreed scrolling scenarios. A neutral
color fill alone MUST NOT count as a ready cover.

#### Scenario: Paced downward scrolling on desktop web

- **WHEN** a 1280×900 desktop viewport scrolls the result list downward by the
  agreed 1160 px trace under a throttled 1.6 Mbit/s connection with 150 ms
  latency
- **THEN** every visible travel-cover node at each scroll checkpoint has its own
  decoded image, non-zero intrinsic width, and full image opacity
- **AND** zero visible travel slots contain only the neutral color fill

#### Scenario: Paced downward scrolling on mobile web

- **WHEN** a 390×844 mobile viewport follows the equivalent row-by-row downward
  scroll trace under a throttled 1.6 Mbit/s connection with 150 ms latency
- **THEN** every visible travel-cover node at each scroll checkpoint has its own
  decoded image, non-zero intrinsic width, and full image opacity
- **AND** zero visible travel slots contain only the neutral color fill

#### Scenario: Returning to previously viewed results

- **WHEN** the user scrolls back to travel cards that were already fully visible
  during the same session
- **THEN** their own decoded covers remain fully revealed without a second
  fill-to-photo replacement

### Requirement: Recycled cards never expose another travel's photo

The result list MUST preserve source ownership while virtualized cells are
reused. Preparing a cover earlier MUST NOT reveal a decoded image that belongs
to the previously rendered travel.

#### Scenario: A virtualized cell changes travel identity

- **WHEN** a rendered cell is reassigned from one travel to another and the next
  cover has not yet been decoded
- **THEN** the previous travel's photo is never visible in the reassigned cell
- **AND** the cell reveals only the next travel's own cover once that cover is
  ready

#### Scenario: Repeated forward and backward scrolling

- **WHEN** the same set of virtualized cells is recycled during repeated forward
  and backward scrolling
- **THEN** the observed stale-photo or wrong-photo swap count remains zero

### Requirement: Scroll readiness uses bounded media loading

The result list SHALL improve cover readiness by moving a bounded subset of the
existing cover requests earlier. It MUST NOT eagerly render the entire
paginated catalog, request a second raster for a visual slot, or create more
than one effective image URL for that slot.

#### Scenario: Initial search window is loaded

- **WHEN** the initial result window becomes stable before user scrolling
- **THEN** the number of cover requests is no more than six above the recorded
  nine-request production baseline
- **AND** downloaded cover bytes are no more than 400,000 bytes above the
  recorded 613,978-byte production baseline

#### Scenario: The agreed desktop scroll trace completes

- **WHEN** the 1160 px desktop scroll trace has completed
- **THEN** total downloaded cover assets do not exceed the recorded production
  total of 18 assets for the same dataset
- **AND** total downloaded cover bytes do not exceed the recorded production
  total of 1,237,294 bytes for the same dataset

#### Scenario: A cover is unsupported, missing, or fails to load

- **WHEN** the card cannot render a valid cover image
- **THEN** it keeps the existing neutral color fallback and stable media geometry
- **AND** it does not request a substitute preview raster

### Requirement: Card geometry remains stable while covers load

The result list SHALL preserve the existing card and media dimensions while
covers are prepared, revealed, recycled, or fail to load.

#### Scenario: A pending cover becomes decoded

- **WHEN** a cover changes from its neutral loading state to its decoded image
- **THEN** the card's position and media-box dimensions do not change
- **AND** the transition introduces no additional layout shift

### Requirement: Active platforms retain equivalent search-card behavior

Desktop web, mobile web, and Android SHALL keep the same card hierarchy and
cover ownership semantics. The web readiness fix MUST NOT reduce Android's
existing native lookahead or reintroduce empty-card stop frames on the connected
device.

#### Scenario: The search list is scrolled on Android

- **WHEN** the same result-list scenario is exercised in a locally built Android
  app on the connected USB device
- **THEN** visible cards retain their own cover without empty stop frames or
  stale-photo swaps
- **AND** the established native lookahead behavior remains unchanged
