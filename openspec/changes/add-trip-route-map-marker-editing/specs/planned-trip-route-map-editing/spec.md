## Purpose

Defines how a planned-trip route point can be repositioned, edited, and deleted
directly from the planner map on desktop web, mobile web, Android, and iPhone,
and how those map actions stay consistent with the route point list, the routed
line, and the route summary.

## ADDED Requirements

### Requirement: Marker drag repositions the route point
The system SHALL let the trip owner drag a route point marker on the planner map
and, on release, SHALL update that point's coordinates in the route draft. The
system MUST NOT persist the new coordinates on its own: they reach the backend
only through the existing explicit route save action.

#### Scenario: Owner drags a marker to a new position
- **WHEN** the trip owner drags a route point marker and releases it over the map
- **THEN** the coordinates of exactly that point change to the drop position
- **AND** the order of route points is unchanged
- **AND** the route line and summary are recomputed from the new coordinates
- **AND** the route is reported as having unsaved changes

#### Scenario: Guest opens the same route
- **WHEN** a user who does not own the trip opens the planner map
- **THEN** route point markers cannot be dragged
- **AND** no route point editing or deletion action is offered on the map

#### Scenario: Drop position is not a usable coordinate
- **WHEN** a drag ends with a latitude or longitude that is not a finite number
- **THEN** the route draft is left unchanged

### Requirement: Route point actions are reachable from its marker
The system SHALL let the trip owner open editing and deletion for a route point
by interacting with that point's marker on the map. Those actions MUST have the
same effect as the corresponding actions in the route point list.

#### Scenario: Owner edits a point from the map
- **WHEN** the trip owner activates the edit action on a route point marker
- **THEN** the point editor opens for that point, exactly as it does from the list

#### Scenario: Owner deletes a point from the map
- **WHEN** the trip owner activates the delete action on a route point marker
- **THEN** that point is removed from the route draft
- **AND** the remaining points keep their relative order
- **AND** the marker disappears from the map together with its actions

#### Scenario: Marker interaction does not add a point
- **WHEN** the trip owner taps a route point marker on a map that adds points by tap
- **THEN** no new route point is created

### Requirement: Map, list, and open editor stay on one route state
The system MUST keep the map, the route point list, and an open point editor on
the same coordinates. A coordinate change made on the map MUST be visible in the
list and in the open editor for that point before the route can be saved.

#### Scenario: Point editor is open while its marker is dragged
- **WHEN** the trip owner drags the marker of the point whose editor is open
- **THEN** the editor's latitude and longitude fields show the dropped position
- **AND** saving the editor does not restore the pre-drag coordinates

#### Scenario: List reflects a map edit
- **WHEN** a route point is moved or deleted from the map
- **THEN** the route point list shows the same coordinates and the same set of points

### Requirement: Manual marker positioning keeps the chosen map view
The system MUST NOT re-fit the map viewport to the whole route as a result of a
user dragging a marker. Automatic fitting SHALL remain available for route shape
arriving from data.

#### Scenario: Fine-tuning a point twice in a row
- **WHEN** the trip owner drags a marker, waits for the route line to rebuild, and drags another marker
- **THEN** the map keeps the center and zoom the user was working at
- **AND** the second marker is still where the user left the view
