# Proposal

## Why

#2479 cannot finish its OSM description dataset: all 116 clean Overpass tiles are missing, and bounded probes of the original service and public mirrors failed. Existing description templates also add unsupported visitation advice and omit the country from the model input.

Goal: build the same licensed OSM POI record schema from complete, checksummed country extracts when Overpass is unavailable, with explicit geographic provenance and grounded targets. The user's request to finish the three testing tasks authorizes this recovery through implementation and local acceptance.

## What Changes

- Add an explicit Geofabrik PBF source path for Belarus and Poland, streaming with a disk-backed location index and the existing POI tag filters.
- Require complete country downloads, checksums, dated provenance, authoritative OSM country polygons, geographic negative controls and transparent geometry failures before publishing the cache atomically.
- Preserve the old Overpass tile diagnostics; PBF completeness never claims that failed tiles were downloaded.
- Remove unsupported description closers and include the source country in every description prompt.

## Capabilities

### New Capabilities

- `osm-training-corpus`: reproducible, complete country-source coverage and grounded OSM training records.

### Modified Capabilities

None; there is no existing OSM corpus specification.

## Impact

Platform impact: none in app/UI; local dataset preparation only. Localization impact: RU/BE/PL dataset questions; Russian POI descriptions; app-owned locales unchanged.

Data contract: output remains `{id,country,lat,lon,tags}` in the existing OSM cache; provenance additionally identifies PBF files, hashes, boundaries and coverage. Dependencies: free Geofabrik extracts, OSM/Nominatim country boundary cache, isolated optional pyosmium/Shapely environment. No mocks or paid provider; unavailable or incomplete sources fail closed.

User-visible result is indirect: training data no longer teaches unsupported access/time/weather claims. No app API, SEO, UI accessibility, analytics or production changes. Performance concern is bounded local memory during a roughly 2.5 GB source scan. Security concern is verified HTTPS, checksums and atomic publication without secrets. Existing filter schema, split seeds, model artifacts and ongoing #2751 training remain unchanged. Non-goals: running an OSM database, backend deployment, training a model or changing product defaults. No unresolved product question.
