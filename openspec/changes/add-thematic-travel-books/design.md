## Context

See proposal.md. Existing source-ready-book binds source point and target; publication uniqueness and detail alternatives use country/style. The approved 70-source research and semantic review resolve contextual targets, 40 scoped routes, 65 public variants, 5 supplied originals and two castle replacements. These inputs are not a publication verdict.

## Goals / Non-Goals

Goals: strict additive thematic-v1 sources; truthful visible route/caption/access information; finished 40/30 diaries using the common renderer. Non-goals: changing map routing, legacy country sources, physical dimensions, backend, native releases or printer contact.

## Decisions

1. Separate source relation, map target and media provenance in a strict thematic schema/adapter. Keep legacy exact-point checks intact. Rejected: optional legacy point IDs and relabelled thumbnails, which lose source guarantees.
2. Reuse the semantic ReadyBook renderer, physical producer, imposition and preview. Add thematic page content in that renderer; no copied production engine. Metric ranges and historical/provider-estimate notes remain visible.
3. Declare seriesId/theme on thematic editions and one edition-family helper shared by publication and UI. Country alternatives remain country-only; related indexes include only exact target point IDs and do not fall back to a context article for point requests.
4. Retain public source SHA/dimensions separately from owner-original SHA/dimensions. Ignored private registries resolve local files; committed records contain no private paths/GPS. Publication derivatives remove EXIF; PPI uses actual placed photo bounds.
5. Preserve forty mountain names/order; castles replace unavailable masonry depictions 12717/14413 with verified reserves 15995/14533. Readiness means a verified produced diary, independently of current trail access, image-resolution limits, optional paper check and provider acceptance.
6. Reuse ReadyBookRelatedLink with an optional icon-only presentation for place cards. Normalize the selected primary source point at each API boundary; never substitute grouped place or article IDs. Keep the separate article action and the default text presentation in other contexts. The owner requested these two distinct actions while this change was in progress.

Affected paths: data/travelBooks/schema and series, types/readyBook.ts, services/book/readyBooks/{publication,bookMetadata,related,render}, scripts/books source adapter/catalog/publisher/build CLI, components/books/catalog and details, components/places, PlacesScreen.parts, utils/placesCatalog, books locales, focused tests and feature documentation.

## Risks / Trade-offs

- Context sources accidentally become exact links → discriminated target/relation validation and negative regressions.
- Thematic text overflows small pages → compile-time overflow checks and representative rendered inspection; no silent truncation or body shrinking.
- Historical or changing access → dated official source and visible reference-only warning; refresh notices before release.
- Old immutable bytes change through normalized schemas → merge raw accepted objects, compare every prior resource descriptor/hash.
- Shared quality/build operations → coordinate locks and other sprint acceptance before execution.

## Migration Plan

Add schemas/adapters and regression coverage; produce both profiles locally and inspect PDF/QR; independent full-diff review and gate; explicit-path commit/push; testing; additive publication plus canonical frontend deploy; mobile then desktop production acceptance and exact asset checks. Roll back catalogue/manifest/frontend pointers to previous revision; accepted immutable files remain untouched.

Validation selection: pure source/family/compatibility regressions once, affected lint/typecheck, i18n contracts; PDF geometry/fonts/native PPI/QR and revision checks; new responsive catalogue states on mobile and desktop after testing/deploy. Native boundaries unchanged, so no native build. Existing accepted book evidence reused unless its bytes or consumer behavior change.
