# Design

## Context

The existing `sources/osm.py` query defines the POI predicates, `element_row` defines the cache schema, and `sets/osm_intents.py` provides a second country check. Reuse them. Preserve the running #2751 prepared dataset and its Python environment.

## Goals / Non-Goals

Goals: complete dated BY/PL source files, exact country geometry checks, grounded descriptions, bounded memory, reproducible cache and transparent failure. Non-goals: an OSM database, model training, paid APIs, backend or UI changes.

## Decisions

- Add `sources/osm_pbf.py` as an explicit alternative, not an invisible retry. Stream official dated Geofabrik extracts, verify published MD5 plus local SHA256, and cache authoritative OSM country GeoJSON from two Nominatim queries. Downloads and parsing are sequential and CPU-only.
- Use optional pyosmium/Shapely in an isolated environment. Read nodes/ways with a disk-backed node index and native tag pre-filter. Store only selected POIs and their relation geometry dependencies in a temporary SQLite index; resolve referenced nodes/ways/nested relations without retaining the national node/way database in Python memory. Unknown/incomplete geometry is counted and excluded, never assigned an invented centre. Reference expansion has an explicit bounded failure limit.
- Apply the same tag predicates as Overpass, then test each centre against the country's OSM boundary. Existing Wikidata/alphabet country checks remain in the set builder. Preserve source timestamps, URLs, checksums and geometry rejection counts.
- Publish `pois.jsonl` and its coverage manifest only after both extracts are verified and fully scanned. Preserve the old Overpass manifest and its 116 missing tiles separately. A PBF cache advertises `source_kind=geofabrik-pbf` and complete country scans; it does not reset tile diagnostics.
- Remove unsupported description closers and put trusted country provenance in the prompt. Keep record schema, intent examples, filter validator and split seed unchanged.

Rejected alternatives: indefinite Overpass retries do not cure the external outage; silently using the quarantined bbox tiles or clearing `missing_tiles` would misrepresent coverage; loading a national OSM database is unnecessary. Rollback: retain previous source metadata/cache, versioned downloads and the existing Overpass entry point.

## Risks / Trade-offs

Approximately 2.5 GB of download and a disk-backed scan are larger than tile queries but independent of the overloaded service. Incomplete downloads, checksum errors, mismatched country geometry, unresolved references or resource limits are explicit failures/rejections. Keep raw ODbL data local. App API/SEO/UI accessibility/analytics are unaffected. Validation covers pure country/tag/grounding invariants, a native tiny-file parser fixture, real complete source scans and schema/build checks. Saved v2 intent/site generations are reusable only after exact prompt and validator compatibility is proved; no concurrent GPU operation is needed.
