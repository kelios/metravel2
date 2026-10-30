---
name: metravel-travel-book-builder
description: "Assemble ready MeTravel photo diaries from selected places and an approved layout; produce physical PDF packages and revision-matched previews with verified photos and QR links."
---

# MeTravel Photo Diary Builder

Use for ready editorial photo diaries. Reuse the existing
`services/book/readyBooks/` and `scripts/books/` pipeline; personal travel export
and quest printing remain separate consumers. `AGENTS.md` is inherited.

## Establish the current book contract

Read `docs/features/travel-memory-books.md`, its referenced selection/design
files and the relevant OpenSpec change. These sources own the current author,
countries, minimum composition and page roles. Confirm that schema, renderer,
imposition and validation represent those decisions before generating a book.
An earlier fixed 12-place/56-page prototype is not evidence for a newer edition.

Inputs: selected place IDs/coordinates; the owning author's published travel
URLs; verified map/place URLs; an optional associated published quest URL and
step/place evidence; original photos and rights; approved artwork, style and
page geometry; licensed font files; physical profiles; sourced copy; approval
evidence.
Do not substitute a city or a third-party article for a selected concrete place.
An unresolved source or style decision remains explicit rather than becoming a
placeholder, invented link or silently omitted place.
For each input photo, require the designer's provenance record: published travel
ID/URL, verified `user_id=1`, verification date, exact article image URI and its
associated original-file URI/hash. Check that it belongs to the selected source
article, not just the same author or a nearby point. Keep original photographs
and generated derivatives explicitly distinct. A missing association blocks that
asset; it does not authorize a substitute from another source.

## Assemble through the shared pipeline

1. Derive logical page count from the selected places and current page-role
   contract. Keep cover numbering separate. Bindings and A4 imposition may need
   end padding; do not insert an extra page into every place merely to preserve
   a former even-page pattern.
2. Preserve declared photo dimensions in millimeters, safe/binding margins and
   font sizes. Do not scale an unrelated A4 export to approximate a new profile.
   Respect the approved integrated collage: artwork dissolves into the paper,
   without an added photo frame, dashed border or service header.
3. Generate real vector QR codes labelled «Место на карте» and «Статья на сайте»
   from the verified map/place and author travel targets. Add «Квест» only for a
   real published quest whose route and step reference this exact place; keep
   its optional URL and association evidence in the selected-place record.
   Nearby-city similarity is insufficient. Omit an unavailable quest completely,
   and do not invent short routes that the deployed app cannot open. Keep enough
   physical size and quiet zone for each code's actual data density.
4. Embed licensed fonts with full Cyrillic coverage and images. Use the approved
   style-adaptive heading/body combination, not a fixed font across all styles;
   retain readable body text even with calligraphic watercolor or fantasy
   headings. Record font licenses, image provenance and effective ppi; an upscale
   or sharp screen preview does not create source detail or print permission.
   Keep AI-derivative provenance in records/handoff, without reinstating a
   printed credit/footer removed by the owner; preserve separately required
   source-license attribution.
5. Keep the personal-photo page usable for the specified print size. A requested
   clean diary page has no ruled background, prompts or decorative watermark.
6. Produce only the requested sample or print packages locally. A one-page
   approval proof stays one page until the requested design decision is made;
   do not automatically generate every style or the whole diary block. Use the
   `pdf` skill to inspect final text, boxes and rasterized pages. Asset authoring
   inspection is distinct from app/browser acceptance in `testing`.
7. Make previews from the exact reading PDF, not a second layout. Manifest,
   bytes, hashes, page map and immutable revision must identify the same files.
   Read the current publication adapter instead of creating another uploader.

## Validation and handoff

- Run focused composition/pagination/imposition and publication tests when code
  changes. Check page boxes/count, embedded Cyrillic fonts, text overflow, image
  resolution, link destinations, QR decoding and representative rendered pages.
- Reconcile every selected place with the output page map, both standard QR
  targets and any optional quest's verified association.
  Report any missing data or failed check. Do not describe a draft as complete.
- Apply `docs/TESTING.md` → `Validation selection gate` for app integration.
  Source changes receive independent code review before browser/API/device QA.
  Physical print, provider acceptance and publication are separately evidenced
  stages; a local PDF does not establish them.
- Use the inherited operation gates for costly/shared operations. This role
  does not grant cloud render, paid API, upload, store or deployment authority.
- Skill/prompt changes require `npm run audit:prompts` and the skill validator.

Return files and revision, selected-place/page counts, profile/photo dimensions,
source/QR map, actual checks, limitations and the exact next stage. Carry the
author's requested style/layout approval forward; do not ask again for an
already approved stage or publish an unapproved sample.
