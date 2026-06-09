# TASK-20260609-015: Replace raw SQL geo-query with GeoDjango ORM to eliminate SQLi pattern

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Replace the raw-string interpolated SQL in `_addresses_in_radius` with a safe GeoDjango ORM
geo-query, eliminating the SQL-injection-pattern and enabling the existing GIS index.

## Context

Security review 2026-06-09. `travels/views.py:1403-1411` (`_addresses_in_radius`) builds a
raw query:

```python
TravelAddress.objects.raw(
    f"SELECT ... WHERE ST_DWithin(geom, ST_SetSRID(ST_Point({lng}, {lat}), 4326)::geography, {radius}*1000)"
)
```

Values `lat`, `lng`, `radius` are currently typed (FloatField / IntegerField) so a pure SQL
injection is mitigated in practice, but the raw string interpolation pattern is fragile:
future edits may introduce a string parameter and open a real injection. Additionally,
`TravelAddress.models.py:64` declares a `GistIndex` on `geom` that the raw query may not
use depending on planner statistics, whereas GeoDjango's `geom__distance_lte` consistently
triggers the index. The `path_near` query at `views.py:1002` already uses the ORM pattern
correctly and is the reference implementation.

No frontend API contract changes — the endpoint response shape is unchanged.

Source task:

- Source id:
- Source path: backend security review 2026-06-09

## Acceptance Criteria

- [ ] `_addresses_in_radius` in `travels/views.py` no longer calls `objects.raw()` with
      interpolated latitude, longitude, or radius values.
- [ ] The replacement uses GeoDjango `geom__distance_lte=(Point(lng, lat, srid=4326), D(km=radius))`
      (or equivalent), consistent with the `path_near` implementation at `views.py:1002`.
- [ ] The `GistIndex` on `TravelAddress.geom` is utilised: `EXPLAIN ANALYZE` on a radius
      query shows an index scan (not a sequential scan) for a populated table.
- [ ] Existing behaviour is preserved: the endpoint returns the same set of addresses for
      an identical lat/lng/radius input before and after the change.
- [ ] Unit/integration tests cover the radius query and pass.

## Gherkin Tests

```gherkin
Feature: Geo radius query uses ORM and the GIS index

  Scenario: Radius query returns correct addresses via ORM
    Given travel addresses exist at various coordinates
    When the client requests travels within 50 km of a known point
    Then the response contains only addresses within that radius
    And no raw SQL with string interpolation is executed

  Scenario: GIS index is used for the radius query
    Given the GistIndex on TravelAddress.geom is present
    When an EXPLAIN ANALYZE is run on the radius query
    Then the query plan shows an index scan on the geom column
```

## Assignment

Primary owner: Backend developer — rewrite `_addresses_in_radius` using GeoDjango ORM.
Support agents: Tester to verify identical results vs. old raw query on a data fixture;
Reviewer to confirm no other raw geo-queries with string interpolation exist.

## Likely Files Or Areas

- `travels/views.py` lines 1403-1411 (`_addresses_in_radius`)
- `travels/views.py` line 1002 (`path_near` — reference ORM implementation)
- `travels/models.py` line 64 (GistIndex on geom)
- Backend test suite: `travels/tests/` — add or update geo-query tests

## Plan

1. Read `_addresses_in_radius` and the `path_near` reference implementation.
2. Rewrite `_addresses_in_radius` using `TravelAddress.objects.filter(geom__distance_lte=(Point(lng, lat, srid=4326), D(km=radius)))`.
3. Ensure `from django.contrib.gis.geos import Point` and `from django.contrib.gis.measure import D` are imported.
4. Run `EXPLAIN ANALYZE` on a test DB to confirm index usage.
5. Add a test comparing ORM results with a known fixture.
6. Search the codebase for other `objects.raw(f"...` patterns and flag any found.

## Validation

```bash
# Verify no raw geo interpolation remains
grep -n "objects.raw" ../metravel-backend/travels/views.py

# Test the radius endpoint still returns results
curl -s "https://metravel.by/api/travels/addresses-in-radius/?lat=53.9&lng=27.5&radius=50" | python3 -m json.tool | head -20

# EXPLAIN ANALYZE (run in Django shell or psql)
# EXPLAIN ANALYZE SELECT * FROM travels_traveladdress WHERE ST_DWithin(geom, ST_SetSRID(ST_Point(27.5,53.9),4326)::geography, 50000);
# Expected: Index Scan using travels_traveladdress_geom_id on travels_traveladdress
```

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-09: Created from backend security review finding [CRITICAL].

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
