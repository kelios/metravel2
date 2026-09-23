## Purpose

Let a planned-trip owner mark how each route point is reached (train, flight, bus, ferry, transfer) and keep such transfers out of the routed distance, time and road geometry on every planner surface.

## ADDED Requirements

### Requirement: Arrival mode field
The point form SHALL offer «Как добираюсь сюда» with «Как вся поездка» (default) and train, flight, bus, ferry, transfer for every point except the first one. The chosen value SHALL be saved as `arrival_mode` by the route PUT and SHALL mark the route as changed.

#### Scenario: Owner edits the first point
- **WHEN** the owner opens the form of the first route point
- **THEN** the arrival mode field is not shown

#### Scenario: Owner sets a flight
- **WHEN** the owner selects «Перелёт» on the fourth point and saves the point
- **THEN** the route has unsaved changes and the next route PUT sends `arrival_mode: "flight"` for that point

### Requirement: Transfer plaque in the list
The point list SHALL show a plaque «<mode> · <distance>» with a Feather icon above every point reached by a transfer, where the distance is the straight distance from the previous point.

#### Scenario: Flight Munich to Luxembourg
- **WHEN** the point «Аэропорт Люксембурга» has arrival mode flight and follows «Аэропорт Мюнхена»
- **THEN** the list shows «Перелёт · 431 км» between the two points

### Requirement: Runs are routed separately
The live preview SHALL split the draft into runs exactly like the backend (`split_route_legs`) and SHALL send one routing request per run with at least two points; transfers SHALL NOT be routed.

#### Scenario: Two walking parts and a flight
- **WHEN** the draft is A, B, C(flight), D on a walking trip
- **THEN** two routing requests are sent, [A, B] and [C, D], and none spans B–C

#### Scenario: Trip without transfers
- **WHEN** no point has an arrival mode
- **THEN** one routing request with all routable points is sent, as before

### Requirement: Transfers on the map
Web and native maps SHALL draw a transfer as a dashed arc in the transfer colour and routed runs by `legs[].geometry_slice`; a degraded run SHALL keep the approximate style only on its own leg.

#### Scenario: Saved trip with a flight
- **WHEN** the saved summary has legs route [0,2), flight [2,4), route [4,6)
- **THEN** the map draws two routed lines and one dashed arc, and no solid line joins B and C

### Requirement: Separate totals
The summary surfaces (summary tiles, mobile summary row, header chip, map header) SHALL show the routed distance and time without transfers and SHALL show «Переезды K км» separately when the transfer distance is positive.

#### Scenario: Walking 189 km with 2 240 km of transfers
- **WHEN** the summary is `distance_km: 189`, `transfer_distance_km: 2240`
- **THEN** the routed metrics show 189 km and its walking time, and «Переезды 2 240 км» is shown next to them, never added to them
