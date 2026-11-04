## Why

The web map does not explain its search radius beside the query. A cold mobile visit also waits for hydration before showing an OSM tile.

## What Changes

- Expose a labeled mobile search action and scope, progress, error and recovery in the search panel.
- Render the confirmed compact startup map tile before hydration and reuse it at handoff.
- Verify the existing search telemetry and complete its report when the observation window is available.

## Capabilities

### New Capabilities

- `map-place-search`: discoverable radius search and recovery.

### Modified Capabilities

- `map-startup-viewport`: early render of the confirmed viewport tile.

## Impact

Desktop and mobile web. Map copy changes across RU, BE, UK, PL and EN. No API endpoint, native renderer or storage schema changes.
