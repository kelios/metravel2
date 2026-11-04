## Context

The map already knows its effective search anchor and active request status. The web shell already starts the default radius request early.

## Decisions

- Show scope and status in the existing filters panel. A zero-result action expands to the next radius while keeping the query. Retry uses the existing request refetch and counts as a new attempt.
- Reuse the existing mobile toolbar action slot and focus signal.
- Select an early tile only when the clean compact startup viewport is established by the same radius/coordinate contract as the runtime. For a pending geolocation prompt, use the same initial location request in the head and runtime and wait for an actual denial before painting the fallback tile. Keep the settled Leaflet handoff for custom starts.

## Risks and rollback

Verify request cardinality, target center, stale-state isolation and CLS. Revert the relevant changes independently if the deployed checks regress.
