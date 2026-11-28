## Context

Existing full books require compact/A5 profiles and author-1 photo provenance; mini diaries require six A5 pages and Belarus. Neither describes this supplied museum passport. See proposal.md for the goal.

## Goals / Non-Goals

Add a narrow optional museumPassports collection, without weakening any existing schema or adding a second storage channel. Do not alter existing edition files or forge article/photo associations.

## Decisions

- Use a strict separate schema and the existing `/books/[slug]` route. Rejected: making the passport a partial photo diary, which would assert false dimensions and provenance.
- Pin all four PDFs and both WebP previews to the same id/revision. The A3 booklet is already imposed; the A4 PDF remains sequential for reading.
- Reuse BooksFrame, existing catalogue/card styles, copy helpers and ordinary download anchors. Native receives the existing null-component boundary.
- Extend asset collection and rights targets, and reuse activation's lock/CAS and storage verification. New editions require their own genuine rights proof.

## Risks / Trade-offs

- Wrong print option can impose a booklet twice → separate labels and exact A3 duplex/short-edge instructions.
- Stale or group-only museum access → content selection is checked before final files; UI advises checking current museum conditions.
- Preview and file mismatch → staging evidence covers the exact six hashes and physical page counts.
- Physical print quality is not established by checksum → no print-shop certification claim.

## Migration Plan

Stage and verify immutable assets, activate the additive pointer, then publish the reviewed web revision. Rollback restores the previous publication pointer/web revision; immutable assets remain for historical releases.

## Validation

Strict schema/storage regression, catalogue route/filter and translated-resource checks before independent review. In testing, mobile web first then desktop catalogue/detail, four downloads, dimensions and console/network; no native runtime boundary changed.
