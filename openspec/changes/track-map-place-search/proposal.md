## Why

The web map records openings, filter changes, marker opens and successful route builds. It cannot distinguish a place search that found matches from one that came back empty or failed.

## What Changes

- Add one `map_place_search` event for each distinct completed text search within the map radius, with the outcome, layout and radius.
- Document the provider report and verify delivery after rollout.

## Capabilities

### New Capabilities

- `map-place-search-analytics`: outcome measurement for web map place search.

## Impact

Web only. No change to map UI, localization, native telemetry or API queries. Search text and coordinates stay outside the event payload.
