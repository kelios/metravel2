## Purpose

One physical place on the map is represented by exactly one marker and one
card, while every linked article (source) stays reachable from that card
through a pager, without losing distinct article URLs or photos.

## ADDED Requirements

### Requirement: One marker per canonical place

The map SHALL render exactly one marker and one hit target for each canonical
`place_id` present in the dataset, on every renderer (desktop web, mobile web,
Android WebView, iOS WebView). Grouping SHALL be driven only by the
backend-assigned `place_id`; distance, name or address similarity MUST NOT be
used as identity. A record without `place_id` SHALL remain its own separate
single-source marker.

#### Scenario: Two articles describe one building

- **WHEN** the dataset contains two records that share one `place_id` (e.g.
  the National Library records `14029/389` and `15688/646`)
- **THEN** the map shows one marker with one hit target at the canonical
  coordinate, at every zoom level where the place is visible (10, 13, 16)

#### Scenario: Nearby distinct places never merge

- **WHEN** two records have different `place_id` values, even with close
  coordinates or similar names
- **THEN** each renders as its own marker and opens its own card

#### Scenario: Legacy record without place identity

- **WHEN** a record arrives without `place_id`
- **THEN** it renders as a separate single-source marker with unchanged
  legacy behavior and is never merged by any heuristic

### Requirement: Compact initial marker payload

The initial marker/cluster payload SHALL carry per place only the canonical
place fields, `source_count`, and one compact `primary_source`; the full list
of sources MUST NOT be serialized into the initial payload or into the native
WebView marker payload. The initial payload size SHALL NOT exceed the current
production baseline for the same viewport.

#### Scenario: Initial load of a multi-source place

- **WHEN** the map loads a viewport containing a place with `source_count = 2`
- **THEN** the transferred marker data for that place contains exactly one
  embedded source summary, and total initial payload bytes are not above the
  pre-change baseline

### Requirement: Lazy, cached sources collection

For a place with `source_count > 1`, the client SHALL fetch the source
summaries from the sources collection endpoint
(`GET /api/map/places/{place_id}/sources/`, cursor-paginated
`{ results, next }`) only after the place card is first opened, at most once
per place per cache lifetime. Paging inside the card MUST NOT refetch the map
dataset and MUST NOT rebuild the marker layer.

#### Scenario: First open fetches once

- **WHEN** the user opens the card of a place with `source_count = 2` for the
  first time
- **THEN** exactly one request to the sources endpoint for that `place_id` is
  issued, and paging between sources issues no further map-dataset requests

#### Scenario: Reopen uses cache

- **WHEN** the user closes the card and reopens the same place within the
  cache lifetime
- **THEN** the sources endpoint is not requested again and the pager works
  from cached data

#### Scenario: Single-source place skips the endpoint

- **WHEN** the user opens a place with `source_count = 1`
- **THEN** no request to the sources endpoint is issued

### Requirement: Source pager inside one card

A place card with more than one source SHALL show a pager with a localized
counter (`Материал {{current}} из {{total}}` in RU), previous/next controls
and swipe; a place with exactly one source SHALL show no pager controls.
While paging, only the source-owned fields — thumbnail, article title,
internal article link — SHALL change; the place-owned fields — canonical
name/address, coordinates, copy/share, navigation actions, save/visited
status and the selected marker — MUST stay unchanged.

#### Scenario: Paging through two sources

- **WHEN** the user opens a two-source place and pages forward via the next
  control, then back via swipe
- **THEN** the counter goes `1 из 2` → `2 из 2` → `1 из 2`, each source shows
  its own photo and its own article link (travels `389` and `646` for the
  National Library), and coordinates/navigation/save state never change

#### Scenario: Single source keeps the classic card

- **WHEN** the user opens a place with one source
- **THEN** the card renders as today, with no counter and no pager controls

### Requirement: Stable place selection across renderers

Tapping a marker SHALL select the place by a stable place key communicated
end-to-end (including through the native WebView bridge); selection MUST NOT
be resolved by array index or coordinate equality. The same physical place
opens the same card regardless of dataset ordering or concurrent dataset
updates.

#### Scenario: Tap after dataset reorder

- **WHEN** the dataset refreshes and reorders between render and tap
- **THEN** the tapped marker still opens the card of the same `place_id` it
  visually represents

### Requirement: Media discipline while paging

The card SHALL mount only the active source's image at any time; prefetching
at most the next source's thumbnail is allowed. Paging MUST NOT mount all
source images simultaneously.

#### Scenario: Two-source place image mounting

- **WHEN** the card of a two-source place is open on source 1
- **THEN** only source 1's image is mounted (source 2's thumbnail may be
  prefetched), and after paging only source 2's image is mounted

### Requirement: Localized, accessible pager controls

The pager counter, previous/next labels and the paging announcement SHALL be
localized for RU, BE, UK, PL and EN through the app i18n layer; the paging
change SHALL be announced to assistive technology; pager controls SHALL have
touch targets of at least 44 dp and be operable by keyboard on web.

#### Scenario: Locale and assistive pass

- **WHEN** the card is used in each of RU/BE/UK/PL/EN with a screen reader
  enabled
- **THEN** counter and controls render in the active locale, paging announces
  the new position, and each control's touch target is at least 44 dp

### Requirement: Backward-compatible rollout

While the additive DTO ships, existing clients consuming legacy flat marker
fields SHALL keep working; the client SHALL accept both the grouped DTO and
the legacy flat single-source shape until the explicit removal gate after
frontend adoption is confirmed.

#### Scenario: Old client against new API

- **WHEN** a client built before this change requests markers from the
  upgraded API
- **THEN** the legacy flat fields are still present and the old rendering
  remains functional
