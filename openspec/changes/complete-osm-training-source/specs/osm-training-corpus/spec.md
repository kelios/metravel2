# Spec Delta

## Purpose

Provide reproducible, geographically verified OpenStreetMap training records while keeping incomplete sources and unsupported facts out of the corpus.

## ADDED Requirements

### Requirement: Complete and attributable country sources

The corpus MUST identify the actual source kind, country coverage, snapshot dates, download URLs and checksums. Complete country extracts MAY replace unavailable tile queries without claiming that those queries succeeded.

#### Scenario: Complete extracts replace failed tiles
- **WHEN** verified complete Belarus and Poland extracts are fully scanned
- **THEN** the corpus records both complete scans and preserves the previous missing-tile diagnostics separately

#### Scenario: Incomplete or corrupt input
- **WHEN** a download is incomplete or its checksum does not match
- **THEN** the corpus is not published as complete and the previous published cache remains usable

### Requirement: Geographic and factual grounding

Every accepted POI MUST have supported geometry inside its declared country's authoritative boundary. Generated descriptions MUST use only supplied source facts and explicit country provenance.

#### Scenario: Neighbouring-country control
- **WHEN** a candidate centre lies in Lithuania or Ukraine rather than Belarus
- **THEN** it is excluded from the Belarus corpus regardless of its name or input-file label

#### Scenario: Sparse peak tags
- **WHEN** a peak provides a name and elevation but no access, duration or weather information
- **THEN** its description may state its name, country and elevation but makes no access, visit-duration or photography-weather claim

### Requirement: Bounded and transparent source processing

Source preparation MUST stream country files with disk-backed geometry storage, preserve the existing POI filters and output schema, and count unresolved geometry without inventing coordinates.

#### Scenario: Relation geometry is incomplete
- **WHEN** a selected relation has an unavailable member or an unresolved cycle
- **THEN** that relation is excluded and the rejection is recorded instead of using a partial bounding box
