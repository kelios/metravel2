# TASK-20260609-071: `GET /api/travels/{id}/near/` returns 500 for every valid id — Decimal lat/lng passed to GEOS `Point()`

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Restore the "travels near" endpoint: `GET /api/travels/{id}/near/` must return `200` with a
list (or `[]`) for every existing travel, and `404` only for a non-existent id.

## Context

Prod regression after the BE-025 security deploy (commits `a077576` "Harden API permissions
and prod settings" → `f3d0062` "Validate security task batch"). On 2026-06-08 a 60-id sweep
returned 200; on 2026-06-09 every valid id returns 500.

### Repro (read-only, prod)

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://metravel.by/api/travels/384/near/"   # 500 (also 391, 544, 599, 230)
curl -s -o /dev/null -w "%{http_code}\n" "https://metravel.by/api/travels/440/near/"   # 404 (non-existent — correct)
# Same geo helper, float inputs — WORKS:
curl -s -o /dev/null -w "%{http_code}\n" "https://metravel.by/api/travels/search_travels_for_map/?where=%7B%22lat%22%3A53.9%2C%22lng%22%3A27.56%2C%22radius%22%3A60%7D"  # 200
```

### Root cause (code on `origin/master`)

BE-025 replaced the raw SQL in `_addresses_in_radius` with GeoDjango
(`a077576`: `geom__distance_lte`; then `f3d0062`: `geom__dwithin`):

```python
# travels/views.py:1415-1422 (origin/master)
def _addresses_in_radius(self, lat: float, lng: float, radius: int):
    point = Point(lng, lat, srid=4326)
    return TravelAddress.objects.filter(
        geom__dwithin=(point, D(km=radius))
    )
```

The `travels_near` action feeds it **`Decimal`** values straight from the model:

```python
# travels/views.py:1173-1185 (origin/master)
ta = TravelAddress.objects.filter(travel_id=pk).first()
...
ids = self._get_travel_ids_by_coordinates(lat=ta.lat, lng=ta.lng, radius=60)
```

`TravelAddress.lat` / `TravelAddress.lng` are `DecimalField` (`travels/models.py:49-50`),
so at runtime `ta.lat` / `ta.lng` are `decimal.Decimal`. Django 4.0's GEOS `Point`
constructor (`django/contrib/gis/geos/point.py`, verified against the Django 4.0.10 wheel —
project pins `django==4.0.*`) only accepts `float`/`int` for individual coordinates:

```python
elif isinstance(x, (float, int)) and isinstance(y, (float, int)):
    ...
else:
    raise TypeError("Invalid parameters given for Point initialization.")
```

`Decimal` fails the `isinstance` check → `TypeError` → unhandled → HTTP 500 for **every**
travel that has at least one `TravelAddress` (i.e. effectively all of them). The old raw SQL
interpolated `Decimal` into an f-string, which formats fine — that is why this is a
regression introduced by the rewrite, not by data or infra.

### Why the other geo paths still work (corroborating evidence)

- `search_travels_for_map` (`travels/views.py:1531-1545`) calls the **same**
  `_addresses_in_radius`, but its inputs come from `SearchForMapWhereParamsSerializer`
  (`travels/serializers.py:450-453` — `FloatField`/`IntegerField`) → floats → prod returns
  200. This rules out a missing `geom` column, unapplied migration 0015, missing GDAL/GEOS,
  or a `dwithin`+geography problem.
- The model itself already does the correct cast in `save()`:
  `self.geom = Point(float(self.lng), float(self.lat))` (`travels/models.py:68-69`).
- `geom = PointField(geography=True, srid=4326, ...)` (`travels/models.py:59`), so
  `geom__dwithin=(point, D(km=radius))` is valid — for `geography=True` GeoDjango converts
  the `Distance` to meters (the "degree units only" restriction applies to geodetic
  *geometry* columns, not geography).
- The test added with BE-025 (`tests/travels/test_map_catalog_api.py` in `a077576`) covers
  only the float path (`search_travels_for_map`), which is why CI stayed green while
  `near` broke.

### Proposed fix

Cast at the helper boundary so every caller is safe (mirrors `models.py:69`):

```python
# travels/views.py:_addresses_in_radius
point = Point(float(lng), float(lat), srid=4326)
```

Additionally (defensive, same action): `TravelAddress.lat/lng` are `null=True` — guard
`travels_near` with `if ta.lat is None or ta.lng is None: return Response([], status=200)`
before calling the helper, otherwise `Point(None, None)` is the next latent 500.

### Secondary correctness note (worth checking while in here)

The old raw SQL computed distance from the `lat`/`lng` columns; the new query filters on
`geom`, which is only populated in `save()` (`travels/models.py:68-69`). Any legacy rows
with `lat`/`lng` set but `geom IS NULL` (created before migration 0015 or via bulk
writes bypassing `save()`) silently disappear from `near` and map results. Check and
backfill once:

```sql
-- diagnostics
SELECT count(*) FROM travel_address WHERE geom IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;
-- backfill if non-zero
UPDATE travel_address SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE geom IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;
```

No model change → **no new migration needed** for the float-cast fix (the backfill is a
one-off data operation, can be a data migration or manual SQL — owner's choice).

No frontend changes required: FE already degrades 500 → `[]`
(`metravel2/api/map.ts:286-309`), so the section is silently empty; it will populate again
as soon as the backend returns 200. Response contract is unchanged.

Source task:

- Source id: BE-067
- Source path: prod regression report 2026-06-09 (follow-up to BE-025 / tasks/015)

## Acceptance Criteria

- [ ] `_addresses_in_radius` constructs the point as `Point(float(lng), float(lat), srid=4326)`
      (or callers cast before calling) so `Decimal` inputs no longer raise `TypeError`.
- [ ] `travels_near` returns `200` with an empty list when the travel's address has
      `lat IS NULL` or `lng IS NULL` (no `Point(None, ...)` call).
- [ ] Prod: `GET /api/travels/384/near/` (and 391, 544, 599, 230) → `200` + JSON array.
- [ ] Prod: `GET /api/travels/440/near/` (non-existent) → `404` (contract preserved).
- [ ] Regression test added that exercises `/api/travels/{id}/near/` through the view with
      a `TravelAddress` fixture (Decimal `lat`/`lng` populated, `geom` set via `save()`),
      asserting `200` — i.e. the Decimal path is covered, not only the float map path.
- [ ] `geom IS NULL AND lat IS NOT NULL` row count checked; backfilled if non-zero
      (one-off data fix, documented in Results).
- [ ] `search_travels_for_map` and `near-route` (`path_near`) still return `200` (no
      regression in the other two consumers of the geo helpers).

## Gherkin Tests

```gherkin
Feature: Travels near endpoint

  Scenario: Near list for an existing travel with an address
    Given travel 384 exists and has a TravelAddress with Decimal lat/lng and a geom point
    When the client requests GET /api/travels/384/near/
    Then the response status is 200
    And the body is a JSON array of published, moderated travels within 60 km, excluding 384

  Scenario: Near list for a travel whose address has no coordinates
    Given a travel exists whose only TravelAddress has lat = NULL
    When the client requests its /near/ endpoint
    Then the response status is 200 and the body is []

  Scenario: Non-existent travel keeps 404 contract
    Given travel 440 does not exist
    When the client requests GET /api/travels/440/near/
    Then the response status is 404
```

## Assignment

Primary owner: Backend developer — one-line cast in `_addresses_in_radius` + null-guard in
`travels_near` + regression test + geom backfill check.
Support agents: Tester to verify the three prod probes post-deploy; Reviewer to confirm no
other call site passes Decimal/None into `Point(...)` (grep `Point(` in `travels/`).

## Likely Files Or Areas

- `travels/views.py:1415-1422` (`_addresses_in_radius` — the cast)
- `travels/views.py:1173-1185` (`travels_near` — null-guard for `ta.lat`/`ta.lng`)
- `travels/models.py:49-50,59,68-69` (DecimalField source of truth; reference cast in `save()`)
- `tests/travels/test_map_catalog_api.py` (extend or add sibling test for the `near` action)
- One-off SQL / data migration for `geom IS NULL` backfill (only if diagnostics > 0)

## Plan

1. Cast to float in `_addresses_in_radius`: `Point(float(lng), float(lat), srid=4326)`.
2. Add null-guard in `travels_near` before calling `_get_travel_ids_by_coordinates`.
3. Add a pytest hitting `/api/travels/{id}/near/` with a TravelAddress fixture (200 + list),
   plus a fixture with `lat=None` (200 + `[]`).
4. Run the `geom IS NULL` diagnostic on prod DB; backfill if needed.
5. Deploy; run the Validation probes.

## Validation

```bash
# After deploy (read-only prod probes):
for id in 384 391 544 599 230; do curl -s -o /dev/null -w "near $id -> %{http_code}\n" "https://metravel.by/api/travels/$id/near/"; done   # expect 200 x5
curl -s -o /dev/null -w "near 440 -> %{http_code}\n" "https://metravel.by/api/travels/440/near/"                                            # expect 404
curl -s "https://metravel.by/api/travels/384/near/" | python3 -c "import sys,json; d=json.load(sys.stdin); print(type(d).__name__, len(d))" # list N

# Backend tests:
uv run pytest tests/travels/ -k "near or map" -q
```

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-09: Created from prod regression diagnosis (BE-067). Root cause pinned to
  Decimal → GEOS `Point` TypeError introduced by BE-025 rewrite (`a077576`/`f3d0062`);
  float path (`search_travels_for_map`) verified working on prod, ruling out
  migration/GDAL/dwithin hypotheses.

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
