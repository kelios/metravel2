## ADDED Requirements

### Requirement: Paint a confirmed mobile startup tile early

The web map SHALL start and display the confirmed cold compact fallback tile before hydration when the final startup view can be established.

#### Scenario: Compact default viewport is confirmed

- **WHEN** a clean compact visit has a denied geolocation permission or request
- **THEN** the shell starts the default-circle tile before the catalog responds and the settled Leaflet viewport uses that circle, including for small, empty or failed responses.

#### Scenario: Startup view depends on visitor state

- **WHEN** coordinates, location, persisted filters or route can change the initial viewport
- **THEN** startup waits for the normal settled Leaflet view without issuing a speculative tile request.
