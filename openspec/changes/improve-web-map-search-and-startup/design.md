## Context

The map already knows its effective search anchor and active request status. The web shell already starts the default radius request early.

## Decisions

- Show scope and status in the existing filters panel. A zero-result action expands to the next radius while keeping the query. Retry uses the existing request refetch and counts as a new attempt.
- Reuse the existing mobile toolbar action slot and focus signal.
- For a clean compact visit with denied geolocation, the initial viewport is the default 50 km circle at the compact zoom floor. The shell starts its tile before the catalog responds, and Leaflet adopts that first fit regardless of the first result set. Later fits follow the usual radius and result rules. For a pending prompt, reuse the initial location request and wait for an actual denial. Custom starts retain their settled Leaflet fit.
- On web, an already authorized initial fix holds the first default-radius viewport until the active anchor and its data settle. An unanswered permission prompt can show the default map. Explicit and cached anchors retain precedence for startup.

## Risks and rollback

Verify request cardinality, target center, stale-state isolation and CLS. Revert the relevant changes independently if the deployed checks regress.
