## ADDED Requirements

### Requirement: Paint a confirmed mobile startup tile early

The web map SHALL start and display the confirmed cold compact fallback tile before hydration when the final startup view can be established.

#### Scenario: Compact default viewport is confirmed

- **WHEN** a clean compact visit has no usable live location and the default radius response proves the circle cannot tighten
- **THEN** the shell paints a tile that the settled Leaflet viewport will use.

#### Scenario: Startup view depends on visitor state

- **WHEN** coordinates, location, persisted filters, route or a small result set can change the initial viewport
- **THEN** startup waits for the normal settled Leaflet view without issuing a speculative tile request.
